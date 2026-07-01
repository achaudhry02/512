# AGENTS.md

## Cursor Cloud specific instructions

### Repository layout

The full **Convenience Store Command Center** app lives on branch `cursor/convenience-store-command-center-1598`. The `main` branch currently only contains a placeholder README. Check out the feature branch before installing dependencies or running the app.

### Services

| Service | Required? | Notes |
|---|---|---|
| Next.js dev server (`npm run dev`) | Yes | Local web server |
| Supabase (hosted) | Yes | Required for auth, reads, and writes |

The browser talks directly to Supabase for authenticated reads and writes. Smart Import also uses a Next.js API route for file parsing.

### Standard commands

See `README.md` and `package.json` scripts:

- `npm run dev` - development server at http://localhost:3000
- `npm run typecheck` - TypeScript validation without emitting files
- `npm run lint` - ESLint
- `npm test` - lint, core calculation/bulk-entry tests, and Sunoco parser tests
- `npm run build` / `npm run start` - production build and server

### Supabase configuration

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Without these variables, the app shows a configuration error and will not load fallback data. Run `supabase/schema.sql` in the Supabase SQL editor before using the live app (see `README.md`).

### Dev server

Start the server so it stays running:

```bash
npm run dev
```

The app redirects `/` to `/dashboard`. Key routes: `/dashboard`, `/daily-sales`, `/bulk-entry`, `/inventory`, `/vendors`, `/expenses`, `/fuel`, `/lottery`, `/deli`, `/payroll`, `/employees`, `/reports`, `/settings`, `/smart-import`, `/login`.
