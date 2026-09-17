import { createServiceClient } from '@/lib/supabase/server';

export async function getNextId(table: string): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('admin_next_id', {
    p_table: table,
  });
  if (error) throw new Error(error.message);
  return Number(data);
}
