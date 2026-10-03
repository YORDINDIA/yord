#!/usr/bin/env python3
"""Generate on-brand collection covers with Agnes AI and publish them to R2.

Why this exists: 29 of the 39 `collections` rows still point `image_src` at
`http://www.yordindia.com/cdn/shop/...` (every distinct URL 404s, and http is
mixed content on the https storefront) and 10 rows have no cover at all. The
storefront picks a cover as `storage_image_url || image_src`
(frontend/src/app/(main)/collections/page.tsx:41) and the artist hero makes the
same choice (frontend/src/lib/supabase/queries.ts:234), so a stored dead URL
also masks the working local `/artists/<handle>-hero.png` fallback.

Pipeline per collection:

1. build a prompt from the real row (handle/title/class) using the artist
   palettes parsed from packages/db-types/src/index.ts (`ARTISTS` accentColor);
2. `POST /v1/images/generations` (Agnes AI, OpenAI-compatible) at 2K / 4:3;
3. upload the PNG through utils/r2_helpers.py, which stores one web-optimized
   WebP variant (max 1600px wide) at `collections/<handle>.webp` -- the bucket's
   single-variant convention, same shape as `blog/<handle>.webp`;
4. GET the delivered URL (expect 200), then write `storage_image_url`, set
   `image_alt` to `"<Collection title> — YORD India"` (<=120 chars, never
   empty) and clear the dead `image_src` to NULL -- one PATCH, one round trip.

Aspect ratio: the collections grid renders every card as `aspect-[4/3]`
(frontend/src/app/(main)/collections/page.tsx:40-46, `object-cover`), so covers
are generated 4:3 landscape -- 2304x1728 at 2K, downscaled by r2_helpers to a
1600x1200 WebP. Nothing crops in the grid.

**No image may contain text, lettering, logos, watermarks, faces or a
recognisable likeness of a real person or character.** AI lettering renders
badly and artist likenesses are a rights problem, so every subject here is an
object/light/fabric composition and NO_TEXT_NO_FACES plus PLAIN_GARMENTS are
appended to every prompt.

Dry-run is the default and writes nothing. `--preview` generates locally into
scripts/collection_covers_preview/ and touches neither R2 nor the database.
`--execute` runs the full generate -> gate -> upload -> verify -> DB write path.

Every generated cover passes an objective contrast gate before it goes
anywhere: the storefront card is only ~320x240 CSS px, and a near-black frame
collapses into a featureless dark block at that size. A cover that fails is
held back (not uploaded, not written) unless `--allow-low-contrast` accepts it
explicitly; `--qa-only` re-measures already-downloaded covers and prints the
PASS/FAIL table.

Usage:
    python generate_collection_covers.py                       # plan + prompts
    python generate_collection_covers.py --preview --only coldplay \
        --only oversized --only new-arrivals                   # local samples
    python generate_collection_covers.py --qa-only              # gate the samples
    python generate_collection_covers.py --execute             # every row that needs one
    python generate_collection_covers.py --execute --only taylor-swift --limit 1
    python generate_collection_covers.py --execute --force --only coldplay

Artifacts (all safe to delete):
    scripts/collection_covers_checkpoint.json  resume state: handle -> uploaded URL
    data/collection_covers_errors.json         failed collections, only when any
    agnes-out/collection-covers/<handle>.png   generated originals
    scripts/collection_covers_preview/         --preview samples (gitignored)
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from dotenv import load_dotenv
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.checkpoint import load_checkpoint, save_checkpoint  # noqa: E402
from utils.cli import configure_logging, create_parser, resolve_execute  # noqa: E402
from utils.r2_helpers import (  # noqa: E402
    R2NotConfiguredError,
    configure_r2,
    key_from_public_url,
    public_url_host,
    upload_image,
)
from utils.supabase_helpers import get_supabase_client  # noqa: E402

load_dotenv()

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
DB_TYPES_PATH = ROOT / "packages" / "db-types" / "src" / "index.ts"
ORIGINALS_DIR = ROOT / "agnes-out" / "collection-covers"
PREVIEW_DIR = SCRIPTS_DIR / "collection_covers_preview"
CHECKPOINT_FILE = "collection_covers_checkpoint.json"
# data/ is gitignored, so a failed run never leaves an untracked artifact behind
# (same place upload_local_media.py keeps its error log).
ERROR_FILE = ROOT / "data" / "collection_covers_errors.json"

# Agnes AI transport (same endpoint/model defaults as admin-dashboard/src/lib/ai/agnes.ts).
AGNES_DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1"
AGNES_DEFAULT_IMAGE_MODEL = "agnes-image-2.5-flash"

# 4:3 at 2K is 2304x1728 per the Agnes docs; r2_helpers turns it into the single
# 1600x1200 WebP variant every other cover in the bucket uses.
IMAGE_SIZE = "2K"
IMAGE_RATIO = "4:3"

# Object key prefix: collections/<handle> -> collections/<handle>.webp on upload.
KEY_PREFIX = "collections"

# Alt text written in the same DB write as the URL: "<Collection title> —
# YORD India", capped at 120 chars, never empty (a title-less row falls back
# to the handle). Verified against the live schema: the column is `image_alt`.
ALT_SUFFIX = " — YORD India"
ALT_MAX_LEN = 120

DEFAULT_WORKERS = 4
MAX_WORKERS = 8

# Agnes recommends a 60-360s client timeout; reads are the slow leg.
GENERATION_TIMEOUT = (10, 300)
DOWNLOAD_TIMEOUT = 300
URL_CHECK_TIMEOUT = 20

# Retries for 429/5xx/network errors: ~63s of backoff total, like the Agnes CLI.
BACKOFF_DELAYS = (1, 2, 4, 8, 16, 32)

# House accent when an artist has no brand colour: the bronze/gold family from
# packages/ui/src/tokens.css (--accent light #7C5E1E, dark #FFD966).
HOUSE_ACCENT = "#C9A34E"
HOUSE_SECONDARY = "#1E90FF"

# TEXT/BRANDS BAN: appended to every prompt. AI lettering is illegible mush and
# real brand marks are a rights problem, so text and logos stay banned. People
# ARE allowed since the 2026-10-03 owner direction: covers must depict the
# collection's subject, so artist and sports collections show a figure with the
# artist's signature iconography (look, instrument, stage) in a poster-realistic
# style -- evocative, not a photoreal celebrity likeness, which image models
# refuse or mangle anyway.
NO_TEXT_NO_FACES = (
    "Absolutely no text, letters, numerals, typography, logos, brand marks, "
    "sponsor patches, jersey lettering or shirt numbers anywhere in the frame; "
    "no watermarks, signatures or captions; any clothing stays plain and "
    "unbranded."
)

# Plain-garment rule: without it the model invents graphic prints and colour
# blocking, which read as fake merchandise and fight the house style (and any
# invented "print" is the same gibberish-lettering problem in costume form).
PLAIN_GARMENTS = (
    "Any garment shown is plain, unprinted heavyweight cotton or leather: no "
    "patches, no badges, no graphics, no colour blocking, no tailoring, no suits."
)

# House template. The backdrop clause is deliberately mid-tone: the storefront
# card is aspect-[4/3] and only ~320x240 CSS px, and the browser's downscale
# throws away the local contrast an editor sees at 2304x1728 -- a near-black set
# collapses into a featureless dark rectangle (measured on the v1 samples; see
# the contrast gate below). The subject therefore has to sit on a lit surface
# and separate by key light + rim highlight, with the artist colour as a
# secondary accent rather than the frame's only light.
PROMPT_TEMPLATE = (
    "Luxury concert-fashion editorial photograph. {subject} "
    "A single studio still life on a seamless mid-tone studio sweep -- warm grey "
    "with a faint taupe cast -- that stays clearly lit behind the subject with "
    "only a gentle falloff at the far corners. Strong directional key light from "
    "the upper left, a bright hard rim highlight separating the subject from the "
    "backdrop, shadows filled and lifted so every material detail stays readable, "
    "with {accent} and a restrained {secondary} used as secondary accent light in "
    "the haze rather than as the only light. Emphasise fabric weave, drape, "
    "stitching and material texture; premium fashion-campaign colour grade, "
    "cinematic contrast, shallow depth of field. 4:3 horizontal composition, the "
    "subject centred with uncluttered mellow negative space along the top edge for "
    "a caption overlay. Photorealistic, high-end commercial product photography, "
    "tack-sharp focus. " + PLAIN_GARMENTS + " " + NO_TEXT_NO_FACES
)

# Figure template (2026-10-03 owner direction): artist / cricketer / character
# collections put the person in frame, rendered as an expressive painted-poster
# portrait -- recognisable through signature look, instrument, wardrobe and
# stage, not as a photoreal likeness. Same lighting skeleton as the still-life
# template (mid-tone backdrop, hard rim, lifted shadows, bright anchor) because
# the thumbnail contrast gate applies identically to a figure.
PROMPT_TEMPLATE_FIGURE = (
    "Luxury concert-fashion campaign cover. {subject} "
    "Expressive painted-poster realism with confident broad brushwork: the figure "
    "is unmistakable through silhouette, posture, signature look and props, faces "
    "and hands rendered in a stylised poster manner rather than photorealistic. "
    "Dramatic cinematic stage lighting on a clearly lit mid-tone backdrop that "
    "stays bright behind the subject: a strong directional key light from the "
    "upper left, a hard bright rim highlight separating the figure from the "
    "backdrop, shadows filled and lifted, with {accent} as the dominant accent "
    "light and a restrained {secondary} glowing in the haze, and at least one "
    "pale or brightly lit element flaring as the bright anchor. Premium "
    "fashion-campaign colour grade, cinematic contrast, rich detail in fabric and "
    "equipment. 4:3 horizontal composition, the figure centred with uncluttered "
    "mellow negative space along the top edge for a caption overlay. "
    + NO_TEXT_NO_FACES
)

# Class defaults: used for a collection with no curated subject below.
DEFAULT_SUBJECTS = {
    "artist": (
        "A stage-light composition channelling the {title} live-show atmosphere: "
        "draped fabric, beams of {accent} light cutting through haze and a single "
        "garment on a steel stand at centre."
    ),
    "category": (
        "The quintessential {title} garment as a single hero object on a warm grey "
        "studio set, hanging straight with the fabric texture filling the frame."
    ),
    "store": (
        "An editorial still life for the {title} edit: layered concert garments and "
        "stage light arranged on a warm grey studio set."
    ),
}

# Store-merchandising collections (not a garment type, not an artist).
STORE_HANDLES = frozenset(
    {
        "bestsellers",
        "new-arrivals",
        "all",
        "home-page-trending",
        "premium-store",
        "random-designs",
        "tshirts-adt",
    }
)

# Person/team/festival collections that have no entry in the db-types ARTISTS
# record but still read as "figure" covers rather than product categories.
FIGURE_HANDLES = frozenset(
    {"csk", "rcb", "virat", "ms-dhoni", "naruto", "john-summit", "rishab-sharma"}
)

# Curated per-collection direction. `subject` is the scene; `artist` reuses
# another handle's palette (the Coldplay sub-collections); `accent`/`secondary`
# override the palette when the sub-theme needs its own light (glow in the dark).
# `kind` overrides the classifier below.
COLLECTION_THEMES: dict[str, dict[str, str]] = {
    # --- artists (palette comes from the ARTISTS record at runtime) ---
    "alan-walker": {
        "kind": "artist",
        "subject": (
            "An empty festival main stage on a lit set: cold cyan laser beams "
            "cutting through fog over a pale concrete floor, and a black technical "
            "jacket hanging on a brushed steel stand at centre with a folded ecru "
            "garment on the floor at its base catching a bright white key light."
        ),
    },
    "coldplay": {
        "kind": "artist",
        "subject": (
            "Concentric rings of golden light and electric-blue glow suspended over "
            "an empty warm grey stage set, drifting confetti and haze, with draped "
            "charcoal fabric hanging from a rail in the foreground catching the gold "
            "rim light; the stage is completely empty of people."
        ),
    },
    "coldplay-custom-designs-collection": {
        "kind": "artist",
        "artist": "coldplay",
        "subject": (
            "A couture workbench on a warm grey studio set: draped black fabric, "
            "white tailor's chalk, brass pins, a soft tape measure and a spool of "
            "gold thread under a single warm task lamp, a sheet of ivory pattern "
            "paper catching the lamp light as the bright anchor."
        ),
    },
    "coldplay-glow-in-the-dark-collection": {
        "kind": "artist",
        "artist": "coldplay",
        "accent": "#8CFF3D",
        "subject": (
            "Phosphorescent green-gold threads glowing across a charcoal garment on "
            "a warm grey sweep, the luminous stitching doubling as the highlight "
            "under a faint ultraviolet wash."
        ),
    },
    "diljit-dosanjh": {
        "kind": "artist",
        "subject": (
            "Vibrant orange silk and a turquoise stage wash, white-hot sparkler "
            "bursts flaring bright white behind a black denim jacket on a stand, "
            "and a folded cream silk scarf on a pale stool catching a hard specular "
            "white key light as the bright anchor, celebratory night-concert energy."
        ),
    },
    "dua-lipa": {
        "kind": "artist",
        "subject": (
            "Disco-ball reflections sliding across a sequined garment on a pale grey "
            "set, pink and violet neon glow, mirror-tile sparkle in the shadows."
        ),
    },
    "ed-sheeran": {
        "kind": "artist",
        "subject": (
            "An acoustic guitar leaning against a wooden stool on a warm grey stage, "
            "warm amber spotlight with a soft green stage wash, worn strings and "
            "scuffed leather strap."
        ),
    },
    "guns-and-roses": {
        "kind": "artist",
        "subject": (
            "A rock stage set with a deep red velvet drape, a chrome microphone stand "
            "flaring with bright white specular highlights, a black leather jacket "
            "draped over a stool and deep-red rose petals scattered with one pale "
            "cream rose on a warm grey floor."
        ),
    },
    "hanumankind": {
        "kind": "artist",
        "subject": (
            "Rough concrete textures and saffron-orange stage light with drifting "
            "dust, a black leather biker jacket on a polished chrome rail flaring "
            "with bright white specular highlights, and a folded ecru tee on a pale "
            "crate catching a hard white key light as the bright anchor, gritty "
            "street-rap energy."
        ),
    },
    "honey-singh": {
        "kind": "artist",
        "subject": (
            "Smoked grey velvet surface with layered gold chains, an amber spotlight "
            "and floating glitter, a folded cream tour jacket catching the warm light."
        ),
    },
    "krsna": {
        "kind": "artist",
        "subject": (
            "Violet neon haze around a heavyweight black hoodie hanging on a brushed "
            "steel rail, a hot rim light tracing the hood, and a folded cream tee on "
            "a pale shelf at the rail's base catching a clean white key light as the "
            "bright anchor, late-night cipher atmosphere."
        ),
    },
    "karan-aujla": {
        "kind": "artist",
        "subject": (
            "Deep red silk drapery behind a chrome rail with a heavyweight black tee, "
            "crimson carpet glow and drifting smoke, arena-entrance drama."
        ),
    },
    "lollapalooza-india": {
        "kind": "artist",
        "subject": (
            "A festival main stage between sets: steel truss, a teal and magenta "
            "light wash, bright white floodlights flaring over the stage, confetti "
            "in the air and a leather jacket on a stage case with a folded white tee "
            "beside it catching a hard white highlight as the bright anchor, in the "
            "foreground."
        ),
    },
    "shawn-mendes": {
        "kind": "artist",
        "subject": (
            "Soft sky-blue and sea-green stage wash on warm wooden stage boards, an "
            "open acoustic guitar case with a folded chambray shirt inside."
        ),
    },
    "sidhu-moosewala": {
        "kind": "artist",
        "subject": (
            "Warm amber light against a wheat-gold backdrop, an earthy brown leather "
            "jacket draped over a vintage wooden chair, dust drifting in the beam, "
            "tribute stillness."
        ),
    },
    "taylor-swift": {
        "kind": "artist",
        "subject": (
            "A glittering magenta-and-violet stage wash over sequined fabric and a "
            "rack of stage textiles, a beaded chain curtain catching the light, and "
            "a folded ivory silk garment in the foreground flaring bright white "
            "under a hard followspot as the bright anchor, stadium-tour glamour."
        ),
    },
    "john-summit": {
        "kind": "artist",
        "accent": "#FF6D00",
        "secondary": "#0A0A1A",
        "subject": (
            "A main-stage EDM rig on a lit set: orange laser fans through fog, "
            "glowing LED risers and a black bomber jacket on a pale grey flight case "
            "with a folded white tee on top catching a bright white highlight as the "
            "bright anchor, in the foreground."
        ),
    },
    "rishab-sharma": {
        "kind": "artist",
        "subject": (
            "Warm amber stage light over draped linen and a steel-string guitar "
            "resting on a black stage case, quiet solo-set atmosphere."
        ),
    },
    # --- cricket / anime figure collections (no ARTISTS entry) ---
    "csk": {
        "kind": "artist",
        "accent": "#F9CD05",
        "secondary": "#0081E9",
        "subject": (
            "A floodlit cricket ground from the boundary rope: a folded yellow "
            "cricket shirt and a leather ball on a black equipment case beside a "
            "willow bat, bright cool-white floodlight on a pale pitch."
        ),
    },
    "rcb": {
        "kind": "artist",
        "accent": "#D5152C",
        "secondary": "#0A0A0A",
        "subject": (
            "A floodlit cricket stadium edge under warm ember-red light: a folded "
            "dark cricket shirt, a worn leather ball and a willow bat resting on a "
            "pale stadium bench."
        ),
    },
    "virat": {
        "kind": "artist",
        "accent": "#1D4ED8",
        "secondary": "#FFFFFF",
        "subject": (
            "A cricket pitch edge under blue-tinted floodlights: a folded cricket "
            "shirt, batting gloves and a willow bat arranged on a stadium bench with "
            "chalk dust on the leather."
        ),
    },
    "ms-dhoni": {
        "kind": "artist",
        "accent": "#1D4ED8",
        "secondary": "#F9CD05",
        "subject": (
            "A stadium dugout under a single cool floodlight: a blue cricket jersey "
            "folded on a pale wooden bench beside batting gloves and a willow bat."
        ),
    },
    "naruto": {
        "kind": "artist",
        "accent": "#FF7F11",
        "secondary": "#0B1B3A",
        "subject": (
            "An orange-and-navy shinobi-themed still life: a rolled parchment scroll, "
            "folded black-and-orange fabric, a brushed-metal kunai-shaped paperweight "
            "and drifting ink-like smoke."
        ),
    },
    # --- categories (garment types) ---
    "accessories": {
        "kind": "category",
        "subject": (
            "A flat-lay of premium accessories on warm grey stone: an unstructured "
            "black cap, a folded canvas tote, a brushed steel water bottle and a "
            "black leather wallet."
        ),
    },
    "clothing": {
        "kind": "category",
        "subject": (
            "A matte black clothing rail holding a small capsule on wooden hangers: a "
            "heavyweight ecru tee, a charcoal overshirt and a deep-grey hoodie, the "
            "pale tee catching a bright hard key light as the bright anchor."
        ),
    },
    "crop-tops": {
        "kind": "category",
        "subject": (
            "A cropped black cotton tee hanging from a bronze rail, the cropped hem "
            "and ribbed fabric texture in sharp focus, beside a folded cream knit on "
            "a pale wooden shelf catching a bright white key light as the bright "
            "anchor."
        ),
    },
    "hoodies": {
        "kind": "category",
        "subject": (
            "A heavyweight black hoodie hanging on a matte black rail, raised hood and "
            "thick brushed-fleece texture in dramatic side light, with a folded ecru "
            "hoodie on a pale shelf below catching a bright white key light as the "
            "bright anchor."
        ),
    },
    "oversized": {
        "kind": "category",
        "subject": (
            "A plain off-white heavyweight oversized tee with dropped shoulders "
            "hanging on a matte black rail, exaggerated boxy drape, the ecru cotton "
            "catching a bright rim light along the shoulder seam and hem so the "
            "silhouette separates cleanly from the mid-tone backdrop."
        ),
    },
    "limited-edition": {
        "kind": "category",
        "subject": (
            "A folded ecru garment presented under a focused spotlight on a pale "
            "ivory stone plinth that glows against a clearly lit warm grey sweep as "
            "the bright anchor, a bronze rope barrier blurred in the foreground, "
            "gallery-like exclusivity."
        ),
    },
    "chill-guy-tshirt": {
        "kind": "category",
        # Deliberately not the 'chill guy' cartoon character: a copyrighted
        # character likeness is exactly what the no-faces rule rules out.
        "subject": (
            "A relaxed sand-coloured heavyweight tee draped over a canvas stool with "
            "warm low-sun key light, a folded newspaper and a takeaway coffee cup on "
            "the studio floor nearby."
        ),
    },
    "kaleshi-aurat": {
        "kind": "category",
        "accent": "#9B1B30",
        "secondary": "#D4AF37",
        "subject": (
            "Festive Indian couture still life: deep maroon silk with dense antique-"
            "gold embroidery, an embroidered dupatta draped over a warm timber table "
            "and brass bangles in soft focus."
        ),
    },
    "rainbow-reflector-coldplay-single-side-print": {
        "kind": "category",
        "accent": "#FFD700",
        "secondary": "#00E5FF",
        "subject": (
            "Iridescent rainbow reflector fabric catching a hard camera flash on "
            "black, an oil-slick holographic sheen rolling across the folds with "
            "bright white specular flares bursting off the ridges, one folded pale "
            "ivory garment beside the reflector fabric glowing under the flash as "
            "the bright anchor, the print surface left perfectly blank."
        ),
    },
    # --- store collections ---
    "bestsellers": {
        "kind": "store",
        "subject": (
            "A single heavyweight black tee on a bronze hanger under a hard spotlight "
            "on a warm grey set, dense cotton weave carrying a subtle warm sheen, "
            "above a neat stack of folded cream and ecru tees catching the spill "
            "light as the bright anchor."
        ),
    },
    "new-arrivals": {
        "kind": "store",
        "subject": (
            "A folded plain black concert tee emerging from cream tissue paper inside "
            "an open matte kraft box on a warm grey studio table, a bronze ribbon and "
            "a second box stacked alongside."
        ),
    },
    "all": {
        "kind": "store",
        "subject": (
            "A dense rail of plain white, black and grey concert tees on a clearly "
            "lit warm grey set, the front white tees catching a bright hard key "
            "light as the bright anchor, shallow depth of field with the front "
            "garments in sharp focus."
        ),
    },
    "home-page-trending": {
        "kind": "store",
        "subject": (
            "A hero tee on a matte black pedestal with long light streaks sweeping the "
            "background and haze catching the beam, kinetic energy."
        ),
    },
    "premium-store": {
        "kind": "store",
        "subject": (
            "A matte black presentation box with bronze edge trim, its lid open on a "
            "spill of bright ivory tissue paper catching the spotlight, beside folded "
            "cream silk on a pale polished stone surface."
        ),
    },
    "random-designs": {
        "kind": "store",
        "subject": (
            "A loose stack of folded plain tees in mixed colours beside a kraft mailer "
            "and crumpled tissue paper on a warm grey table, surprise-package mood."
        ),
    },
    "tshirts-adt": {
        "kind": "store",
        "subject": (
            "A neat stack of folded plain heavyweight tees in ecru, cream, charcoal "
            "and black on a warm grey studio bench, the pale top tee catching a "
            "bright hard key light as the bright anchor, one tee folded over a "
            "wooden hanger at the side."
        ),
    },
}


# 2026-10-03 owner direction: covers must depict the collection's actual
# subject, so figure collections get a person in frame with the artist's or
# athlete's signature iconography (look, instrument, wardrobe, stage). The
# entries here merge over COLLECTION_THEMES (same shape, plus `figure: True`
# selecting PROMPT_TEMPLATE_FIGURE); anything not listed keeps its curated
# still life. Names stay out of the prompts on purpose: image models refuse or
# mangle photoreal celebrity likenesses, so each figure is pinned by their
# unmistakable look and props instead.
COLLECTION_THEME_UPDATES: dict[str, dict[str, object]] = {
    # --- artists ---
    "alan-walker": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A masked DJ in a black hoodie with the hood up and a matte black "
            "face-concealing mask, head bowed over a glowing DJ deck in a foggy "
            "booth, cyan laser beams and cold haze around him, all mixer and deck "
            "surfaces blank matte panels with no labels or markings, a pale grey "
            "flight case catching a bright white key light in the foreground as the "
            "bright anchor."
        ),
    },
    "coldplay": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "The band's frontman alone seated at a plain glossy white grand piano "
            "with a completely blank, unmarked fallboard, on a glowing arena "
            "stage: he is clean-shaven with short sandy-blond tousled hair "
            "exactly like the reference, turned toward the camera with his face "
            "clearly visible and warmly lit as he plays and sings, golden "
            "confetti drifting through warm haze and a sea of tiny glowing LED "
            "wristbands glowing far below the stage behind him, the piano lid "
            "catching a bright specular flare as the bright anchor."
        ),
    },
    "diljit-dosanjh": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A bearded Punjabi singer in a neatly tied navy turban and an elegant "
            "black high-collar stage sherwani, one arm raised mid-song on a festival "
            "stage through orange smoke and white-hot sparkler flares, a cream silk "
            "scarf draped over his shoulder catching the bright key light as the "
            "bright anchor, celebratory Punjabi night-concert energy."
        ),
    },
    "dua-lipa": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A female pop star with long dark hair in a disco-ball-sequinned "
            "mini-dress mid-dance-pose under a giant mirror ball, pink and violet "
            "neon glow with mirror-tile sparkles scattered across the frame, a pale "
            "satin jacket slung on a stool beside her flaring bright white as the "
            "bright anchor."
        ),
    },
    "ed-sheeran": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A red-haired, fully bearded singer-songwriter in a plain black tee "
            "singing into a stage mic while strumming an acoustic guitar, a loop "
            "pedalboard at his feet, warm amber spotlight with a soft green wash "
            "over wooden stage boards, an open pale ecru guitar case propped beside "
            "him flaring bright white under the spotlight as the bright anchor and "
            "the pale spruce guitar top catching a hard highlight."
        ),
    },
    "guns-and-roses": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A hard-rock stage with only a deep red velvet drape and hanging stage "
            "lights behind -- no amplifiers, no speaker stacks, no drum kit, no "
            "equipment cases anywhere in frame: at centre a singer with long "
            "strawberry-blond hair in a plain solid-black bandana with no pattern "
            "or writing and a dark leather outfit gripping a chrome microphone "
            "stand, his face clearly visible and lit, and beside him a guitarist "
            "in a plain black top hat, dark sunglasses and curly hair playing a "
            "plain sunburst Les Paul guitar with a completely unmarked headstock, "
            "bright white speculars flaring off the chrome and a single pale "
            "cream rose on the stage floor catching the key light as the bright "
            "anchor."
        ),
    },
    "hanumankind": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A medium close-up of a bearded Indian rapper wearing a plain "
            "solid-black baseball cap with no embroidery or logo and an oversized "
            "plain black tee, standing tall and facing the camera with a mic in "
            "hand mid-verse on a raw concrete club floor, his face large in the "
            "frame and clearly visible under warm saffron-orange stage light "
            "cutting through drifting dust, a plain ecru towel with no lettering "
            "draped over his shoulder and a plain black wristband on his wrist, "
            "catching a hard white key light as the bright anchor, gritty "
            "street-rap energy."
        ),
    },
    "honey-singh": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "An Indian rap star with slicked-back gelled hair, dark sunglasses and "
            "a short beard, wearing layered gold chains with a large pendant over "
            "an open black sequinned shirt, one hand raised to the crowd under an "
            "amber spotlight with floating gold glitter, his face clearly visible "
            "and lit, a cream tour jacket over a pale stool in the foreground "
            "catching the warm light as the bright anchor."
        ),
    },
    "krsna": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A medium close-up of an Indian rapper wearing a navy baseball cap and "
            "a heavyweight black hoodie, hood down, gripping a mic close and "
            "rapping intently straight toward the camera in violet neon haze, a "
            "bank of white stage strobes flaring behind him, a hot rim light "
            "tracing the cap and shoulders, his lean bearded face large in the "
            "frame, clearly visible and lit as the focal point."
        ),
    },
    "karan-aujla": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A bearded Punjabi singer in a black designer streetwear fit and gold "
            "watch striding toward the mic on a crimson-carpet arena stage, deep red "
            "silk drapery and drifting smoke behind him, a pale creamvarsity jacket "
            "on a chrome rail at the frame's edge catching a bright key light as the "
            "bright anchor."
        ),
    },
    "lollapalooza-india": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A festival headliner silhouetted arms-wide on a huge main stage between "
            "steel truss towers, teal and magenta light wash, bright white floodlight "
            "flares and confetti over a vast crowd, a leather jacket and folded white "
            "tee on a stage case in the foreground catching a hard white highlight as "
            "the bright anchor."
        ),
    },
    "shawn-mendes": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A young male pop singer with dark tousled curls and sharp features in "
            "an open chambray denim shirt, seated on a stool facing the camera "
            "while playing an acoustic guitar and singing into a vintage mic, his "
            "face clearly visible and softly lit, soft sky-blue and sea-green "
            "stage wash over warm wooden boards, the pale guitar top and open "
            "guitar case catching a bright gentle highlight as the bright anchor."
        ),
    },
    "sidhu-moosewala": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A bearded Punjabi singer in a navy turban, sunglasses and an earthy "
            "brown leather jacket, gripping a vintage chrome microphone under warm "
            "amber light against a wheat-gold backdrop with dust drifting in the "
            "beam, a folded cream scarf on a wooden chair beside him catching the "
            "key light as the bright anchor, tribute stillness."
        ),
    },
    "taylor-swift": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A blonde female pop superstar in a sparkling magenta sequinned "
            "bodysuit and knee-high boots, mid-stride with an outstretched arm on a "
            "runway stage inside a glittering stadium, magenta-and-violet wash, "
            "beaded curtain shimmer and drifting confetti, a folded ivory silk "
            "garment on the runway flaring bright white under a hard followspot as "
            "the bright anchor, stadium-tour glamour."
        ),
    },
    "john-summit": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A young DJ in a plain white tee and black cap, one hand thrown up over "
            "matte-black CDJ decks and a mixer with completely blank faces -- no "
            "labels, logos or lettering anywhere on the equipment -- in a warehouse "
            "rave, orange laser fans cutting fog behind him and a crowd silhouette "
            "below, his face clearly visible and lit, a pale grey flight case at "
            "the booth's base catching a bright white highlight as the bright "
            "anchor."
        ),
    },
    "rishab-sharma": {
        "kind": "artist",
        "figure": True,
        "subject": (
            "A young Indian man -- clearly male, with short dark hair and a trimmed "
            "beard exactly as in the reference -- wearing a cream kurta, seated "
            "cross-legged on a carpeted stage playing a sitar, his face clearly "
            "visible and lit under a single warm amber spotlight, draped linen and "
            "soft haze around him, the pale kurta catching the key light as the "
            "bright anchor, quiet solo-set atmosphere."
        ),
    },
    # --- cricket ---
    "virat": {
        "kind": "artist",
        "figure": True,
        "accent": "#1D4ED8",
        "secondary": "#FFFFFF",
        "subject": (
            "An Indian cricketer with the exact short quiff hairstyle and trimmed "
            "beard of the reference, in a plain blue cricket jersey, both arms "
            "raised high in celebration after a century with bare hands -- no "
            "gloves, no bat, no gear anywhere in the frame -- floodlit night "
            "stadium behind, golden confetti and chalk dust in the air, the pale "
            "sightscreen flaring bright as the bright anchor."
        ),
    },
    "ms-dhoni": {
        "kind": "artist",
        "figure": True,
        "accent": "#1D4ED8",
        "secondary": "#F9CD05",
        "subject": (
            "An Indian wicketkeeper-batsman with the exact very-short cropped "
            "black hair of the reference and his sharp jawline, athletic build, "
            "in a plain blue cricket jersey with completely plain white batting "
            "gloves, standing tall in a floodlit stadium dugout entrance with one "
            "gloved fist raised in celebration and his helmet held in the other "
            "hand -- no bat anywhere in frame -- his face clearly visible under "
            "cool white floodlight with warm gold sparkle behind, a pale wooden "
            "bench and a plain folded cream towel catching the light as the "
            "bright anchor."
        ),
    },
    "csk": {
        "kind": "artist",
        "figure": True,
        "accent": "#F9CD05",
        "secondary": "#0081E9",
        "subject": (
            "A batsman in a plain bright-yellow cricket jersey mid power-hit on a "
            "floodlit night pitch, golden confetti drifting and yellow smoke "
            "swirling, a cheering yellow-clad crowd blurred behind, a willow bat and "
            "white ball resting on a pale equipment case in the foreground catching "
            "a bright cool-white floodlight as the bright anchor, lion-hearted "
            "yellow-army energy."
        ),
    },
    "rcb": {
        "kind": "artist",
        "figure": True,
        "accent": "#D5152C",
        "secondary": "#0A0A0A",
        "subject": (
            "A batsman in a plain dark-red cricket jersey and black helmet playing "
            "an aggressive lofted drive under warm ember-red floodlights, sparks of "
            "confetti and red flare smoke at the boundary, a worn leather ball and "
            "willow bat resting on a pale stadium bench catching a hard white "
            "highlight as the bright anchor."
        ),
    },
    "naruto": {
        "kind": "artist",
        "figure": True,
        "accent": "#FF7F11",
        "secondary": "#0B1B3A",
        "subject": (
            "An anime-style young ninja with spiky blond hair and whisker cheek "
            "marks in an orange-and-black high-collar jacket, mid action pose "
            "forming a hand sign with a swirl of blue chakra energy and drifting "
            "ink-brush smoke, dynamic shonen anime illustration style, a rolled "
            "parchment scroll at his feet catching a bright highlight as the bright "
            "anchor."
        ),
    },
    "chill-guy-tshirt": {
        "kind": "category",
        "raw_prompt": (
            "Flat 2D vector cartoon sticker illustration of the relaxed cartoon dog "
            "meme: a brown cartoon dog with a slightly smug half-smile and "
            "half-lidded relaxed eyes, standing upright on two legs, both cartoon "
            "hands tucked into the front pockets of its blue jeans, wearing a plain "
            "cream crewneck sweater and simple sneakers. The whole image is drawn "
            "like a die-cut vinyl sticker: thick uniform dark outlines around every "
            "shape, completely flat solid fills, zero gradients, zero shading, zero "
            "texture, no depth of field, no lighting effects, no shadows on the "
            "ground, a plain flat warm-grey square background, the cream sweater "
            "the brightest flat shape. Graphic-design sticker asset, screen-print "
            "art style, entire figure fully inside the frame with an even margin."
        ),
    },
}


# Merge the owner-directed figure themes over the curated still lifes.
COLLECTION_THEMES.update(COLLECTION_THEME_UPDATES)


# Reference photographs (R2 `collections/refs/<handle>.webp`, sourced from the
# local artist hero portraits in frontend/public/artists plus Wikimedia press
# photos for the cricketers/DJs and R2 product prints for merch-art subjects).
# When a handle has references, generation switches to Agnes's image-edit mode
# (`extra_body.image`) and build_prompt prepends the identity clause, so the
# depicted face matches the real person instead of an AI invention (2026-10-03
# owner direction: "use reference images such that faces match exactly").
REFERENCE_IMAGES: dict[str, list[str]] = {
    "alan-walker": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/alan-walker.webp"],
    "coldplay": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/coldplay.webp"],
    "diljit-dosanjh": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/diljit-dosanjh.webp"],
    "dua-lipa": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/dua-lipa.webp"],
    "ed-sheeran": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/ed-sheeran.webp"],
    "guns-and-roses": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/guns-and-roses.webp"],
    "hanumankind": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/hanumankind.webp"],
    "honey-singh": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/honey-singh.webp"],
    "karan-aujla": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/karan-aujla.webp"],
    "krsna": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/krsna.webp"],
    "shawn-mendes": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/shawn-mendes.webp"],
    "sidhu-moosewala": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/sidhu-moosewala.webp"],
    "taylor-swift": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/taylor-swift.webp"],
    "virat": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/virat.webp"],
    "ms-dhoni": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/ms-dhoni.webp"],
    "john-summit": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/john-summit.webp"],
    "naruto": ["https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/collections/refs/naruto.webp"],
    # Merch-art subjects: the collection's own product photography is the truth
    # the cover has to match, so their refs point at R2 product images.
    "rishab-sharma": [
        "https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/products/rishab-rikhiram-sharma-premium-concert-t-shirt-luxury-double-sided-print-design/05.webp"
    ],
    "chill-guy-tshirt": [
        "https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/products/chill-guy-tshirt/ai-angle-0.webp"
    ],
}

IDENTITY_CLAUSE = (
    "Use the attached reference photograph: the person must be unmistakably the "
    "same real person as in the reference -- identical facial structure, eyes, "
    "nose, jawline, hairstyle and facial hair -- with the face clearly visible, "
    "fronting the camera and lit so every feature reads. Render the face with "
    "sharp photographic fidelity to the reference; do not idealise, beautify, "
    "age, slim or otherwise alter it. Every single surface in the frame -- "
    "clothing, gear, instruments, accessories, wristbands, bands, cases, "
    "instruments' bodies -- is completely blank: no lettering, numbers, "
    "stickers, crests or brand marks anywhere; where a real object would carry "
    "writing, omit the writing and show the plain surface instead. "
)
ARTWORK_CLAUSE = (
    "The character must match the attached reference artwork exactly: same "
    "design, colours, proportions, outfit and art style, recognisable as the "
    "same character at first glance. "
)


class AgnesError(RuntimeError):
    """One failed Agnes response, with the retry decision attached."""

    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code  # 0 = network/transport failure

    @property
    def retryable(self) -> bool:
        return self.code in (0, 429) or self.code >= 500

    @property
    def fatal(self) -> bool:
        # 401 bad key, 402 quota/window exhausted, 403 model not on the key:
        # retrying cannot help, and continuing would burn the whole batch.
        return self.code in (401, 402, 403)


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def load_artist_palettes(path: Path = DB_TYPES_PATH) -> dict[str, dict[str, str]]:
    """Parse the ARTISTS record out of packages/db-types/src/index.ts.

    The TS file is the storefront's single source for artist names and brand
    colours, so reading it here keeps one source of truth instead of copying
    the palette table into Python. Returns {} (with a warning) when the file or
    the record is missing -- covers then fall back to the house palette.
    """
    artists: dict[str, dict[str, str]] = {}
    try:
        source = path.read_text(encoding="utf-8")
    except OSError as error:
        print(f"WARN: could not read {path}: {error}; using the house palette")
        return artists

    start = source.find("export const ARTISTS")
    if start == -1:
        print(f"WARN: no ARTISTS record in {path}; using the house palette")
        return artists

    entry_re = re.compile(r"handle:\s*'([^']+)'(.*?)\n  \}", re.S)

    def field(body: str, name: str) -> str:
        match = re.search(name + r":\s*(?:'([^']*)'|\"([^\"]*)\")", body)
        return (match.group(1) or match.group(2)) if match else ""

    for match in entry_re.finditer(source[start:]):
        handle, body = match.group(1), match.group(2)
        artists[handle] = {
            "name": field(body, "name"),
            "accent": field(body, "accentColor"),
            "secondary": field(body, "secondaryColor"),
        }
    if not artists:
        print(f"WARN: ARTISTS record in {path} parsed to zero entries")
    return artists


def classify(handle: str, artist_handles: dict[str, dict[str, str]]) -> str:
    """One of 'artist' | 'category' | 'store' for a collection handle."""
    theme = COLLECTION_THEMES.get(handle, {})
    if theme.get("kind"):
        return theme["kind"]
    if handle in artist_handles or handle in FIGURE_HANDLES:
        return "artist"
    if handle in STORE_HANDLES:
        return "store"
    return "category"


def build_prompt(row: dict, artists: dict[str, dict[str, str]]) -> tuple[str, str]:
    """Return (prompt, kind) for one collections row."""
    handle = row.get("handle") or f"collection-{row.get('id')}"
    title = row.get("title") or handle
    theme = COLLECTION_THEMES.get(handle, {})
    kind = classify(handle, artists)

    palette = artists.get(theme.get("artist") or handle, {})
    accent = theme.get("accent") or palette.get("accent") or HOUSE_ACCENT
    secondary = theme.get("secondary") or palette.get("secondary") or HOUSE_SECONDARY

    if theme.get("raw_prompt"):
        # A handful of subjects (flat-cartoon styles) need a template-free prompt:
        # the figure template's stage-light language drags the model back into
        # photoreal 3D. `raw_prompt` is used verbatim plus the text/brand ban.
        prompt = theme["raw_prompt"]
        if handle in REFERENCE_IMAGES:
            prompt = ARTWORK_CLAUSE + prompt
        return prompt + " " + NO_TEXT_NO_FACES, kind
    subject = theme.get("subject") or DEFAULT_SUBJECTS[kind].format(
        title=title, accent=accent
    )
    if handle in REFERENCE_IMAGES:
        subject = IDENTITY_CLAUSE + subject
    template = PROMPT_TEMPLATE_FIGURE if theme.get("figure") else PROMPT_TEMPLATE
    return template.format(subject=subject, accent=accent, secondary=secondary), kind


# ---------------------------------------------------------------------------
# Agnes transport
# ---------------------------------------------------------------------------

def agnes_config() -> tuple[str, str, str]:
    """(base_url, image_model, api_key) with the repo's documented defaults."""
    base_url = (os.getenv("AGNES_BASE_URL") or AGNES_DEFAULT_BASE_URL).rstrip("/")
    model = os.getenv("AGNES_IMAGE_MODEL") or AGNES_DEFAULT_IMAGE_MODEL
    return base_url, model, os.getenv("AGNES_AI_API_KEY") or ""


def _png_from_response(payload: dict) -> bytes:
    """PNG bytes from an Agnes image response (url download or b64_json)."""
    items = payload.get("data") or []
    if not items or not isinstance(items[0], dict):
        raise AgnesError(0, "response contained no image data")
    item = items[0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    url = item.get("url")
    if not url:
        raise AgnesError(0, "response item had neither url nor b64_json")
    try:
        download = requests.get(url, timeout=DOWNLOAD_TIMEOUT)
        download.raise_for_status()
    except requests.RequestException as error:
        raise AgnesError(0, f"could not download the generated image: {error}") from error
    return download.content


def generate_image(
    prompt: str,
    base_url: str,
    model: str,
    api_key: str,
    refs: list[str] | None = None,
) -> bytes:
    """One text-to-image generation; returns the PNG bytes.

    `response_format` MUST sit under `extra_body` -- at the top level Agnes
    rejects the request (same contract as admin-dashboard/src/lib/ai/agnes.ts).
    With `refs` (public image URLs) the call becomes an image-edit/reference
    generation: the same endpoint takes the sources under `extra_body.image`,
    exactly like the admin's `buildImageEditBody`.
    """
    extra_body: dict = {"response_format": "url"}
    if refs:
        # Reference mode must stream back b64 (verified in the admin) and hand
        # the source URLs for Agnes to fetch.
        extra_body = {"response_format": "b64_json", "image": refs}
    body = {
        "model": model,
        "prompt": prompt,
        "size": IMAGE_SIZE,
        "ratio": IMAGE_RATIO,
        "extra_body": extra_body,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    error: AgnesError | None = None

    for delay in BACKOFF_DELAYS + (None,):
        if delay:
            time.sleep(delay)
        try:
            response = requests.post(
                f"{base_url}/images/generations",
                json=body,
                headers=headers,
                timeout=GENERATION_TIMEOUT,
            )
            if response.status_code == 200:
                return _png_from_response(response.json())
            snippet = (response.text or "").strip()[:200]
            error = AgnesError(
                response.status_code, f"HTTP {response.status_code}: {snippet}"
            )
            if error.fatal:
                raise error
        except requests.RequestException as request_error:
            error = AgnesError(0, f"network error: {request_error}")
        if error is None or not error.retryable:
            break

    raise error or AgnesError(0, "image generation failed")


def _generate_task(
    row: dict,
    prompt: str,
    config: tuple[str, str, str],
    refs: list[str] | None = None,
) -> dict:
    """Thread worker: generate one cover, never raising (the batch reads keys)."""
    started = time.monotonic()
    try:
        png = generate_image(prompt, *config, refs=refs)
    except AgnesError as error:
        return {
            "row": row,
            "prompt": prompt,
            "png": None,
            "error": str(error),
            "fatal": error.fatal,
            "seconds": None,
        }
    return {
        "row": row,
        "prompt": prompt,
        "png": png,
        "error": None,
        "fatal": False,
        "seconds": round(time.monotonic() - started, 1),
    }


def run_batches(tasks: list[dict], workers: int, stop: threading.Event):
    """Generate `tasks` in small batches; yields each result as it lands.

    A fatal error (bad key / exhausted quota) sets `stop` so the remaining
    batches are not sent.
    """
    config = agnes_config()
    for start in range(0, len(tasks), workers):
        if stop.is_set():
            return
        batch = tasks[start:start + workers]
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_generate_task, t["row"], t["prompt"], config,
                                   t.get("refs"))
                       for t in batch]
            for future in as_completed(futures):
                result = future.result()
                if result["fatal"]:
                    stop.set()
                yield result


# ---------------------------------------------------------------------------
# Objective contrast gate
# ---------------------------------------------------------------------------
#
# Why this exists: the storefront card is `aspect-[4/3]` and only ~320x240 CSS
# px in a 1440px three-up grid, and the browser downscale throws away most of
# the local contrast an editor sees at 2304x1728. A cover whose mid-tones sit
# near black reads as a featureless dark rectangle at card size, which is what
# happened to the v1 'oversized' sample. The gate is measured on the full
# frame plus the central 50% box (where `object-cover` keeps the subject when
# the 4:3 source is drawn into a 4:3 card at any size).
#
# Calibrated on the three v1 reference images (scripts/collection_covers_preview/v1/):
#   oversized     p50 12  p75 22  p99 43   >120 0.1%   centre sd 14  -> FAIL
#   coldplay      p50 17  p75 41  p99 164  >120 2.1%   centre sd 34  -> FAIL
#   new-arrivals  p50 22  p75 45  p99 214  >120 10.7%  centre sd 75  -> PASS (control)
# Thresholds are the suggested starting points; they are kept as-is because they
# separate the two rejected v1 samples from the one the owner accepted, with the
# control's only tight margin on p75 (45 vs 45 -- the revised template targets a
# lit backdrop, so v2 samples should clear it comfortably).
GATE_MIN_P75 = 45.0             # 3/4 of the frame clearly above black
GATE_MIN_BRIGHT_FRACTION = 8.0  # % of pixels above level 120 (real highlights)
GATE_MIN_P99 = 190.0            # at least some specular / rim highlights
GATE_MIN_CENTRE_SD = 25.0       # the 320x240 crop must not be a flat block
GATE_BRIGHT_LEVEL = 120         # the level the bright-fraction check counts


def measure_image(image: Image.Image) -> dict[str, float]:
    """Luminance statistics the contrast gate is decided on.

    Greyscale via Pillow's ITU-R 601-2 luma transform; percentiles and
    threshold fractions over the whole frame; the centre figure is the central
    50% box (what `object-cover` shows in the card). Deterministic, no writes.
    """
    array = np.asarray(image.convert("L"), dtype=np.float64)
    height, width = array.shape
    p50, p75, p95, p99 = (float(value) for value in np.percentile(array, (50, 75, 95, 99)))
    crop_h, crop_w = max(1, int(height * 0.5)), max(1, int(width * 0.5))
    y0, x0 = (height - crop_h) // 2, (width - crop_w) // 2
    centre = array[y0:y0 + crop_h, x0:x0 + crop_w]
    return {
        "p50": p50,
        "p75": p75,
        "p95": p95,
        "p99": p99,
        "gt80": float((array > 80).mean() * 100.0),
        "gt120": float((array > GATE_BRIGHT_LEVEL).mean() * 100.0),
        "gt200": float((array > 200).mean() * 100.0),
        "centre_mean": float(centre.mean()),
        "centre_sd": float(centre.std()),
    }


def measure_cover(path: Path) -> dict[str, float]:
    """Measure an already-downloaded cover file."""
    with Image.open(path) as image:
        return measure_image(image)


def measure_bytes(png_bytes: bytes) -> dict[str, float]:
    """Measure a freshly generated cover before it is written or uploaded."""
    with Image.open(io.BytesIO(png_bytes)) as image:
        return measure_image(image)


def gate_cover(metrics: dict[str, float]) -> tuple[bool, list[str]]:
    """(passed, failure reasons) against the GATE_* constants."""
    failures = []
    if metrics["p75"] < GATE_MIN_P75:
        failures.append(f"p75 {metrics['p75']:.0f} < {GATE_MIN_P75:.0f}")
    if metrics["gt120"] < GATE_MIN_BRIGHT_FRACTION:
        failures.append(f">120 {metrics['gt120']:.1f}% < {GATE_MIN_BRIGHT_FRACTION:.0f}%")
    if metrics["p99"] < GATE_MIN_P99:
        failures.append(f"p99 {metrics['p99']:.0f} < {GATE_MIN_P99:.0f}")
    if metrics["centre_sd"] < GATE_MIN_CENTRE_SD:
        failures.append(f"centre sd {metrics['centre_sd']:.0f} < {GATE_MIN_CENTRE_SD:.0f}")
    return (not failures), failures


def format_metrics(metrics: dict[str, float]) -> str:
    """One-line metrics string for the run report and --qa-only."""
    return (
        f"p50 {metrics['p50']:.0f} p75 {metrics['p75']:.0f} p95 {metrics['p95']:.0f} "
        f"p99 {metrics['p99']:.0f} | >80 {metrics['gt80']:.1f}% "
        f">120 {metrics['gt120']:.1f}% >200 {metrics['gt200']:.1f}% | "
        f"centre {metrics['centre_mean']:.0f}/{metrics['centre_sd']:.0f}"
    )


# ---------------------------------------------------------------------------
# Delivery + database helpers
# ---------------------------------------------------------------------------

def url_status(url: str, timeout: int = URL_CHECK_TIMEOUT) -> int:
    """HTTP status of a delivered URL; 0 when the request itself failed."""
    if not url:
        return 0
    try:
        response = requests.get(url, timeout=timeout, stream=True, allow_redirects=True)
    except requests.RequestException:
        return 0
    try:
        return response.status_code
    finally:
        response.close()


def build_alt(row: dict) -> str:
    """Alt text written with every cover: "<Collection title> — YORD India".

    Capped at ALT_MAX_LEN -- the em-dash suffix survives truncation -- and
    never empty: a row with no title falls back to its handle.
    """
    title = (row.get("title") or "").strip() or (row.get("handle") or "collection").strip()
    alt = f"{title}{ALT_SUFFIX}"
    if len(alt) > ALT_MAX_LEN:
        alt = title[: ALT_MAX_LEN - len(ALT_SUFFIX)].rstrip() + ALT_SUFFIX
    return alt


def patch_collection(supabase, collection_id: int, payload: dict) -> str:
    """Apply a `collections` update; returns "" on success or an error message."""
    try:
        response = supabase.table("collections").update(payload).eq("id", collection_id).execute()
    except Exception as error:  # supabase-py raises on transport/HTTP failures
        return str(error)
    if not response.data:
        return "update matched no row"
    return ""


def describe_src(row: dict) -> str:
    """Readable state of the legacy Shopify cover URL."""
    src = row.get("image_src") or ""
    if not src:
        return "none"
    scheme = "http (mixed content)" if src.startswith("http://") else "https"
    return f"legacy {scheme}: {src[:64]}"


def collection_needs_cover(row: dict) -> bool:
    """True unless the row already has a storage URL that resolves 200."""
    storage = row.get("storage_image_url") or ""
    if not storage:
        return True
    return url_status(storage) != 200


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

DESCRIPTION = (
    "Generate collection cover images with Agnes AI, upload them to R2 "
    "(collections/<handle>.webp) and write collections.storage_image_url"
)


def build_parser():
    parser = create_parser(DESCRIPTION, default_checkpoint=CHECKPOINT_FILE)
    # The shared flag has no row-batch meaning here; it maps to generation
    # concurrency (2K images allow 80 RPM, so a handful of workers is plenty).
    parser.set_defaults(batch_size=DEFAULT_WORKERS)
    for action in parser._actions:  # noqa: SLF001 -- retitle the shared --batch-size
        if action.dest == "batch_size":
            action.help = (
                "Images generated concurrently, "
                f"1-{MAX_WORKERS} (default: {DEFAULT_WORKERS})"
            )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="HANDLE",
        help="Only this collection handle; repeatable or comma-separated (forces generation)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        metavar="N",
        help="Stop after N collections (applied after --only)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help=(
            "Generate local samples into scripts/collection_covers_preview/ and write "
            "nothing to R2 or the database"
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate even when the cover already exists (DB, checkpoint or preview file)",
    )
    parser.add_argument(
        "--allow-low-contrast",
        action="store_true",
        help=(
            "Upload and record a cover that fails the contrast gate (it is named as "
            "GATE-FAIL in the report) instead of holding it back"
        ),
    )
    parser.add_argument(
        "--qa-only",
        action="store_true",
        help=(
            "Do not generate: re-measure already-downloaded covers and print the "
            "PASS/FAIL table, then exit"
        ),
    )
    parser.add_argument(
        "--qa-dir",
        action="append",
        default=[],
        metavar="DIR",
        help=(
            "Directory of .png covers for --qa-only, searched recursively; repeatable "
            f"(default: {ORIGINALS_DIR.name}/ and {PREVIEW_DIR.name}/)"
        ),
    )
    return parser


def qa_only(dirs: list[Path]) -> int:
    """Re-measure already-downloaded covers and print the PASS/FAIL table."""
    images = sorted(path for directory in dirs for path in directory.rglob("*.png"))
    if not images:
        print(f"no .png covers under: {', '.join(str(d) for d in dirs)}")
        return 1
    failures = 0
    for path in images:
        metrics = measure_cover(path)
        passed, reasons = gate_cover(metrics)
        if not passed:
            failures += 1
        print(f"{'PASS' if passed else 'FAIL'}  {path}")
        print(f"      {format_metrics(metrics)}" + (f"  [{'; '.join(reasons)}]" if reasons else ""))
    print(f"\nqa: {len(images)} image(s), {failures} FAIL, {len(images) - failures} PASS")
    return 1 if failures else 0


def selected_rows(rows: list[dict], only: list[str], force: bool = False):
    """[(row, forced)] -- explicit handles win, otherwise only rows needing a cover."""
    if only:
        by_handle = {row.get("handle"): row for row in rows}
        unknown = [handle for handle in only if handle not in by_handle]
        if unknown:
            available = ", ".join(sorted(h for h in by_handle if h))
            return None, f"unknown handle(s): {', '.join(unknown)}\nknown handles: {available}"
        return [(by_handle[handle], True) for handle in only], ""

    if force:
        # --force means regenerate everything, matching its --help wording.
        return [(row, True) for row in rows], ""

    return [(row, False) for row in rows if collection_needs_cover(row)], ""


def print_plan(plan: list[dict]) -> None:
    counts: dict[str, int] = {}
    unpublished = []
    for item in plan:
        counts[item["kind"]] = counts.get(item["kind"], 0) + 1
        if not item["row"].get("published"):
            unpublished.append(item["row"].get("handle"))
    print(
        f"Plan: {len(plan)} collection(s) -- "
        + ", ".join(f"{kind}: {count}" for kind, count in sorted(counts.items()))
    )
    if unpublished:
        print(f"Note: {len(unpublished)} unpublished (not in the storefront grid): "
              f"{', '.join(sorted(unpublished))}")
    print(f"Output: R2 {public_url_host() or '(R2_PUBLIC_BASE_URL unset)'}/"
          f"{KEY_PREFIX}/<handle>.webp via {IMAGE_SIZE} {IMAGE_RATIO}\n")
    for item in plan:
        row = item["row"]
        forced = " [--only]" if item["forced"] else ""
        print(f"--- {row.get('handle')} | {row.get('title')} | {item['kind']}{forced}")
        print(f"    image_src: {describe_src(row)}")
        print(f"    prompt: {item['prompt']}\n")


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def preview_covers(
    plan: list[dict],
    workers: int,
    force: bool,
    stop: threading.Event,
    allow_low_contrast: bool,
) -> int:
    """Generate locally; never touches R2, the database or the checkpoint."""
    if not os.getenv("AGNES_AI_API_KEY"):
        print("FAIL: AGNES_AI_API_KEY is not set (root .env); cannot generate.")
        return 1
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"PREVIEW: local files only -> {PREVIEW_DIR}")
    print("PREVIEW: no R2 upload, no database write, no checkpoint write.\n")

    tasks = []
    failed = 0
    for item in plan:
        handle = item["row"].get("handle")
        target = PREVIEW_DIR / f"{handle}.png"
        if target.exists() and not force:
            print(f"SKIP {handle}: {target} exists (pass --force to regenerate)")
            continue
        tasks.append(item | {"refs": REFERENCE_IMAGES.get(handle, [])})

    generated = []
    gated = 0
    for result in run_batches(tasks, workers, stop):
        row = result["row"]
        handle = row.get("handle")
        if result["png"] is None:
            failed += 1
            print(f"FAIL {handle}: {result['error']}")
            continue
        target = PREVIEW_DIR / f"{handle}.png"
        target.write_bytes(result["png"])
        (PREVIEW_DIR / f"{handle}.prompt.txt").write_text(result["prompt"] + "\n")
        generated.append(handle)
        metrics = measure_bytes(result["png"])
        passed, reasons = gate_cover(metrics)
        if not passed:
            gated += 1
        print(
            f"{'PASS' if passed else 'GATE-FAIL'} {handle:36} {target.name} "
            f"({len(result['png']) / 1024:.0f} KB, {result['seconds']}s) "
            f"{format_metrics(metrics)}"
        )
        if not passed:
            print(f"      reasons: {'; '.join(reasons)}")
            if allow_low_contrast:
                print("      kept for review (--allow-low-contrast)")

    print(
        f"\nPreview done: {len(generated)} generated ({gated} below the contrast gate), "
        f"{failed} failed -> {PREVIEW_DIR}"
    )
    if gated and not allow_low_contrast:
        print(
            f"{gated} sample(s) failed the contrast gate: revise the subject or pass "
            "--allow-low-contrast to accept them."
        )
        return 1
    return 1 if failed else 0


def execute_covers(
    plan: list[dict],
    supabase,
    workers: int,
    force: bool,
    stop: threading.Event,
    allow_low_contrast: bool,
) -> int:
    """Generate -> gate -> upload -> verify -> write, resumable and idempotent."""
    if not os.getenv("AGNES_AI_API_KEY"):
        print("FAIL: AGNES_AI_API_KEY is not set (root .env); cannot generate.")
        return 1
    try:
        configure_r2()
    except R2NotConfiguredError as error:
        print(f"FAIL: {error}")
        return 1

    checkpoint = load_checkpoint(CHECKPOINT_FILE, SCRIPTS_DIR)
    results = checkpoint.setdefault("results", {})
    completed = checkpoint.setdefault("completed_entities", [])

    tasks, outcomes = [], []
    reused = 0
    for item in plan:
        row = item["row"]
        handle = row.get("handle")
        storage = row.get("storage_image_url") or ""

        # 1. Already covered (skipped when --only asked for this handle by name).
        if storage and url_status(storage) == 200 and not item["forced"] and not force:
            legacy = row.get("image_src") or ""
            if legacy:
                # The grid prefers storage_image_url; the legacy http src is
                # mixed content on the https storefront, so drop it.
                error = patch_collection(
                    supabase, row["id"], {"image_src": None, "image_alt": build_alt(row)}
                )
                note = (
                    f"DB: cleared image_src, set image_alt ({error})" if error
                    else "DB: cleared image_src, set image_alt"
                )
            else:
                note = "skipped: storage_image_url already returns 200"
            outcomes.append({"handle": handle, "file": "", "url": storage,
                             "status": 200, "note": note, "seconds": None})
            print(f"SKIP {handle}: {note}")
            reused += 1
            continue

        # 2. Resume: a previous run uploaded this one but did not reach the DB.
        entry = results.get(handle) or {}
        if entry.get("url") and not force:
            if url_status(entry["url"]) == 200:
                error = patch_collection(
                    supabase, row["id"],
                    {"storage_image_url": entry["url"], "image_src": None,
                     "image_alt": build_alt(row)},
                )
                note = (f"DB: storage_image_url written ({error})" if error
                        else "DB: storage_image_url + image_alt written, image_src cleared")
                outcomes.append({"handle": handle, "file": entry.get("file", ""),
                                 "url": entry["url"], "status": 200,
                                 "note": f"resumed upload; {note}", "seconds": None})
                print(f"RESUME {handle}: {note}")
                reused += 1
                continue

        tasks.append(item | {"refs": REFERENCE_IMAGES.get(handle, [])})

    generated = 0
    failed = 0
    gated = 0
    for result in run_batches(tasks, workers, stop):
        row = result["row"]
        handle = row.get("handle")
        if result["png"] is None:
            failed += 1
            print(f"FAIL {handle}: {result['error']}")
            outcomes.append({"handle": handle, "file": "", "url": "", "status": None,
                             "note": f"generation failed: {result['error']}",
                             "seconds": None, "error": result["error"]})
            continue

        ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)
        local_path = ORIGINALS_DIR / f"{handle}.png"
        local_path.write_bytes(result["png"])

        # The contrast gate runs before anything leaves the machine: a cover that
        # reads as a dark block at 320x240 is held back (not uploaded, not
        # written) unless --allow-low-contrast accepts it explicitly.
        metrics = measure_bytes(result["png"])
        passed, reasons = gate_cover(metrics)
        if not passed and not allow_low_contrast:
            gated += 1
            note = f"gate FAIL ({'; '.join(reasons)}); not uploaded, not written"
            print(f"GATE {handle:40} {format_metrics(metrics)} -- {note}")
            outcomes.append({"handle": handle, "file": str(local_path), "url": "",
                             "status": None, "note": note, "seconds": result["seconds"],
                             "error": None, "qa": metrics, "gated": True})
            continue
        gate_note = "" if passed else f"gate FAIL ({'; '.join(reasons)}); uploaded anyway"

        url, upload_error = upload_image(
            f"{KEY_PREFIX}/{handle}", result["png"], content_type="image/png"
        )
        if upload_error or not url:
            failed += 1
            print(f"FAIL {handle}: upload failed: {upload_error}")
            outcomes.append({"handle": handle, "file": str(local_path), "url": "",
                             "status": None, "note": f"upload failed: {upload_error}",
                             "seconds": result["seconds"], "error": str(upload_error),
                             "qa": metrics})
            continue

        status = url_status(url)
        if status != 200:
            failed += 1
            print(f"FAIL {handle}: uploaded but the delivered URL returned HTTP {status}: {url}")
            outcomes.append({"handle": handle, "file": str(local_path), "url": url,
                             "status": status, "note": f"delivery check failed: HTTP {status}",
                             "seconds": result["seconds"], "qa": metrics,
                             "error": f"delivered HTTP {status}"})
            continue

        error = patch_collection(
            supabase, row["id"],
            {"storage_image_url": url, "image_src": None, "image_alt": build_alt(row)},
        )
        if error:
            note = f"uploaded (HTTP 200) but DB write failed: {error}"
        else:
            results[handle] = {
                "collection_id": row["id"],
                "key": key_from_public_url(url),
                "url": url,
                "file": str(local_path),
                "http_status": status,
                "qa": {key: round(value, 1) for key, value in metrics.items()},
                "image_alt": build_alt(row),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            if handle not in completed:
                completed.append(handle)
            save_checkpoint(CHECKPOINT_FILE, checkpoint, SCRIPTS_DIR)
            note = "DB: storage_image_url + image_alt written, image_src cleared"
        if error:
            failed += 1
        else:
            generated += 1
        prefix = "GATE-FAIL" if gate_note else "OK"
        print(
            f"{prefix if not error else 'FAIL'} {handle:36} {url} "
            f"(HTTP {status}, {result['seconds']}s) {format_metrics(metrics)} {note}"
        )
        outcomes.append({"handle": handle, "file": str(local_path), "url": url,
                         "status": status, "note": f"{gate_note + '; ' if gate_note else ''}{note}",
                         "seconds": result["seconds"], "error": error, "qa": metrics,
                         "gate_failed": not passed})

    # Per-collection report + the error log (written once, from the main thread:
    # utils.checkpoint.append_error is not thread-safe).
    print("\nREPORT")
    for outcome in outcomes:
        location = outcome["url"] or outcome["file"] or "-"
        status = outcome["status"] if outcome["status"] is not None else "-"
        metrics = outcome.get("qa")
        qa_text = format_metrics(metrics) if metrics else "not measured"
        print(
            f"  {outcome['handle']:40} {location}  HTTP {status}  "
            f"{'GATE-FAIL' if outcome.get('gate_failed') else ('GATE-SKIP' if outcome.get('gated') else 'gate PASS' if metrics else '')}  "
            f"{qa_text}\n      {outcome['note']}"
        )

    errors = [o for o in outcomes if o.get("error")]
    if errors:
        ids_by_handle = {item["row"].get("handle"): item["row"]["id"] for item in plan}
        payload = [
            {
                "table": "collections",
                "id": ids_by_handle.get(o["handle"], o["handle"]),
                "error": o["error"],
                "ts": datetime.now(timezone.utc).isoformat(),
            }
            for o in errors
        ]
        ERROR_FILE.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"errors: {len(errors)} -> {ERROR_FILE}")
    else:
        print("errors: none")

    timings = [o["seconds"] for o in outcomes if o.get("seconds")]
    if timings:
        timings.sort()
        median = timings[len(timings) // 2]
        print(
            f"generation time: min {min(timings)}s / median {median}s / max {max(timings)}s "
            f"({len(timings)} image(s), {workers} concurrent)"
        )
    print(
        f"done: {generated} generated + written, {failed} failed, "
        f"{gated} held back by the contrast gate, {reused} reused/skipped"
    )
    if gated and not allow_low_contrast:
        print(
            f"{gated} cover(s) failed the contrast gate and were not uploaded; revise "
            "the subject or rerun with --allow-low-contrast to accept them."
        )
    return 1 if failed or (gated and not allow_low_contrast) else 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    configure_logging(args.verbose)

    if args.preview and resolve_execute(args):
        parser.error("--preview and --execute are mutually exclusive")
    if args.qa_only and (args.preview or resolve_execute(args)):
        parser.error("--qa-only does not generate; drop --preview/--execute")
    if args.limit < 0:
        parser.error("--limit must be positive")
    execute = resolve_execute(args)
    workers = min(max(args.batch_size, 1), MAX_WORKERS)

    if args.qa_only:
        dirs = [Path(value) for value in args.qa_dir] if args.qa_dir else [ORIGINALS_DIR, PREVIEW_DIR]
        return qa_only([directory for directory in dirs if directory.is_dir()] or dirs)

    only = list(dict.fromkeys(
        part.strip() for value in args.only for part in value.split(",") if part.strip()
    ))

    try:
        supabase = get_supabase_client()
    except ValueError as error:
        print(f"FAIL: {error}")
        return 1

    try:
        rows = (
            supabase.table("collections")
            .select("id,handle,title,body_html,image_src,storage_image_url,published")
            .order("id")
            .execute()
            .data
            or []
        )
    except Exception as error:
        print(f"FAIL: could not read collections: {error}")
        return 1
    if not rows:
        print("FAIL: no collections rows returned; check SUPABASE_URL/SUPABASE_SECRET_KEY.")
        return 1

    artists = load_artist_palettes()
    chosen, problem = selected_rows(rows, only, args.force)
    if chosen is None:
        parser.error(problem)
    if args.limit:
        chosen = chosen[: args.limit]
    if not chosen:
        print(f"{len(rows)} collections, none needs a cover (pass --only to force one).")
        return 0

    plan = []
    for row, forced in chosen:
        prompt, kind = build_prompt(row, artists)
        plan.append({"row": row, "prompt": prompt, "kind": kind, "forced": forced})

    if not execute and not args.preview:
        print("DRY-RUN mode: no API calls, no writes. Pass --execute to publish "
              "(or --preview for local samples).\n")
        print_plan(plan)
        return 0

    if args.preview:
        return preview_covers(plan, workers, args.force, threading.Event(),
                              args.allow_low_contrast)

    print(f"EXECUTE mode: {len(plan)} collection(s), {workers} concurrent generation(s), "
          f"uploading to {public_url_host() or '(R2_PUBLIC_BASE_URL unset)'}/{KEY_PREFIX}/")
    return execute_covers(plan, supabase, workers, args.force, threading.Event(),
                          args.allow_low_contrast)


if __name__ == "__main__":
    raise SystemExit(main())
