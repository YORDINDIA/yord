import { Ruler } from 'lucide-react';

export const metadata = {
  title: 'Size Guide',
  description: 'Find your perfect fit with our comprehensive size guide for all merchandise.',
  alternates: { canonical: '/size-guide' },
};

interface SizeTableProps {
  /** Screen-reader name for the table; the visible heading sits above it. */
  caption: string;
  columns: string[];
  rows: { size: string; values: string[] }[];
}

/**
 * The two charts are the same table with a different last column, so they share
 * one component. `scope` and a `caption` are what make a size chart usable with
 * a screen reader — without them the numbers are announced with no column
 * context. `min-w-[640px]` keeps four columns legible on a phone by scrolling
 * the wrapper instead of squeezing the cells.
 */
function SizeTable({ caption, columns, rows }: SizeTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] bg-surface-card border border-border-default">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-raised">
            <th
              scope="col"
              className="px-6 py-4 text-left font-accent text-sm tracking-wider text-text-secondary"
            >
              SIZE
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-6 py-4 text-center font-accent text-sm tracking-wider text-text-secondary"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {rows.map((row) => (
            <tr key={row.size} className="hover:bg-surface-raised/50">
              <th scope="row" className="px-6 py-4 text-left font-accent text-accent">
                {row.size}
              </th>
              {row.values.map((value, i) => (
                <td key={i} className="px-6 py-4 text-center font-body text-text-muted">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const T_SHIRT_ROWS = [
  { size: 'XS', values: ['86-91', '66', '42'] },
  { size: 'S', values: ['91-96', '69', '44'] },
  { size: 'M', values: ['96-101', '72', '46'] },
  { size: 'L', values: ['101-106', '74', '48'] },
  { size: 'XL', values: ['106-112', '76', '50'] },
  { size: '2XL', values: ['112-117', '78', '52'] },
  { size: '3XL', values: ['117-122', '80', '54'] },
];

const HOODIE_ROWS = [
  { size: 'XS', values: ['94', '64', '60'] },
  { size: 'S', values: ['100', '67', '62'] },
  { size: 'M', values: ['106', '70', '64'] },
  { size: 'L', values: ['112', '72', '66'] },
  { size: 'XL', values: ['118', '74', '68'] },
  { size: '2XL', values: ['124', '76', '70'] },
  { size: '3XL', values: ['130', '78', '72'] },
];

const MEASUREMENTS = [
  {
    title: 'CHEST',
    description: 'Measure around the fullest part of your chest, keeping the tape horizontal.',
  },
  {
    title: 'LENGTH',
    description: 'Measure from the highest point of the shoulder to the bottom hem.',
  },
  {
    title: 'SHOULDER',
    description: 'Measure from one shoulder seam to the other, across the back.',
  },
  {
    title: 'SLEEVE',
    description: 'Measure from the shoulder seam to the cuff along the outer edge.',
  },
];

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen bg-surface-page pt-32 pb-16">
      <div className="container-page">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Ruler aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4">
            Size Guide
          </h1>
          <p className="font-body text-text-muted max-w-2xl mx-auto">
            Find your perfect fit with our comprehensive size chart. All measurements are in centimeters.
          </p>
        </div>

        {/* T-Shirts & Tops */}
        <section className="mb-12">
          <h2 className="font-display text-xl md:text-2xl text-text-primary mb-6">
            T-Shirts &amp; Tops
          </h2>
          <SizeTable
            caption="T-shirt and top size chart in centimetres"
            columns={['CHEST (CM)', 'LENGTH (CM)', 'SHOULDER (CM)']}
            rows={T_SHIRT_ROWS}
          />
        </section>

        {/* Hoodies & Sweatshirts */}
        <section className="mb-12">
          <h2 className="font-display text-xl md:text-2xl text-text-primary mb-6">
            Hoodies &amp; Sweatshirts
          </h2>
          <SizeTable
            caption="Hoodie and sweatshirt size chart in centimetres"
            columns={['CHEST (CM)', 'LENGTH (CM)', 'SLEEVE (CM)']}
            rows={HOODIE_ROWS}
          />
        </section>

        {/* Measurement Tips */}
        <section className="bg-surface-card border border-border-default p-8">
          <h2 className="font-display text-xl md:text-2xl text-text-primary mb-6">
            How to Measure
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {MEASUREMENTS.map((measurement) => (
              <div key={measurement.title}>
                <h3 className="font-accent text-sm tracking-wider text-accent mb-2">
                  {measurement.title}
                </h3>
                <p className="font-body text-sm text-text-muted">
                  {measurement.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="mt-8 bg-accent-tint border border-accent/30 p-6">
          <p className="font-body text-sm text-text-muted">
            <strong className="text-accent">Pro Tip:</strong> If you&apos;re between sizes, we recommend going up a size for a relaxed fit.
            For a fitted look, choose your exact measurement size. Our merchandise is pre-shrunk to maintain its fit after washing.
          </p>
        </section>
      </div>
    </div>
  );
}
