# Supabase budget storage

Shrute Bucks stores signed-in users' budget records in `public.budget_records`. Every row belongs to `auth.uid()`, and row-level security limits read/write access to that signed-in user. The migration only creates this table and its policies; it does not alter other applications' tables or data.

The migration in `migrations/20261006000000_create_budget_records.sql` has been applied to the Supabase project configured for Shrute Bucks. Do not add a service-role key to the browser app; the existing publishable key plus the user's auth session is all the client needs.

On the first signed-in load, any pre-existing browser-only budget is copied into that user's isolated local cache and uploaded to the cloud table. Other devices then download that user's records after sign-in. Changes are queued locally while offline and retried when connectivity returns. Cross-device refresh checks run on focus and every 30 seconds.
