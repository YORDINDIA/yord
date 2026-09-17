// STUB ONLY — do not import this package yet. See README.md for the cutover plan.
// This file exists so the workspace resolves; the cutover crew fills it in.

export const SUPABASE_CLIENTS_CUTOVER_PENDING = true as const;

export type PendingCutover = {
  status: 'stub';
  target: '@yord/supabase-clients';
};
