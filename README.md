# Shrute Bucks

Shrute Bucks is a retro-styled budgeting app for planning a month, reviewing actual spending, and importing transactions from CSV or Excel files. It is built with React, TypeScript, Vite, and Supabase Auth; budget data is stored locally and can sync to a Supabase project.

## Run it locally

1. Install Node.js (20.19+ or 22.12+).
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in your own Supabase project URL and publishable key.
4. Apply [`supabase/migrations/20261006000000_create_budget_records.sql`](supabase/migrations/20261006000000_create_budget_records.sql) to your Supabase project.
5. Start the app with `npm run dev` and open the local address Vite prints.

Without Supabase settings, the app shows a setup message instead of the sign-in form. Never put a Supabase service-role key or a user's password in this client app. The browser uses a publishable key; database access must be restricted by the included row-level security policies.

## Checks

- `npm test -- --run` runs the test suite.
- `npm run check` runs TypeScript checks, tests, and a production build.

## Deployment

The app can be deployed as a static Vite site on Vercel or another static host. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider's build environment. The repository does not contain environment secrets.

## Public assets

The site uses its bundled logo, fonts, and character images under `public/`. Raw image inputs and local working notes are not needed to build the app and are excluded from the public source release.

No open-source license is currently provided. Public visibility permits viewing and downloading this repository through GitHub; it does not grant additional rights to reuse its code or artwork.
