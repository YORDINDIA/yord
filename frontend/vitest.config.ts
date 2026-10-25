import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@yord/db-types': path.resolve(__dirname, '../packages/db-types/src/index.ts'),
      '@yord/supabase-clients': path.resolve(__dirname, '../packages/supabase-clients/src/index.ts'),
      '@yord/ui': path.resolve(__dirname, '../packages/ui/src/index.ts'),
      // `server-only` is a bundle-boundary marker, not a runtime check: Next
      // swaps in a throwing module for client bundles. Vitest resolves it with
      // the browser condition, so without this alias any suite importing a
      // server module fails at load. See src/test/server-only-stub.ts.
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
