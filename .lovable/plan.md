## Root cause

Three things broke the app at the database/routing layer; the frontend itself is mostly intact.

1. **`/` route points to `Maintenance`** in `src/App.tsx` — the real landing (`Index`) is no longer mounted, which is why the homepage is empty (no hero slider, no movie/TV sections).
2. **The `on_auth_user_created` trigger on `auth.users` was dropped** (see `supabase/migrations/20260630_remove_handle_new_user_and_trigger.sql`). No trigger means new signups never get a `profiles` row, never get a `wallets` row, and never receive the 400 NGN signup bonus — that is why signup "behaves abnormally".
3. **RLS is enabled on almost every table but the policies are missing.** A query of `pg_policies` returns policies for only `profiles`, `user_roles`, and `wallets`. Every other table (`movies`, `tv_shows`, `seasons`, `episodes`, `sections`, `content_sections`, `slider_items`, `banners`, `genres`, `rentals`, `rental_intents`, `rental_access`, `payments`, `referral_codes`, `job_listings`, `wallet_transactions`, `favorites`, `watch_history`, …) has RLS on with zero policies, so PostgREST returns empty arrays for reads and rejects every insert. That single fact explains:
   - Empty landing page (movies/tv/sections/slider_items unreadable),
   - Admin can't create or view hero slider / movies / TV shows,
   - Admin can't see rentals, finance, or job listings,
   - `new row violates row-level security policy for table "referral_codes"` when admin tries to create a referral code.
4. Additionally `profiles`, `user_roles`, and `wallets` currently have `rowsecurity = false` (RLS disabled) even though policies are defined — that is a regression we'll re-enable so the policies actually take effect.

## Fix plan

### 1. Restore the landing page (frontend, 1 line)
In `src/App.tsx`, change `<Route path="/" element={<Maintenance />} />` to `<Route path="/" element={<Index />} />` and add the lazy import for `Index`. Keep `Maintenance` available at `/maintenance` only (no other code touched).

### 2. Add phone number to signup + 400 bonus signup flow (frontend)
- `src/pages/Auth.tsx`: add a Phone Number input to the signup form state and JSX (optional field, simple validation).
- `src/contexts/AuthContext.tsx`: extend `signUp(email, password, name?, phoneNumber?)` and pass `phone_number` inside `options.data` so the trigger picks it up from `raw_user_meta_data`.
- No new components or routes.

### 3. Single migration to repair the backend

One migration file containing, in order:

**A. Re-enable RLS on the three tables where it got turned off**
```sql
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets     ENABLE ROW LEVEL SECURITY;
```

**B. Recreate `handle_new_user` + trigger** so every signup gets a profile (with name + phone from `raw_user_meta_data`), a wallet, and a 400 NGN bonus credited via the existing `grant_signup_bonus` helper. Trigger is `AFTER INSERT ON auth.users FOR EACH ROW`.

**C. Add the missing RLS policies.** Grouped by access pattern (all use the existing `public.has_role` / `public.is_staff` security-definer helpers — no recursion):

- **Public read, staff write** (catalog + homepage data):
  `movies`, `tv_shows`, `seasons`, `episodes`, `genres`, `sections`, `content_sections`, `slider_items`, `banners`, `cast_crew`, `movie_cast`, `tv_show_cast`, `episode_cast`.
  → `SELECT` policy `USING (true)` for `anon` + `authenticated`; `INSERT/UPDATE/DELETE` policy `USING (public.is_staff(auth.uid()))`.
  → Also add the matching `GRANT SELECT ON … TO anon` and `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` since they were never granted.

- **Public read of active rows only**:
  `job_listings` (`status = 'active'` for anon, full access for staff).

- **User-owned data** (`USING (auth.uid() = user_id)` for select/insert/update/delete, plus staff override):
  `rentals`, `rental_intents`, `rental_access`, `payments`, `wallet_transactions`, `favorites`, `watch_history`, `user_preferences`, `purchases`, `referral_code_uses`, `push_device_tokens`, `user_payments`.

- **Staff-only** (admin tooling):
  `referral_codes` (this is the one currently throwing the RLS error), `payouts`, `finance_audit_logs`, `transactions_ledger`, `payment_anomalies`, `payment_attempts`, `producers`, `submissions`, `rental_payments`, `rental_audit_log`, `email_logs`, `push_notifications`, `ticket_templates`, `permissions`, `roles`, `role_permissions`, `webhook_events`, `job_applications`.

- **Ticket access**: `tickets` / `ticket_comments` / `ticket_activity_log` — owner can read their own, staff can read/write all.

- **`user_roles`**: keep the existing `roles_select_own` policy, add staff `SELECT/INSERT/UPDATE/DELETE` via `has_role(auth.uid(),'super_admin')` so the admin Users page works.

- **`profiles`**: keep existing own-row policies, add staff `SELECT` so admin user list works.

- **`wallets`**: keep existing own-row select, add staff `SELECT` for admin wallet view.

**D. GRANTs** (re-issued for every public-schema table touched, matching the policies above) — required because PostgREST does not grant defaults on `public`. Service role gets `ALL`.

### 4. Verification
After the migration runs, manually verify:
- Homepage loads with hero slider + sections.
- Admin → Hero Slider / Movies / TV Shows / Rentals / Finance / Job Listings all load and create works.
- Admin → Referral Codes: create no longer throws RLS error.
- Sign up a new account → profile + wallet created, wallet balance shows 400 NGN.

## Files touched

- `src/App.tsx` — swap `/` route, lazy-import `Index`.
- `src/pages/Auth.tsx` — add phone number field.
- `src/contexts/AuthContext.tsx` — extend `signUp` signature, forward phone in metadata.
- `supabase/migrations/<new timestamp>_restore_rls_and_signup_trigger.sql` — single consolidated migration described above.

No new pages, components, or edge functions. No edits to existing migrations.