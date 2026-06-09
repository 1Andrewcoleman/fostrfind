import { defineConfig, globalIgnores } from 'eslint/config'
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

// Flat-config migration of the old .eslintrc.json (`next lint` was removed
// in Next 16 and ESLint 10 dropped eslintrc support).
export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**']),
  coreWebVitals,
  typescript,
  {
    rules: {
      // `^_` prefix marks intentionally unused stub args/vars.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/no-danger': 'error',
      // React Compiler rules (react-hooks v7). Two codebase patterns trip
      // them intentionally: `window.location.href = …` hard navigations
      // after auth state changes (see CLAUDE.md), and hydration-safe
      // setState-in-effect (RelativeTime, sidebar). Keep as warnings until
      // the React Compiler is actually adopted.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
])
