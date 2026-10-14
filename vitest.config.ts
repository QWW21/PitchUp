/**
 * Unit tests — T-01. One config, one project per package, run with `pnpm test`.
 *
 * Unit tests need no database, server or network. Anything that does lives
 * in apps/web/e2e (Playwright) instead.
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: here('./packages/shared'),
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        plugins: [tsconfigPaths({ root: here('./apps/web') })],
        resolve: {
          // `server-only` throws outside a React Server Component bundle; in
          // a unit test there is no such boundary to protect.
          alias: { 'server-only': here('./apps/web/test/server-only-stub.ts') },
        },
        test: {
          name: 'web',
          root: here('./apps/web'),
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'node',
          // Code under test reads env through @t3-oss/env-nextjs; unit tests
          // supply what they need instead of a full .env.
          env: {
            SKIP_ENV_VALIDATION: '1',
            NEXTAUTH_SECRET: 'unit-test-secret-at-least-thirty-two-chars',
          },
        },
      },
    ],
  },
})
