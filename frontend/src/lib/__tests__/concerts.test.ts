// Upcoming-only concert catalogue tests. The concerts list is a static data
// file, so these tests guard the refresh contract: no past/completed entries,
// unique slugs, valid helpers, and every upcoming artist resolving to merch
// metadata in @yord/db-types.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTISTS } from '@yord/db-types';
import {
  CONCERTS,
  getConcertBySlug,
  getConcertsByArtist,
  getUpcomingConcerts,
  getUpcomingConcertsByArtist,
} from '@/lib/data/concerts';
import { getConcertImage, getConcertImageCredit } from '@/features/concerts/concertImages';
import {
  formatConcertDate,
  getDaysUntil,
  getUrgencyLabel,
} from '@/features/concerts/concertDates';

// Fixed refresh cutoff — the catalogue was rebuilt for shows on/after this
// date. A literal keeps the suite deterministic instead of time-bombing on
// `new Date()` as real upcoming dates pass.
const CUTOFF = '2026-10-02';

describe('concert catalogue (upcoming-only)', () => {
  it('contains no completed entries', () => {
    expect(CONCERTS.filter((c) => c.status === 'completed')).toEqual([]);
  });

  it('keeps every upcoming entry on or after the refresh cutoff', () => {
    // `announced` rumours keep their reported dates and are exempt.
    for (const c of CONCERTS.filter((c) => c.status === 'upcoming')) {
      expect(
        c.date >= CUTOFF,
        `${c.slug} is dated ${c.date}, before cutoff ${CUTOFF}`
      ).toBe(true);
    }
  });

  it('uses unique slugs and well-formed rows', () => {
    const slugs = CONCERTS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CONCERTS) {
      expect(c.artist.trim()).not.toBe('');
      expect(c.artistHandle.trim()).not.toBe('');
      expect(c.tourName.trim()).not.toBe('');
      expect(c.venue.trim()).not.toBe('');
      expect(c.city.trim()).not.toBe('');
      expect(c.description.trim()).not.toBe('');
      expect(Number.isNaN(new Date(c.date).getTime())).toBe(false);
      expect(c.year).toBe(new Date(c.date).getFullYear());
    }
  });

  it('resolves every upcoming artistHandle to merch metadata', () => {
    const missing = [
      ...new Set(
        CONCERTS.filter((c) => c.status === 'upcoming').map((c) => c.artistHandle)
      ),
    ].filter((h) => !ARTISTS[h]);
    expect(missing).toEqual([]);
  });

  it('gives every concert artist a hero image', () => {
    const missing = [
      ...new Set(CONCERTS.map((c) => c.artistHandle)),
    ].filter((h) => !ARTISTS[h]?.heroImage);
    expect(missing).toEqual([]);
  });

  it('keeps optional detail fields well-formed', () => {
    for (const c of CONCERTS) {
      if (c.ticketUrl !== undefined) {
        expect(c.ticketUrl.startsWith('https://')).toBe(true);
      }
      if (c.ticketPriceFrom !== undefined) {
        expect(Number.isInteger(c.ticketPriceFrom)).toBe(true);
        expect(c.ticketPriceFrom).toBeGreaterThan(0);
      }
      for (const list of [c.supportActs, c.keySongs]) {
        if (list !== undefined) {
          expect(list.length).toBeGreaterThan(0);
          for (const s of list) expect(s.trim()).not.toBe('');
        }
      }
      if (c.startTime !== undefined) expect(c.startTime.trim()).not.toBe('');
    }
    // Ticket links are per-show pages; two shows only share one for a
    // multi-night run by the same artist on a single event page.
    const seen = new Map<string, string>();
    for (const c of CONCERTS) {
      if (!c.ticketUrl) continue;
      const owner = seen.get(c.ticketUrl);
      expect(
        !owner || owner === c.artistHandle,
        `${c.slug} reuses ${c.ticketUrl} across artists`
      ).toBe(true);
      seen.set(c.ticketUrl, c.artistHandle);
    }
  });

  it('helpers stay consistent with the data', () => {
    for (const c of CONCERTS) {
      expect(getConcertBySlug(c.slug)).toBe(c);
      expect(getConcertsByArtist(c.artistHandle)).toContain(c);
    }
    expect(getConcertBySlug('no-such-concert')).toBeUndefined();
    const upcoming = getUpcomingConcerts();
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((c) => c.status !== 'completed')).toBe(true);
  });

  it('groups upcoming shows by artist sorted soonest-first', () => {
    const grouped = getUpcomingConcertsByArtist();
    expect(grouped.length).toBeGreaterThan(0);
    for (const g of grouped) {
      expect(g.allUpcoming.length).toBeGreaterThan(0);
      expect(g.nextShow).toBe(g.allUpcoming[0]);
      const times = g.allUpcoming.map((c) => new Date(c.date).getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
    const nextTimes = grouped.map((g) => new Date(g.nextShow.date).getTime());
    expect([...nextTimes].sort((a, b) => a - b)).toEqual(nextTimes);
  });
});

describe('concert countdown (IST-safe)', () => {
  it('counts whole calendar days regardless of time of day', () => {
    const noonIst = Date.parse('2026-11-01T12:00:00+05:30');
    expect(getDaysUntil('2026-11-01', noonIst)).toBe(0);
    expect(getDaysUntil('2026-11-02', noonIst)).toBe(1);
    expect(getDaysUntil('2026-10-31', noonIst)).toBe(-1);
  });

  it('labels urgency', () => {
    expect(getUrgencyLabel(0)).toBe('TODAY');
    expect(getUrgencyLabel(1)).toBe('TOMORROW');
    expect(getUrgencyLabel(44)).toBe('IN 44 DAYS');
  });

  it('formats dates for en-IN', () => {
    expect(formatConcertDate('2026-11-21')).toMatch(/Nov.*2026/);
  });
});

describe('concert artwork (per-concert images)', () => {
  it('gives every concert its own image file and credit', () => {
    const publicDir = path.join(process.cwd(), 'public');
    for (const c of CONCERTS) {
      expect(c.image, `${c.slug} is missing an image`).toMatch(/^\/concert-art\//);
      expect(
        existsSync(path.join(publicDir, c.image!)),
        `${c.slug} image ${c.image} is missing from public/`
      ).toBe(true);
      expect(c.imageCredit, `${c.slug} is missing an image credit`).toBeTruthy();
      expect(getConcertImageCredit(c), `${c.slug} credit does not resolve`).toBeTruthy();
    }
  });

  it('never resolves two concerts of one artist to the same image', () => {
    const seen = new Map<string, Set<string>>();
    for (const c of CONCERTS) {
      const image = getConcertImage(c);
      expect(image, `${c.slug} resolves to no image`).toBeTruthy();
      const set = seen.get(c.artistHandle) ?? new Set<string>();
      expect(
        set.has(image!),
        `${c.slug} shares ${image} with another ${c.artist} show`
      ).toBe(false);
      set.add(image!);
      seen.set(c.artistHandle, set);
    }
  });
});
