import { createServiceClient, type ServerClient } from '@/lib/supabase/server';
import { DatabaseError } from '@/lib/errors';

/**
 * Allocate the next BIGINT id for a table via `admin_next_id()`.
 *
 * `admin_next_id` is typed in `@yord/db-types`, so the return value needs no
 * `Number(data)` cast. The service client is memoized per process: the old
 * version constructed a fresh one on every call and `getNextId` was invoked
 * inside a per-row loop on collections/[id], meaning one client per product id.
 */
let cached: ServerClient | null = null;

function service(): ServerClient {
  if (!cached) cached = createServiceClient();
  return cached;
}

export async function getNextId(table: string): Promise<number> {
  const { data, error } = await service().rpc('admin_next_id', {
    p_table: table,
  });
  if (error) throw new DatabaseError(table, error.message, error.code);
  return data;
}
