import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest config. Pure-node test env for the current suite (helpers +
 * auth routing + API route handlers) — no DOM required. When we add
 * React component tests (Phase 5 polish) flip the `environment` to
 * `jsdom` and pull in @testing-library/react + @vitejs/plugin-react.
 *
 * The `@/*` path alias is mirrored from tsconfig.json so test files
 * can import just like app code.
 *
 * Node 25 quirk: run via `npm test` (which resolves the bin
 * correctly); `npx vitest` may break on Node 25 per project-wide
 * workaround notes.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // tsconfig.json sets `jsx: "preserve"` so Next.js can own JSX
  // compilation for the app build. Vite 7+ / Vitest 4 use oxc (not
  // esbuild) for transforms, so we set the JSX runtime here rather
  // than via `esbuild.jsx`. The `automatic` runtime matches Next's
  // JSX output and lets email templates + future component tests
  // load without touching the app-side tsconfig.
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
})
