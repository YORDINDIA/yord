import { Ruler } from 'lucide-react';

export const metadata = {
  title: 'Size Guide | YORD India',
  description: 'Find your perfect fit with our comprehensive size guide for all merchandise.',
};

export default function SizeGuidePage() {
  return (
    <main className="min-h-screen bg-surface-page pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Ruler className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4">
            Size Guide
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-2xl mx-auto">
            Find your perfect fit with our comprehensive size chart. All measurements are in centimeters.
          </p>
        </div>

        {/* T-Shirts & Tops */}
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
            T-SHIRTS & TOPS
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-card border border-border-default">
              <thead>
                <tr className="bg-surface-raised">
                  <th className="px-6 py-4 text-left font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">SIZE</th>
                  <th className="px-6 py-4 text-center font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">CHEST (CM)</th>
                  <th className="px-6 py-4 text-center font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">LENGTH (CM)</th>
                  <th className="px-6 py-4 text-center font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">SHOULDER (CM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {[
                  { size: 'XS', chest: '86-91', length: '66', shoulder: '42' },
                  { size: 'S', chest: '91-96', length: '69', shoulder: '44' },
                  { size: 'M', chest: '96-101', length: '72', shoulder: '46' },
                  { size: 'L', chest: '101-106', length: '74', shoulder: '48' },
                  { size: 'XL', chest: '106-112', length: '76', shoulder: '50' },
                  { size: '2XL', chest: '112-117', length: '78', shoulder: '52' },
                  { size: '3XL', chest: '117-122', length: '80', shoulder: '54' },
                ].map((row) => (
                  <tr key={row.size} className="hover:bg-surface-raised/50">
                    <td className="px-6 py-4 font-[family-name:var(--font-bebas)] text-accent">{row.size}</td>
                    <td className="px-6 py-4 text-center font-[family-name:var(--font-jakarta)] text-text-muted">{row.chest}</td>
                    <td className="px-6 py-4 text-center font-[family-name:var(--font-jakarta)] text-text-muted">{row.length}</td>
                    <td className="px-6 py-4 text-center font-[family-name:var(--font-jakarta)] text-text-muted">{row.shoulder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hoodies & Sweatshirts */}
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
            HOODIES & SWEATSHIRTS
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-card border border-border-default">
              <thead>
                <tr className="bg-surface-raised">
                  <th className="px-6 py-4 text-left font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">SIZE</th>
                  <th className="px-6 py-4 text-center font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">CHEST (CM)</th>
                  <th className="px-6 py-4 text-center font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">LENGTH (CM)</th>
                  <th className="px-6 py-4 text-center font-[family-name:var(--font-bebas)] text-sm tracking-wider text-text-secondary">SLEEVE (CM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {[
                  { size: 'XS', chest: '94', length: '64', sleeve: '60' },
                  { size: 'S', chest: '100', length: '67', sleeve: '62' },
                  { size: 'M', chest: '106', length: '70', sleeve: '64' },
                  { size: 'L', chest: '112', length: '72', sleeve: '66' },
                  { size: 'XL', chest: '118', length: '74', sleeve: '68' },
                  { size: '2XL', chest: '124', length: '76', sleeve: '70' },
                  { size: '3XL', chest: '130', length: '78', sleeve: '72' },
                ].map((row) => (
                  <tr key={row.size} className="hover:bg-surface-raised/50">
                    <td className="px-6 py-4 font-[family-name:var(--font-bebas)] text-accent">{row.size}</td>
                    <td className="px-6 py-4 text-center font-[family-name:var(--font-jakarta)] text-text-muted">{row.chest}</td>
                    <td className="px-6 py-4 text-center font-[family-name:var(--font-jakarta)] text-text-muted">{row.length}</td>
                    <td className="px-6 py-4 text-center font-[family-name:var(--font-jakarta)] text-text-muted">{row.sleeve}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Measurement Tips */}
        <section className="bg-surface-card border border-border-default p-8">
          <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
            HOW TO MEASURE
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-accent mb-2">CHEST</h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Measure around the fullest part of your chest, keeping the tape horizontal.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-accent mb-2">LENGTH</h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Measure from the highest point of the shoulder to the bottom hem.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-accent mb-2">SHOULDER</h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Measure from one shoulder seam to the other, across the back.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-accent mb-2">SLEEVE</h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Measure from the shoulder seam to the cuff along the outer edge.
              </p>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="mt-8 bg-accent-tint border border-accent/30 p-6">
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
            <strong className="text-accent">Pro Tip:</strong> If you&apos;re between sizes, we recommend going up a size for a relaxed fit.
            For a fitted look, choose your exact measurement size. Our merchandise is pre-shrunk to maintain its fit after washing.
          </p>
        </section>
      </div>
    </main>
  );
}
