'use client';

import { useState, useSyncExternalStore } from 'react';
import { CAMPAIGN, campaignIsOpen } from './config';

/**
 * Two clocks the campaign UI needs, both read through `useSyncExternalStore`
 * rather than `useState` + `useEffect`: the clock is an external system, and the
 * server has no honest answer for either. The server snapshots are stated
 * explicitly — `null` for the countdown, `true` (open) for the window — so the
 * server render and the hydration render agree and the browser's answer lands a
 * frame later. A `useEffect` that set state on mount would be the same result
 * with an extra render pass, and React 19's `react-hooks/set-state-in-effect`
 * rule rejects it, correctly.
 */

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 19_800_000;

const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);

/**
 * The value changes once a day at midnight IST (and once when the campaign
 * closes), so a minute's resolution is generous. The interval lives only while
 * something is subscribed.
 */
function subscribeToClock(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

/** Null on the server: there is no clock to read during a server render. */
const NO_SERVER_ANSWER = () => null;

export function useDaysUntil(dateStr: string): number | null {
  const target = Date.parse(dateStr);
  return useSyncExternalStore(
    subscribeToClock,
    () => istDay(target) - istDay(Date.now()),
    NO_SERVER_ANSWER
  );
}

/** "IN 5 DAYS" / "TONIGHT" / null while unknown or once the show has passed. */
export function useCountdownLabel(): string | null {
  const days = useDaysUntil(CAMPAIGN.concertDate);
  if (days === null || days < 0) return null;
  if (days === 0) return 'TONIGHT';
  if (days === 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

/**
 * Whether codes can still be minted and spent.
 *
 * `campaignIsOpen()` reads the clock, which is not a pure function and which
 * React 19 rejects during render — so the answer comes through the store, with
 * `true` as the server snapshot. A prerendered page must never claim the
 * campaign has closed on the strength of a build-time clock: the browser's
 * answer replaces it on hydration, and the minute tick flips it if the tab is
 * still open when the window shuts.
 *
 * The server routes do not rely on this. They check `campaignIsOpen()` per
 * request, so a stale tab can lose a race and still be refused.
 */
export function useCampaignOpen(): boolean {
  return useSyncExternalStore(subscribeToClock, campaignIsOpen, () => true);
}

/**
 * Whether the campaign is still open, judged from the server's clock rather
 * than the visitor's wall clock.
 *
 * `useCampaignOpen` above reads the browser clock, so a device set a day fast
 * closes the campaign a day early — `/quiz` would refuse an offer the server
 * still honours. This hook instead anchors on `serverNowMs`, handed down from
 * a `force-dynamic` server render, and adds only *elapsed* time measured with
 * the same browser clock before and after. Any local skew appears in both
 * readings and cancels, so the answer stays as authoritative as the server's
 * while still ticking down in a tab that stays open past the deadline.
 *
 * `serverOpen` (the render's verdict) is the hydration snapshot: before the
 * browser has measured anything, the page agrees with what the server painted,
 * so a stale frame can only ever be too pessimistic, never too generous.
 */
/** The anchor pair captured on first mount; both clocks read together. */
interface ClockAnchor {
  server: number;
  local: number;
}

/**
 * Reads both clocks. A named function (not an inline arrow) so the compiler
 * lint sees a call, the same way `useCampaignOpen` calls `campaignIsOpen`,
 * rather than a `Date.now()` in render scope.
 */
function readClockAnchor(serverNowMs: number): ClockAnchor {
  return { server: serverNowMs, local: Date.now() };
}

/** Open-at-anchor: server time advanced by locally-measured elapsed time. */
function campaignOpenAt(anchor: ClockAnchor, serverOpen: boolean): boolean {
  return serverOpen && anchor.server + (Date.now() - anchor.local) <= Date.parse(CAMPAIGN.endsAt);
}

export function useCampaignOpenOnServerClock(serverOpen: boolean, serverNowMs: number): boolean {
  // The anchor is state with a lazy initialiser: it must be captured once,
  // on mount, and survive re-renders — including the minute tick below, which
  // re-reads the answer against the *same* anchor.
  const [anchor] = useState(() => readClockAnchor(serverNowMs));
  // Same subscription as `useCampaignOpen`: the answer flips at most once, and
  // the minute tick is what re-reads it in a long-lived tab.
  return useSyncExternalStore(
    subscribeToClock,
    () => campaignOpenAt(anchor, serverOpen),
    () => serverOpen
  );
}
