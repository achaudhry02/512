# AGENTS.md

## Cursor Cloud specific instructions

### Repository layout

The full **Convenience Store Command Center** app lives on branch `cursor/convenience-store-command-center-1598`. The `main` branch currently only contains a placeholder README. Check out the feature branch before installing dependencies or running the app.

### Services

| Service | Required? | Notes |
|---|---|---|
| Next.js dev server (`npm run dev`) | Yes | Single service for local/demo development |
| Supabase (hosted) | Only for full auth + persistence | Not required for demo mode |

There is no Docker, Makefile, or custom API server. The browser talks directly to Supabase when env vars are set.

### Standard commands

See `README.md` and `package.json` scripts:

- `npm run dev` — development server at http://localhost:3000
- `npm run lint` — ESLint
- `npm run build` / `npm run start` — production build and server
- No automated test script is defined in `package.json`

### Demo mode vs Supabase mode

Without `.env.local`, the app runs in **demo mode** with editable in-memory sample data (changes do not persist across refresh). This is sufficient for most UI and calculation verification.

For full-stack E2E (auth + persistence), create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Then run `supabase/schema.sql` in the Supabase SQL editor (see `README.md`).

### Dev server

Start in a tmux session so it stays running:

```bash
npm run dev
```

The app redirects `/` to `/dashboard`. Key routes: `/dashboard`, `/daily-sales`, `/expenses`, `/fuel`, `/lottery`, `/deli`, `/payroll`, `/reports`, `/settings`, `/login`.
