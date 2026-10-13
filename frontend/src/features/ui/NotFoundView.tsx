import { CtaLink } from './CtaLink';

/** Branded 404 shared by every `not-found.tsx`. Server-safe. */
export function NotFoundView({
  title = 'Page not found',
  message = 'The page you are looking for does not exist or was moved.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    // The group layout (`(main)/layout.tsx`, `(auth)/layout.tsx`) owns the
    // page's main landmark and its skip-link id, and this view renders inside
    // it — a landmark here would nest inside that one and duplicate the id.
    // `tabIndex={-1}` stays so the view can still take programmatic focus.
    <div
      tabIndex={-1}
      className="min-h-[60vh] flex items-center justify-center bg-surface-page px-6"
    >
      <div className="text-center">
        <p className="font-accent text-xs tracking-[0.3em] text-accent mb-3">
          404
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-4">
          {title}
        </h1>
        <p className="font-body text-sm text-text-muted max-w-md mx-auto mb-8">
          {message}
        </p>
        <CtaLink href="/" size="lg">
          BACK TO HOME
        </CtaLink>
      </div>
    </div>
  );
}
