# Fostr Find

Web app that connects **animal shelters** with **foster parents** (browse dogs, apply, message, track placements).

---

## Who sees what

| Role | In plain English |
|------|------------------|
| **Shelter** | Lists dogs, reviews applications, chats with fosters, marks placements complete, can rate after completion. |
| **Foster** | Browses available dogs, applies, chats after acceptance, views history. |

Same product, **two separate areas** in the UI (different sidebar and URLs).

---

## Happy path (one story)

1. Foster browses → opens a dog → **applies**.  
2. Shelter **accepts** the application → both can **message** on that application.  
3. When the placement ends, shelter **marks complete** → optional **rating** of the foster.

---

## URLs (map of the app)

**Everyone**

- `/` — landing  
- `/login`, `/signup`, `/onboarding` — auth and first-time profile  

**Shelter staff** — all under `/shelter/…`

- `dashboard` · `dogs` (+ create / edit / delete) · `applications` (+ detail) · `messages` (+ thread) · `settings`  

**Foster** — all under `/foster/…`

- `browse` · `dog/[id]` · `applications` · `messages` (+ thread) · `profile` · `history`  

`src/app/(shelter)/` and `src/app/(foster)/` only group **layouts** (sidebars). The **path in the URL** is still `/shelter/...` and `/foster/...`.

---

## Repo layout (where to look)

```
src/app/           → pages & API routes (Next.js App Router)
src/components/    → reusable UI (by area: foster/, shelter/, shared)
src/lib/           → Supabase clients, auth routing, helpers
supabase/migrations/ → database schema & security (RLS)
```

**Deeper detail:** [`CLAUDE.md`](CLAUDE.md) (how it’s built) · [`docs/TODO.md`](docs/TODO.md) (backlog)

---

## Development

```bash
npm install
node node_modules/next/dist/bin/next dev
```

Copy `.env.example` → `.env.local` with Supabase URL + anon key. If the URL isn’t a real `http(s)` Supabase URL, the app runs in **dev mode** (auth relaxed, some features stubbed).

Build / typecheck / lint:

```bash
node node_modules/next/dist/bin/next build
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/
```

**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Supabase, Radix UI.
