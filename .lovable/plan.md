# Smart Season Upgrade Pricing

Goal: When a user has rented individual episodes of a season within the last 7 days, let them upgrade to the full season for `₦1,200 − amount already spent on episodes of that season`. When their eligible spend reaches ₦1,200, automatically grant season access without further payment.

All amounts are stored in **kobo** (existing convention). ₦1,200 = `120000` kobo.

---

## 1. Database

New migration adding a `rental_credits` ledger plus helper RPCs.

### `public.rental_credits`

Tracks every successful episode rental that counts toward a season upgrade.

Columns:

- `user_id` (uuid)
- `season_id` (uuid) — derived from the episode's `season_id`
- `episode_id` (uuid)
- `rental_intent_id` (uuid, unique) — idempotency key, links to source intent
- `amount_paid` (bigint, kobo)
- `rental_date` (timestamptz, default now())

Indexes: `(user_id, season_id, rental_date desc)`, unique on `rental_intent_id`.

GRANTs: `service_role` full; `authenticated` select own (RLS `user_id = auth.uid()`).

### Trigger: backfill on paid episode intent

`AFTER INSERT OR UPDATE` on `rental_intents` when `NEW.status = 'paid'` AND `NEW.rental_type = 'episode'`:

1. Resolve `season_id` from `episodes` table.
2. Insert into `rental_credits` (`ON CONFLICT (rental_intent_id) DO NOTHING`).
3. Recompute `eligibleSpend` for the user/season within last 7 days.
4. If `eligibleSpend >= 120000` and no active season `rental_access` exists, call `grant_rental_access(..., 'season', ...)` with the season's `rental_expiry_duration` (default 14 days / 336h) and mark metadata `{ source: 'auto_unlock' }`. This is the "automatic unlock".

### RPC: `calculate_season_upgrade_price(p_user_id, p_season_id)`

Returns:

```
{ eligible_spend bigint, upgrade_price bigint, full_price bigint, qualifies boolean }
```

Logic: sum `amount_paid` from `rental_credits` where `user_id=$1`, `season_id=$2`, `rental_date >= now() - interval '7 days'`. `upgrade_price = greatest(120000 - eligible_spend, 0)`. `qualifies = eligible_spend > 0` AND no active season access.

`SECURITY DEFINER`, granted to `authenticated`.

### One-time backfill

Insert into `rental_credits` for any already-paid episode `rental_intents` so existing customers immediately benefit.

---

## 2. Edge functions

### `_shared/rental.ts`

Add `getSeasonUpgradeQuote(supabase, userId, seasonId)` wrapping the new RPC.

### `process-rental/index.ts`

When `contentType === 'season'`:

1. Before charging, call the RPC. If `qualifies`, override `price` with `upgrade_price` (clamped ≥ 0).
2. After successful payment (both wallet and Paystack paths), in a single transaction:
  - Insert the season `rental_access` (already happens via `grant_rental_access` / `process_wallet_rental_payment`).
  - **Revoke** outstanding episode `rental_access` rows for that season: `update rental_access set revoked_at = now(), status='failed' where user_id=$1 and season_id in (select id from episodes where season_id=$2) and revoked_at is null`.
  - Insert audit row into `rental_audit_log` describing the upgrade and the credited amount.

If `upgrade_price = 0` (already covered by spend), short-circuit: skip Paystack, mint season access for free, and return success. This is the manual path to the "auto unlock" outcome.

### `paystack-webhook/index.ts`

On successful season payment, after granting access run the same episode-revocation step so Paystack-paid upgrades behave identically to wallet upgrades.

### `wallet-payment/index.ts`

Same revocation hook for season purchases paid from wallet.

No new secrets required.

---

## 3. Frontend

### New hook `src/hooks/useSeasonUpgradeQuote.ts`

- Inputs: `seasonId`.
- Calls `supabase.rpc('calculate_season_upgrade_price', ...)` via React Query.
- Returns `{ eligibleSpend, upgradePrice, fullPrice, qualifies, isLoading }`.
- Invalidated on rental success events.

### `OptimizedRentalCheckout.tsx` & `RentalBottomSheet.tsx`

When the target is a **season**:

- Call `useSeasonUpgradeQuote`.
- If `qualifies`:
  - Show banner: `You've spent ₦{formatNaira(eligibleSpend)} on episodes. Upgrade to the full season for ₦{formatNaira(upgradePrice)}.`
  - Replace the displayed price with `upgradePrice`.
  - If `upgradePrice === 0`, swap the CTA to "Unlock season" and skip payment-method selection; submit goes straight to `process-rental` which returns instant access.
- Pass the upgrade pricing intent to `process-rental` only for telemetry; the backend recomputes authoritatively.

### Episode/Season detail surfaces (`OptimizedRentalButton`, season pages)

- Show the same nudge inline when `qualifies` so users see the offer before opening checkout.

### Cache invalidation

After `process-rental` resolves, invalidate `useSeasonUpgradeQuote`, `useOptimizedRentals`, and `useWallet`.

---

## 4. Safety / rollout

- Backend is the source of truth for upgrade price — frontend value is advisory only.
- Episode-access revocation runs **after** the season access row is committed so users never lose access mid-transaction.
- `rental_intent_id` unique constraint on `rental_credits` prevents double-counting from webhook retries.
- Auto-unlock trigger is idempotent (checks for existing active season access first).
- All existing flows (movie rentals, episode rentals, wallet top-ups) are untouched.

---

## Technical Notes

- ₦1,200 threshold lives in one place: a `SEASON_UPGRADE_TARGET_KOBO = 120000` constant exported from `_shared/rental.ts` and mirrored in `src/lib/priceUtils.ts` for display.
- 7-day window enforced in SQL (`rental_date >= now() - interval '7 days'`) so timezone drift on clients is irrelevant.
- Migration order: create table + grants + RLS → create trigger function → attach trigger → create RPC → backfill.
- No changes to `src/integrations/supabase/types.ts` are written by hand; it regenerates after the migration runs.  
  
note: perfect but Don't burn more credits on this