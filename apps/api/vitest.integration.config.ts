import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    poolOptions: {
      workers: {
        singleWorker: true,
        miniflare: {
          compatibilityDate: '2025-01-15',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: { DB_META: 'arbor-meta', DB_WS_DEFAULT: 'ws_default' },
          r2Buckets: { ASSETS: 'arbor-assets' },
          kvNamespaces: { KV: 'arbor-kv' },
          durableObjects: { RUN_DO: 'RunDO', WORKSPACE_DO: 'WorkspaceDO' },
        },
      },
    },
  },
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname,
    },
  },
});
