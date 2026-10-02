import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@yord/db-types': path.resolve(__dirname, '../packages/db-types/src/index.ts'),
      '@yord/auth': path.resolve(__dirname, '../packages/auth/src/index.ts'),
      '@yord/supabase-clients': path.resolve(__dirname, '../packages/supabase-clients/src/index.ts'),
      '@yord/ui': path.resolve(__dirname, '../packages/ui/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
