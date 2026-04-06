# Fostr Find

Code repository for **Fostr Find** — a Next.js app that connects animal shelters with foster parents.

## Development

```bash
npm install
# Dev server (Node 25: use next binary directly if .bin/next symlink is broken)
node node_modules/next/dist/bin/next dev
```

Build, typecheck, and lint:

```bash
node node_modules/next/dist/bin/next build
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/
```

Copy `.env.example` to `.env.local` and add your Supabase URL and anon key. Without a real Supabase URL, the app runs in dev mode with auth checks bypassed.

## Stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`), Radix UI.

See `CLAUDE.md` for architecture notes and `docs/TODO.md` for the technical backlog.
