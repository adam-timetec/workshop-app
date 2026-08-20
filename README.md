# TimeTec Lunch Orders

An internal food-ordering tool for TimeTec staff. Administrators maintain the menu
and open ordering rounds; staff save their choices and see the shared team order list.

## Run it (no setup needed)

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Public pages render without a backend. The protected
workspace shows a setup notice until Supabase is connected and the schema is installed.

## The seams (where each module plugs in)

| Module | What you touch |
|---|---|
| 1 — GitHub | `workshop-profile.md` (your first commit) |
| 3 — MCP & skills | `.mcp.json`, `.codex/config.toml`, `.claude/skills/` |
| 4 — Customize | `lib/config/brand.ts`, `app/page.tsx`, and `tokens.css` |
| 5 — Supabase | run `supabase/workshop-schema.sql`, then create `.env.local` from `.env.example` |
| 6 — Security | `/review-security` skill + the two-account test |
| 7 — Deploy | `/prepare-deployment` skill + Vercel |

## Connecting Supabase (Module 5)

1. Create a Supabase project.
2. SQL editor → paste and run `supabase/workshop-schema.sql` (once).
3. Copy `.env.example` to `.env.local` and fill in your project's URL and
   publishable key (Project Settings → API). Both values are browser-safe.
4. Restart the dev server and create the first staff account.
5. In the Supabase SQL editor, promote that account:

```sql
update public.profiles
set role = 'admin'
where id = '<auth-user-uuid>';
```

6. Sign in, add menu items, and create the first ordering round.

**Email confirmation is OFF** in the workshop Supabase template — sign-up signs you
straight in. (If your project has it ON, sign-up shows "check your email" instead;
the app handles both.)

## Environment variables

Only three, all public (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
No secret key is used anywhere — there is nothing here that must be hidden,
and `.env.local` is git-ignored anyway.

## Security model (the short version)

- `/app` verifies identity on the server and redirects signed-out visitors.
- Authenticated staff can read the shared menu and submitted team orders.
- Staff orders are written through a database function that verifies the active
  round and copies current menu prices; browser-supplied prices are ignored.
- Menu and ordering-round changes require an administrator role in both the
  server action and Supabase Row Level Security.
- User-entered text is rendered as plain text, never as HTML.

## Deploying (Module 7)

Deploys to Vercel Hobby from a GitHub fork. Set the three env vars in Vercel
(`NEXT_PUBLIC_SITE_URL` = your `*.vercel.app` URL), deploy, then set the same URL
as the Site URL in Supabase Auth settings. The `/prepare-deployment` skill walks
the whole checklist.
