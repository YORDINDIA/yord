/**
 * The option half of a variant title, for the dashboard's low-stock list.
 *
 * Shopify variant titles repeat the product title and append the options
 * ("<product> - White / 3XL"), so the useful half — size, colour, fit — sits
 * past the ellipsis. Strip the repeated prefix and keep the options; a variant
 * whose title adds nothing returns null and the row renders one line.
 *
 * The prefix is only stripped when what follows it is an option separator
 * (`-`, `–`, `—`, `:`, `|`, `/`) or nothing at all (the title merely repeats
 * the product name). A variant whose title merely *starts with* the product
 * name — "Classic Tee Classic Tee Long Sleeve" against product "Classic Tee" —
 * keeps its full text: stripping at the bare prefix corrupted valid option
 * text into a fragment that named nothing.
 */
export function variantDetail(productTitle: string, variantTitle: string | null): string | null {
  const variant = variantTitle?.trim();
  if (!variant) return null;

  const product = productTitle.trim();
  if (!product || !variant.toLowerCase().startsWith(product.toLowerCase())) return variant;

  const rest = variant.slice(product.length).trim();
  // The title repeats the product name and nothing more: no detail line.
  if (rest === '') return null;
  // Not an option suffix — the match is a coincidence of naming, so the full
  // title is the honest thing to show.
  if (!/^[-–—:|/]/.test(rest)) return variant;

  return rest.replace(/^[-–—:|/]+\s*/, '').trim() || null;
}
