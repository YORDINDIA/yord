/**
 * The homepage's vertical rhythm.
 *
 * The sections had drifted across three paddings (`py-16`, `py-24`, `py-32`)
 * with no rule behind which one a section got, so the page read as blocks
 * stacked with inconsistent breathing room. Two values now: the standard
 * section and the one narrative pause (`BrandStory`).
 *
 * These are class strings, not a component, so a section can keep whatever
 * element it already renders — and Tailwind still sees the literals because
 * they live in a source file.
 */

/** Every content section: concerts, artist rails, featured products, newsletter. */
export const SECTION_PADDING = 'py-16 md:py-24';

/** BrandStory only — the one deliberate pause between the product sections. */
export const SECTION_PADDING_TALL = 'py-24 md:py-32';
