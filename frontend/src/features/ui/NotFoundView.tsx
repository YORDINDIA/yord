import Link from 'next/link';

/** Branded 404 shared by every `not-found.tsx`. Server-safe. */
export function NotFoundView({
  title = 'Page not found',
  message = 'The page you are looking for does not exist or was moved.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <main className="min-h-[60vh] flex items-center justify-center bg-surface-page px-6">
      <div className="text-center">
        <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-accent mb-3">
          404
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-text-primary mb-4">
          {title}
        </h1>
        <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted max-w-md mx-auto mb-8">
          {message}
        </p>
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-accent-hover transition-colors"
        >
          BACK TO HOME
        </Link>
      </div>
    </main>
  );
}
