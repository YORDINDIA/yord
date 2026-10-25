#!/usr/bin/env python3
"""Design registry for the Diljit Dosanjh listing backfill.

Built from a visual audit (2026-10-24) of every artboard, mockup and product
photo under `Merch Designs/`. Two findings drove the shape of this file:

1. **The folder numbering lies.** `DD009/Artboard 10.png` and `DD010/Artboard 9.png`
   hold each other's numbers, and several mockup folders contain a *different*
   design than their name says (`DD008- FANART` holds the vertical DILJEET type,
   `DD011-LEVIS OFFICIAL` holds a Punjabi Aa Gaye Oye print). Nothing here is
   inferred from a filename: every `art` file and every `mockup` file listed
   below was opened and identified by eye.

2. **The artboards are print-ready but the mockups are not.** The 12 flat
   artboards are 5000x5500 transparent PNGs of white type, i.e. artwork for a
   black garment. They are composited onto the cached blank black-tee plates
   from the 2026-10-05 Punjabi tee job (verified still blank before reuse),
   which gives a pixel-exact print and one identical studio look across them.

A third finding covers the **hoodies**, added 2026-10-25. There are two black
hoodie designs, not one, and neither is in the folder named for it:

    `DD003- DILJIT WEARING HOODIE REFLECTIVE DESIGN/` is misnamed -- its PNGs
    are photos of finished *tees*. The name means "Diljit wearing a hoodie" in
    the artwork. The two hoodie prints are `diljit_design_2.ai` (in the two
    `DD003 - Diljit Dosanjh's Dillumniati tour` folders, which also hold the
    only finished hoodie mockups) and `DiljitHOODIEOK.ai` (identical md5 in
    `DD001 - Dil-luminati White/` and `Design 2 - Diljit Reflective/`).

Both are PDF-backed `.ai` files that PIL cannot open, so `render_hoodie_art.py`
rasterises them once and the rendered PNGs are pinned by absolute path. They are
composited onto their own blank hoodie plates (`agnes-out/diljit-hoodie/`), not
the tee plates: a hoodie has a hood, drawstrings and a kangaroo pocket, and the
tee's flat plate has none of them.

Image strategy per design:

    composite  artboard warped onto a cached blank plate -> cover + main image,               plus any verified mockups for the remaining gallery slots.
    mockup     no flat art exists; the gallery is the verified mockups alone.

`art` / `mockup` paths are relative to `APPARELS` so the Drive tree can be
reorganised without rewriting handles. An **absolute** path is taken as-is:
that is how the hoodie pins its rasterised `.ai` art and its extracted mockup
frames, which live under `agnes-out/` rather than on Drive.
"""

from __future__ import annotations

import os
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent

# The source assets live on one operator's Google Drive mount. The absolute
# default below is that machine's path; any other checkout points the whole
# pipeline at its own copy of the folder with `DILJIT_DRIVE_ROOT` — the
# renderer, both mockup extractors and the publishers all resolve their roots
# through this one constant, so a single env var moves the entire backfill.
DRIVE_ROOT = Path(
    os.environ.get(
        "DILJIT_DRIVE_ROOT",
        "/Users/sakshammittal/Library/CloudStorage/GoogleDrive-saksham@techaintern.com"
        "/My Drive/YORD INDIA/Diljit Dosanjh",
    )
)
APPARELS = DRIVE_ROOT / "Merch Designs" / "Apparels"
FRIDGE = DRIVE_ROOT / "Merch Designs" / "Fridge Magnets" / "Diljit Dosanjh"

# Cached blank black-tee plates (1728x2304) from the 2026-10-05 Punjabi tee job.
BLANK_BLACK_PLATES = {
    "flat-front": Path("agnes-out/punjabi-tees/diljit-dosanjh-punjabi-aa-gaye-oye-text-tee__flat-front.png"),
    "flat-back": Path("agnes-out/punjabi-tees/diljit-dosanjh-punjabi-aa-gaye-oye-text-tee__flat-back.png"),
    "model-front": Path("agnes-out/punjabi-tees/diljit-dosanjh-punjabi-aa-gaye-oye-text-tee__model-front.png"),
    "model-back": Path("agnes-out/punjabi-tees/diljit-dosanjh-punjabi-aa-gaye-oye-text-tee__model-back.png"),
}

# Blank black-hoodie plates (2K 3:4) from generate_diljit_hoodie_plates.py. The
# hoodie is a different garment, so it needs its own plate *and* its own
# placement: the tee's flat plate has no hood, no drawstrings and no kangaroo
# pocket, and the print has to clear all three.
BLANK_BLACK_HOODIE_PLATES = {
    "flat-front": Path("agnes-out/diljit-hoodie/flat-front.png"),
    "model-front": Path("agnes-out/diljit-hoodie/model-front.png"),
}

# Which cached plates each garment composites, in gallery order.
PLATES_BY_GARMENT = {
    "tee-black": ("flat-front", "model-front"),
    "hoodie-black": ("flat-front", "model-front"),
}

SIZES_TEE = ["XS", "S", "M", "L", "XL", "2XL"]
SIZES_HOODIE = ["M", "L", "XL", "2XL"]

MAX_GALLERY_MOCKUPS = 4

HANDLE_PREFIX = "diljit-dosanjh-"
PRICE = 1499
INVENTORY = 100
COLLECTION_HANDLE = "diljit-dosanjh"
VENDOR = "Diljit Dosanjh"


# --------------------------------------------------------------------------
# Designs
# --------------------------------------------------------------------------

DESIGNS: list[dict] = [
    # ---- composited from the 12 flat artboards (white type -> black garment) ----
    {
        "key": "born-to-shine-pencil",
        "title": "Born To Shine Pencil Portrait Oversized T-Shirt",
        "art": "DD006/Artboard 6.png",
        "art_scale": 0.60,
        "garment": "tee-black",
        "type": "T-Shirts",
        # DD006 is the one artboard folder that also shipped finished mockups,
        # so this listing gets a full gallery instead of just the two
        # composites. The `Mockups/` subfolder is byte-identical to these root
        # copies (checked by md5), so only the root ones are listed.
        "mockups": [
            "DD006/gildan-t-shirt-mockup-featuring-a-man-posing-at-sunset-m33669 (1).png",
            "DD006/t-shirt-mockup-of-a-woman-with-short-hair-smiling-m8428-r-el2.png",
            "DD006/heathered-t-shirt-mockup-featuring-an-excited-woman-posing-against-a-gray-wall-m8426-r-el2 (1).png",
            "DD006/t-shirt-mockup-featuring-a-pair-of-blue-shoes-m14775-r-el2 (1).png",
        ],
        "blurb": (
            "A graphite portrait of Diljit Dosanjh under <strong>BORN TO SHINE</strong>, "
            "set in heavy block type with a thin double rule through the middle."
        ),
    },
    {
        "key": "born-to-shine-colour",
        "title": "Born To Shine Colour Portrait Oversized T-Shirt",
        "art": "DD007/Artboard 7.png",
        "art_scale": 0.60,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "The same BORN TO SHINE lockup over a full-colour portrait in a "
            "rainbow-printed shirt, the print ending in a torn paper edge."
        ),
    },
    {
        "key": "dosanjh-orange-jacket",
        "title": "Diljit Dosanjh Orange Jacket Oversized T-Shirt",
        "art": "DD008/Artboard 8.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "<strong>DILJIT DOSANJH</strong> arched over a portrait in a hooded "
            "jacket with a blaze-orange lining."
        ),
    },
    {
        "key": "dil-gurmukhi",
        "title": "Dil Gurmukhi Type Oversized T-Shirt",
        "art": "DD009/Artboard 10.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "Gurmukhi <strong>ਦਿਲ</strong> above and below a portrait in a plain "
            "black tee — the shortest way to say it."
        ),
    },
    {
        "key": "taur-mitran-di-dekh",
        "title": "Taur Mitran Di Dekh Oversized T-Shirt",
        "art": "DD010/Artboard 9.png",
        "art_scale": 0.60,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "<strong>TAUR MITRAN DI DEKH</strong> stacked over a portrait in a "
            "white kurta, with DILJIT DOSANJH anchored below."
        ),
    },
    {
        "key": "punjabi-aa-gaye-oye-purple",
        "title": "Punjabi Aa Gaye Oye Purple Print Oversized T-Shirt",
        "art": "DD012/Artboard 11.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "<strong>PUNJABI AA GAYE OYE</strong> broken across a portrait in a "
            "purple turban and studded leather jacket."
        ),
    },
    {
        "key": "putt-jatt-da",
        "title": "Putt Jatt Da Oversized T-Shirt",
        "art": "DD013/Artboard 13.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "<strong>PUTT JATT DA</strong> wrapping a portrait in a black bomber "
            "jacket."
        ),
    },
    {
        "key": "diljeet-dosanjh-vertical",
        "title": "Diljeet Dosanjh Vertical Type Oversized T-Shirt",
        "art": "DDO11/Artboard 12.png",
        "art_scale": 0.66,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "DILJEET and DOSANJH set vertically either side of a portrait, "
            "resting on one hand, watch catching the light."
        ),
    },
    {
        "key": "goat-born-to-shine",
        "title": "GOAT Born To Shine Oversized T-Shirt",
        "art": "DDO14/1.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "A high-contrast halftone figure with one arm raised, GOAT set large "
            "beside it and <em>Born to Shine</em> in script beneath."
        ),
    },
    {
        "key": "gallan-teriyan-yaadan-teriyan",
        "title": "Gallan Teriyan Yaadan Teriyan Oversized T-Shirt",
        "art": "DD015/Untitled Project - Merch by Amazon T-Shirt 4.png",
        "art_scale": 0.60,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "<strong>Gallan Teriyan</strong> and <strong>Yaadan Teriyan</strong> "
            "in rose script, scattered with hearts around a monochrome portrait."
        ),
    },
    {
        "key": "jatt-life",
        "title": "Jatt Life Orange Type Oversized T-Shirt",
        "art": "DD016/Untitled Project - Merch by Amazon T-Shirt 5.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "<strong>JATT LIFE</strong> stacked in tangerine behind a portrait in "
            "a matching orange blazer, with Diljit Dosanjh in script."
        ),
    },
    {
        "key": "punjabi-aa-gaye-oye-sunset",
        "title": "Punjabi Aa Gaye Oye Sunset Oversized T-Shirt",
        "art": "DD017/Untitled Project - Merch by Amazon T-Shirt 6.png",
        "art_scale": 0.62,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [],
        "blurb": (
            "PUNJABI and AA GAYE OYE in orange framing a portrait in blue-lit "
            "sunglasses."
        ),
    },

    # ---- existing mockups, no flat art (folder contents verified by eye) ----
    #
    # Every entry below pins an EXACT file, not a folder. The folders are not
    # trustworthy: `DD005-Dil-luminati poster TM` holds both the red tour poster
    # AND the tour-dates back print, `DD011-LEVIS OFFICIAL` holds a Punjabi
    # print plus a repeated-name print, and `DD004` holds tour-dates mockups
    # despite its "grafiti" name. Each filename here was opened and matched to
    # its design in the 2026-10-24 audit.
    {
        "key": "dil-luminati-tour-poster",
        "title": "Dil-Luminati Tour Poster Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD005-Dil-luminati poster TM/flatlay-oversized-tshirt-mockup-in-modern-style-0306.jpg",
            "DD005-Dil-luminati poster TM/close-up-front-view-t-shirt-mockup-on-model-0415.jpg",
            "DD005-Dil-luminati poster TM/front-t-shirt-mockup-with-woman-in-sunlit-outdoor-setting-0411 (1).jpg",
            "DD005-Dil-luminati poster TM/golden-hour-portrait-tshirt-mockup-young-woman-outdoor-setting-0407.jpg",
        ],
        "blurb": (
            "The Dil-Luminati key art reproduced full-chest, portrait and all, "
            "in the tour's scarlet and bone palette."
        ),
    },
    {
        # Only two genuine tour-dates shots exist, and each was rendered twice
        # by the designer -- once in the scarlet ink that matches the poster
        # (`DD005`, DJ005-BACK) and once in white (`DD002`, DJ002-BACK). Both
        # are pinned here in scarlet so the gallery matches the product family
        # and no two slots show the same photograph.
        "key": "dil-luminati-tour-dates-back",
        "title": "Dil-Luminati Tour Dates Back Print Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD005-Dil-luminati poster TM/back-tshirt-mockup-of-indian-man-in-garden-0353.jpg",
            "DD005-Dil-luminati poster TM/eco-friendly-white-tshirt-mockup-hanging-lush-garden-setting-0405 (6).jpg",
        ],
        "blurb": (
            "Every Dil-Luminati date stacked down the back of a black tee, with "
            "the tour lockup on the chest."
        ),
    },
    {
        "key": "wings-figure",
        "title": "Dil-Luminati Wings Figure Oversized T-Shirt",
        "art": "DD002-ALTERNATIVE/file (29).png",
        "art_scale": 0.72,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD002 - LEVIS COPY TOUR DATES BACK SIDE/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (7).jpg",
            "DD002 - LEVIS COPY TOUR DATES BACK SIDE/tshirt-mockup-on-a-hanger-with-cozy-plant-in-background-0305 (5).jpg",
            "DD002 - LEVIS COPY TOUR DATES BACK SIDE/indian-man-tshirt-mockup-posing-outside-store-00144.jpg",
            "DD002 - LEVIS COPY TOUR DATES BACK SIDE/indian-man-tshirt-mockup-with-hands-on-waist-scene1-0024 (2).jpg",
        ],
        "blurb": (
            "A white-robed figure with wings lifting off the shoulders, printed "
            "large and lit from within."
        ),
    },
    {
        # `file (32).png` in this folder looks like flat art but is a photo of a
        # finished tee on a transparent background -- compositing it printed the
        # source garment as a ghost rectangle, so this design is mockup-only.
        "key": "dil-luminati-blue-figure",
        "title": "Dil-Luminati Blue Figure Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD003- DILJIT WEARING HOODIE REFLECTIVE DESIGN/flatlay-oversized-tshirt-mockup-in-modern-style-0306 (4).jpg",
            "DD003- DILJIT WEARING HOODIE REFLECTIVE DESIGN/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (6).jpg",
            "DD003- DILJIT WEARING HOODIE REFLECTIVE DESIGN/front-view-t-shirt-mockup-with-soft-lighting-and-casual-look-0418 (5).jpg",
            "DD003- DILJIT WEARING HOODIE REFLECTIVE DESIGN/front-t-shirt-mockup-with-woman-in-sunlit-outdoor-setting-0411 (5).jpg",
        ],
        "blurb": (
            "A figure in a blue hooded jacket, arms crossed, under "
            "DIL-LUMINATI TOUR in scarlet block type."
        ),
    },
    {
        "key": "dil-luminati-chrome-type",
        "title": "Dil-Luminati Chrome Type Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD006-Black theme poster TM/flatlay-oversized-tshirt-mockup-in-modern-style-0306.jpg",
            "DD006-Black theme poster TM/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (2).jpg",
            "DD006-Black theme poster TM/front-view-t-shirt-mockup-with-soft-lighting-and-casual-look-0418.jpg",
            "DD006-Black theme poster TM/genz-model-with-curly-hair-posing-in-tshirt-mockup-0270.jpg",
        ],
        "blurb": (
            "DIL-LUMINATI TOUR in liquid-chrome type, small and centred above the "
            "heart."
        ),
    },
    {
        "key": "dosanjh-india-2024",
        "title": "Diljit Dosanjh India 2024 Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD009- CUSTOM/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (2).jpg",
            "DD009- CUSTOM/front-view-t-shirt-mockup-with-soft-lighting-and-casual-look-0418 (2).jpg",
            "DD009- CUSTOM/young-male-model-wearing-tshrit-mockup-against-green-background-scene1-0280 (1).jpg",
            "DD009- CUSTOM/eco-friendly-white-tshirt-mockup-hanging-lush-garden-setting-0405.jpg",
        ],
        "blurb": (
            "DILJIT DOSANJH arced over INDIA-2024, with lightning running beneath "
            "the type."
        ),
    },
    {
        "key": "collage",
        "title": "Diljit Dosanjh Collage Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD010-COLLAGE/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (3).jpg",
            "DD010-COLLAGE/front-view-t-shirt-mockup-with-soft-lighting-and-casual-look-0418 (1).jpg",
            "DD010-COLLAGE/young-male-model-wearing-tshrit-mockup-against-green-background-scene2-0279 (2).jpg",
            "DD010-COLLAGE/tshirt-mockup-on-a-hanger-with-cozy-plant-in-background-0305 (1).jpg",
        ],
        "blurb": (
            "A photo collage of the Dil-Luminati era, printed edge to edge across "
            "the chest."
        ),
    },
    {
        "key": "dil-luminati-spotlight",
        "title": "Dil-Luminati Spotlight Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD007- DIL-LUMINATI LIGHT FALLING ON HIM/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (8).jpg",
            "DD007- DIL-LUMINATI LIGHT FALLING ON HIM/genz-model-with-curly-hair-posing-in-tshirt-mockup-0270 (3).jpg",
            "DD007- DIL-LUMINATI LIGHT FALLING ON HIM/indian-man-tshirt-mockup-with-hands-on-waist-scene1-0024 (3).jpg",
            "DD007- DIL-LUMINATI LIGHT FALLING ON HIM/tshirt-mockup-on-a-hanger-with-cozy-plant-in-background-0305 (6).jpg",
        ],
        "blurb": (
            "A lone figure caught in a single hard beam beneath the tour lockup, "
            "lit from above."
        ),
    },
    {
        "key": "fan-art",
        "title": "Dil-Luminati Fan Art Oversized T-Shirt",
        "art": None,
        "garment": "tee-black",
        "type": "T-Shirts",
        "mockups": [
            "DD008- FANART/flatlay-oversized-tshirt-mockup-in-modern-style-0306.jpg",
            "DD008- FANART/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (1).jpg",
            "DD008- FANART/front-view-t-shirt-mockup-with-soft-lighting-and-casual-look-0418.jpg",
            "DD008- FANART/genz-model-with-curly-hair-posing-in-tshirt-mockup-0270.jpg",
        ],
        "blurb": (
            "DIL-LUMINATI TOUR over DILJIT DOSANJH in scarlet, with a full-length "
            "figure beneath."
        ),
    },
    # The two designs in `DD011-LEVIS OFFICIAL` are easy to cross-wire: the
    # folder holds a white-tee front print AND a white-tee back print, and the
    # "frizzy hair" pair is one shot of each (`tsh.jpg` is the repeated-name
    # back, `tsh(1).jpg` is the Panjabi front). Both entries below were matched
    # to their artwork by eye, one file at a time.
    {
        "key": "punjabi-aa-gaye-oye-red",
        "title": "Punjabi Aa Gaye Oye Red Print Oversized T-Shirt",
        "art": None,
        "garment": "tee-white",
        "type": "T-Shirts",
        "mockups": [
            "DD011-LEVIS OFFICIAL/front-view-t-shirt-mockup-on-model-in-modern-setting-0419 (4).jpg",
            "DD011-LEVIS OFFICIAL/front-view-t-shirt-mockup-with-soft-lighting-and-casual-look-0418 (4).jpg",
            "DD011-LEVIS OFFICIAL/young-female-model-with-frizzy-hair-wearing-tsh(1).jpg",
        ],
        "blurb": (
            "PANJABI AA GAYE OYE! in red across a white tee."
        ),
    },
    {
        "key": "dosanjh-repeated-type",
        "title": "Diljit Dosanjh Repeated Type Back Print Oversized T-Shirt",
        "art": None,
        "garment": "tee-white",
        "type": "T-Shirts",
        "mockups": [
            "DD011-LEVIS OFFICIAL/back-view-of-indian-model-wearing-tshirt-mockup-in-garden-0355.jpg",
            "DD011-LEVIS OFFICIAL/eco-friendly-white-tshirt-mockup-hanging-lush-garden-setting-0405 (3).jpg",
            "DD011-LEVIS OFFICIAL/young-female-model-with-frizzy-hair-wearing-tsh.jpg",
        ],
        "blurb": (
            "DILJIT DOSANJH stacked down the back of a white tee in red, eleven "
            "times over."
        ),
    },
    {
        # Hoodie 1 of 2. `diljit_design_2.ai` is the print on the Placeit studio
        # video in this same folder: "DILJIT DOSANJH'S" in tall serif over a
        # masked, turbaned figure, with "DIL-LUMINATI TOUR" beneath it.
        #
        # The art is a rendered .ai under agnes-out/ (PIL cannot open a
        # PDF-backed .ai), pinned by absolute path so the registry keeps
        # working from any cwd.
        "key": "dil-luminati-tour-black-hoodie",
        "title": "Dil-Luminati Tour Black Hoodie",
        "art": str(
            (ROOT / "agnes-out/diljit-hoodie-art/dosanjhs-tour.png").resolve()
        ),
        "art_scale": 0.60,
        "garment": "hoodie-black",
        "type": "Hoodies",
        "mockups": [
            str((ROOT / "agnes-out/diljit-hoodie/mockups/hoodie-mockup-1.png").resolve()),
            str((ROOT / "agnes-out/diljit-hoodie/mockups/hoodie-mockup-2.png").resolve()),
            str((ROOT / "agnes-out/diljit-hoodie/mockups/hoodie-mockup-3.png").resolve()),
        ],
        "blurb": (
            "DILJIT DOSANJH'S DIL-LUMINATI TOUR in tall white serif, over a "
            "masked, turbaned figure."
        ),
    },
    {
        # Hoodie 2 of 2, and the one people were actually photographed wearing
        # at the shows. `DiljitHOODIEOK.ai` prints "DIL-LUMINATI TOUR / DILJIT /
        # DOSANJH" in white around the turbaned figure; the ink is reflective,
        # so it reads white in daylight and flares rainbow under a phone flash
        # (the Chandigarh/Indore shots below are real customers, not mockups).
        #
        # Reuses the handle of the retired 2026-10-24 draft, which carried the
        # right copy but four tee mockups -- publish with --replace to rebuild
        # it on the correct art.
        "key": "dil-luminati-reflective-hoodie",
        "title": "Dil-Luminati Reflective Premium Hoodie",
        "art": str(
            (ROOT / "agnes-out/diljit-hoodie-art/reflective-tour.png").resolve()
        ),
        "art_scale": 0.60,
        "garment": "hoodie-black",
        "type": "Hoodies",
        "mockups": [
            str((ROOT / "agnes-out/diljit-hoodie/mockups-reflective/reflective-1.png").resolve()),
            str((ROOT / "agnes-out/diljit-hoodie/mockups-reflective/reflective-2.png").resolve()),
        ],
        "blurb": (
            "DIL-LUMINATI TOUR over DILJIT DOSANJH in tall white type, with the "
            "turbaned figure front and centre. The print is reflective: white in "
            "daylight, rainbow the moment a phone flash hits it."
        ),
    },
]

BODY_COMMON = (
    "<p>Cut oversized from 240 GSM bio-washed cotton with half sleeves and a "
    "drop shoulder, it drapes the way a concert tee should. The DTF print keeps "
    "every edge crisp, wash after wash.</p>"
    "<ul>"
    "<li>100% pure cotton, bio-washed, 240 GSM</li>"
    "<li>Oversized unisex fit with half sleeves</li>"
    "<li>Exclusive YORD India design for Diljit Dosanjh fans</li>"
    "</ul>"
)

HOODIE_BODY = (
    "<p>A heavyweight fleece hoodie with a lined hood and ribbed cuffs, built "
    "for the walk to the venue and every cold night after it.</p>"
    "<ul>"
    "<li>Fleece-backed cotton blend, brushed inside</li>"
    "<li>Relaxed unisex fit with a lined hood</li>"
    "<li>Exclusive YORD India design for Diljit Dosanjh fans</li>"
    "</ul>"
)

# Only the reflective hoodie claims the flare -- the serif one prints plain
# white, and a reflectivity claim that does not hold up is a returns problem.
REFLECTIVE_HOODIE_BODY = (
    "<p>A heavyweight fleece hoodie with a lined hood and ribbed cuffs, built "
    "for the walk to the venue and every cold night after it. The reflective "
    "print sits dark in daylight and flares rainbow the moment a phone flash or "
    "stage light hits it.</p>"
    "<ul>"
    "<li>Fleece-backed cotton blend, brushed inside</li>"
    "<li>Reflective print, flashes rainbow under a camera flash</li>"
    "<li>Relaxed unisex fit with a lined hood</li>"
    "<li>Exclusive YORD India design for Diljit Dosanjh fans</li>"
    "</ul>"
)

REFLECTIVE_HOODIE_KEY = "dil-luminati-reflective-hoodie"


def handle_for(design: dict) -> str:
    return HANDLE_PREFIX + design["key"]


def plates_for(design: dict) -> tuple[str, ...]:
    """Plate names this design composites. Mockup-only garments have none."""
    return PLATES_BY_GARMENT.get(design["garment"], ())


def plate_paths_for(design: dict) -> dict[str, Path]:
    """Blank-plate files for this garment, keyed by plate name."""
    source = (
        BLANK_BLACK_HOODIE_PLATES
        if design["garment"] == "hoodie-black"
        else BLANK_BLACK_PLATES
    )
    return {name: source[name] for name in plates_for(design)}


def body_for(design: dict) -> str:
    if design["type"] == "Hoodies":
        tail = (
            REFLECTIVE_HOODIE_BODY
            if design["key"] == REFLECTIVE_HOODIE_KEY
            else HOODIE_BODY
        )
    else:
        tail = BODY_COMMON
    return f"<p>{design['blurb']}</p>" + tail


def sizes_for(design: dict) -> list[str]:
    return SIZES_HOODIE if design["type"] == "Hoodies" else SIZES_TEE


# The fleece description is shared by both hoodies, but the reflective one needs
# the flare spelled out and the other must not claim it. Per-design overrides
# keep the two listings from reading as copies of each other.
HOODIE_META = {
    REFLECTIVE_HOODIE_KEY: {
        "meta_description": (
            "Reflective Dil-Luminati hoodie print on heavyweight fleece. Diljit "
            "Dosanjh fan merchandise, relaxed unisex fit. Free shipping on all "
            "orders."
        ),
        "search_keywords": (
            "diljit dosanjh hoodie, dil-luminati merch, diljit dosanjh fan "
            "merchandise, reflective hoodie india, concert merch india, punjabi "
            "hoodie, buy hoodie online india"
        ),
    },
    "dil-luminati-tour-black-hoodie": {
        "meta_description": (
            "Dil-Luminati Tour black hoodie in heavyweight fleece. Diljit "
            "Dosanjh fan merchandise, relaxed unisex fit. Free shipping on all "
            "orders."
        ),
        "search_keywords": (
            "diljit dosanjh hoodie, dil-luminati tour merch, diljit dosanjh fan "
            "merchandise, black hoodie india, concert merch india, punjabi "
            "hoodie, buy hoodie online india"
        ),
    },
}


def meta_for(design: dict) -> dict:
    """SEO columns. Kept under Google's ~60/160 char display limits."""
    name = "Diljit Dosanjh"
    if design["type"] == "Hoodies":
        return {
            "meta_title": f"{design['title']} | {name}",
            **HOODIE_META[design["key"]],
        }
    return {
        "meta_title": f"{design['title']} | {name}",
        "meta_description": (
            f"{design['title'].replace(' Oversized T-Shirt', '')} on 240 GSM "
            "bio-washed cotton. Diljit Dosanjh fan merchandise, oversized unisex "
            "fit. Free shipping on all orders."
        ),
        "search_keywords": (
            "diljit dosanjh t-shirt, dil-luminati merch, diljit dosanjh fan "
            "merchandise, punjabi t-shirt, oversized t-shirt india, concert merch "
            "india, buy t-shirt online india"
        ),
    }


def tags_for(design: dict) -> str:
    # The hoodie tag set is deliberately its own string, not the tee's with a
    # word swapped: the tee tags carry "oversized t-shirt india", and
    # `tidy_collections.py` files any product whose tags contain "oversized"
    # into the `oversized` facet. Reusing them on a hoodie would put a hoodie in
    # the tee-fit collection -- none of the four live hoodies are there.
    if design["type"] == "Hoodies":
        return (
            "diljit dosanjh hoodie, diljit dosanjh fan merchandise, dil-luminati "
            "tour merch, concert hoodie india, concert merch india, punjabi "
            "hoodie, buy hoodie online india"
        )
    return (
        "diljit dosanjh t-shirt, diljit dosanjh fan merchandise, dil-luminati "
        "tour merch, punjabi t-shirt, oversized t-shirt india, concert merch "
        "india, buy t-shirt online india"
    )


def build(only: str | None = None) -> list[dict]:
    """Expand the registry into fully-resolved, per-design publish records.

    `mockups` holds paths relative to APPARELS and every one is checked to
    exist. Files are pinned individually rather than by folder because the
    folders mix designs -- see the note above the mockup-only entries.

    `only` selects one design *before* validation: `composite_diljit_art.py
    --only <key>` must be able to rework a single design without every other
    design's source file being present on the machine running it.
    """
    selected = DESIGNS
    if only is not None:
        selected = [d for d in DESIGNS if d["key"] == only]
        if not selected:
            raise SystemExit(f"no design with key {only!r} in the registry")
    out = []
    for design in selected:
        handle = handle_for(design)

        # `art` is relative to APPARELS, except a path starting with "/" which is
        # absolute -- the hoodie art is a rendered .ai that has to live under
        # agnes-out/ (PIL cannot open a PDF-backed .ai, so it is rasterised once
        # by `render_hoodie_art.py` and pinned by absolute path).
        art_path = None
        if design.get("art"):
            art_path = Path(design["art"])
            if not art_path.is_absolute():
                art_path = APPARELS / art_path
        if art_path and not art_path.exists():
            raise FileNotFoundError(f"{handle}: art not found: {art_path}")
        if art_path and not plates_for(design):
            raise ValueError(
                f"{handle}: garment {design['garment']!r} has art but no registered plates"
            )

        mockup_paths: list[Path] = []
        for rel in design.get("mockups", []):
            p = Path(rel)
            if not p.is_absolute():
                p = APPARELS / rel
            if not p.exists():
                raise FileNotFoundError(f"{handle}: mockup not found: {p}")
            mockup_paths.append(p)

        if not art_path and not mockup_paths:
            raise ValueError(f"{handle}: no art and no mockups -- nothing to publish")

        out.append({
            **design,
            "handle": handle,
            "art_path": art_path,
            "plates": plates_for(design),
            "plate_paths": plate_paths_for(design),
            "mockup_paths": mockup_paths[:MAX_GALLERY_MOCKUPS],
            "sizes": sizes_for(design),
            **meta_for(design),
            "tags": tags_for(design),
            "body_html": body_for(design),
        })
    return out


if __name__ == "__main__":
    records = build()
    print(f"{len(records)} designs\n")
    for r in records:
        art = r["art_path"].name if r["art_path"] else "-- mockups only --"
        print(f"{r['handle']:50s} {r['type']:9s} {r['garment']:12s} "
              f"art={art[:30]:30s} mockups={len(r['mockup_paths'])}")
