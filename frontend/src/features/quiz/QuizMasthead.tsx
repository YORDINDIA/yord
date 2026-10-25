'use client';

import Image from 'next/image';
import { CAMPAIGN } from './config';
import { useCountdownLabel } from './useCountdown';

/**
 * The campaign's identity band, shared by the pop-up and the `/quiz` page.
 *
 * Dark in both themes, on purpose: it sits over the Delhi tour poster, and the
 * token contract is explicit that anything over a photo uses the
 * theme-invariant on-media tokens (`--scrim`, `--text-on-media*`,
 * `--accent-on-media`) rather than the flipping page tokens — the same rule the
 * home hero follows. In the light theme this reads as one of the site's dark
 * media surfaces; in the dark theme it simply merges with the page.
 *
 * The heading level is the caller's call: the page renders an `h1` (its
 * headline must be server-rendered for the shareable URL), the pop-up an `h2`
 * that doubles as the dialog's accessible name via `titleId`.
 */
export function QuizMasthead({
  headingLevel,
  titleId,
}: {
  headingLevel: 'h1' | 'h2';
  titleId?: string;
}) {
  const countdown = useCountdownLabel();
  const Heading = headingLevel;

  return (
    <header className="relative overflow-hidden bg-scrim">
      {/* The poster is a night stadium: its interest is the warm stage glow
          around the middle of the frame, so the crop is centred on that band
          (the top of the source is plain black sky). The scrim keeps the copy's
          left half solid and lets the glow breathe on the right. */}
      <Image
        src={CAMPAIGN.artUrl}
        alt=""
        fill
        sizes="(min-width: 640px) 576px, calc(100vw - 2rem)"
        className="object-cover object-[45%_50%] brightness-110"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-scrim via-scrim/80 to-scrim/20"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-scrim/70 via-transparent to-scrim/30"
        aria-hidden="true"
      />

      <div className="relative px-6 pb-5 pt-7 sm:px-10">
        <p className="font-accent text-[11px] tracking-[0.3em] text-accent-on-media">
          {CAMPAIGN.artistName.toUpperCase()} · {CAMPAIGN.tourName.toUpperCase()}
        </p>

        <Heading
          id={titleId}
          className="mt-1.5 font-display text-2xl leading-tight text-text-on-media sm:text-3xl"
        >
          The Aura Quiz
        </Heading>

        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-accent text-[10px] tracking-[0.25em] text-text-on-media-muted">
          <span>{CAMPAIGN.city.toUpperCase()}</span>
          <span aria-hidden="true">·</span>
          <span>{CAMPAIGN.concertDate.split('-').reverse().join('.')}</span>
          {countdown ? (
            <span className="rounded-full border border-accent-on-media/40 px-2 py-0.5 text-accent-on-media">
              {countdown}
            </span>
          ) : null}
        </p>
      </div>
    </header>
  );
}
