import { AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Inline failure block for the AI studios.
 *
 * The studios are client components and their failures were toast-only, which
 * vanishes after four seconds and leaves no trace of *why* a generation failed.
 * This is the same `.form-alert form-alert-error` treatment `FormError` gives
 * action forms, with the route's own message passed through — the routes only
 * ever return admin-safe copy.
 */
export default function InlineError({ message }: { message: string }) {
  return (
    <div className="form-alert form-alert-error tone-rose" role="alert">
      {/* `flex: none`: `.form-alert` has no `svg` rule, so a long upstream
          message in a narrow column would squash the glyph. */}
      <AlertCircle size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
      <span>{message}</span>
    </div>
  );
}

/** Matching success block — a committed write should stay visible, not just toast. */
export function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="form-alert form-alert-success tone-emerald" role="status">
      <CheckCircle2 size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
      <span>{message}</span>
    </div>
  );
}
