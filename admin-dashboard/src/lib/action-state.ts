/**
 * ActionState: the single return shape every admin server action uses.
 *
 * Previously 14 inline `'use server'` actions discarded their errors and
 * returned `undefined`, so the form re-rendered identically and the admin
 * concluded the write succeeded. Every action now returns this type: success is
 * explicit, failures carry either per-field messages or a form-level error, and
 * a client can always tell the three apart.
 *
 * Modelled as one interface with a `status` discriminant rather than a
 * discriminated union, so a caller can read `state.message` after narrowing on
 * `status !== 'error'` without the union narrowing getting in the way.
 */
export interface ActionState<T = undefined> {
  status: 'idle' | 'success' | 'error';
  /** Success confirmation copy. */
  message?: string;
  /** Payload a success action wants to hand back to the client. */
  data?: T;
  /** Banner-level message. DB failures and authorization denials. */
  formError?: string;
  /** Field name → messages, straight from a zod `flatten().fieldErrors`. */
  fieldErrors?: Record<string, string[]>;
}

/** The shape `useActionState` wants as its initial value. */
export const INITIAL_ACTION_STATE: ActionState = { status: 'idle' };

/** Success result. */
export function actionOk<T>(message?: string, data?: T): ActionState<T> {
  return { status: 'success', message, data };
}

/** Form-level failure (DB error, auth denial, unexpected throw). */
export function actionError(
  formError: string,
  fieldErrors?: Record<string, string[]>,
): ActionState<never> {
  return { status: 'error', formError, fieldErrors };
}

/** Per-field failure, straight from zod. */
export function actionFieldErrors(fieldErrors: Record<string, string[]>): ActionState<never> {
  return { status: 'error', fieldErrors };
}
