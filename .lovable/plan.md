## Root cause

The new rental architecture (`rental_intents` → `rental_access`) is wired up correctly in `paystack-webhook`, `verify-payment`, and `rental-access`, but **`process-rental` never writes to it**. It only inserts into the legacy `payments` and `rentals` tables.

Result for Paystack flow:
1. User clicks Rent → `process-rental` creates a `payments` row, calls Paystack, returns `authorizationUrl`.
2. User pays. Paystack fires `charge.success` to `paystack-webhook`.
3. Webhook calls `loadRentalIntentByReference()` → **returns null** because no `rental_intents` row exists.
4. Webhook logs "Intent not found", exits without granting access.
5. `rental-access` (called by `Watch.tsx`) queries `rental_access` via `has_active_rental_access` RPC → empty → user is denied.
6. Frontend `usePaystackRentalVerification` polls `verify-payment`, which also can't find an intent → stays `pending` forever.

Confirmed by DB: `rental_intents` and `rental_access` are both empty (0 rows) while `payments` has 133 rental entries, many `paystack` + `pending` and never finalised.

Two secondary bugs that would also prevent webhook success even if the intent existed:

- `paystack-webhook.loadActiveRentalAccess` and `verify-payment.loadActiveRentalAccess` use `.eq("revoked_at", null)`. PostgREST treats this as `revoked_at = 'null'::text`, which never matches a real NULL. Must be `.is("revoked_at", null)`. (The dispute branch already uses `.is(...)` correctly.)
- The Paystack `query.or(...)` chain in webhook also reuses the same builder twice (`query.eq(...).maybeSingle()` then later `query.or(...)`), which double-applies filters. Needs separate query instances.

## Fix (no new functions/components)

### 1. `supabase/functions/process-rental/index.ts`

Replace `createWalletRental` and `createPaystackRental` so they write to the new schema while keeping the existing response shape (so the frontend keeps working unchanged).

**Wallet path:** call existing DB function `process_wallet_rental_payment` (already in the database). It atomically:
- locks the wallet, deducts balance,
- inserts `rental_intents` (status `paid`),
- inserts `rental_access` (status `paid`, with `expires_at`).

After it succeeds, also insert a `payments` row + `wallet_transactions` row for ledger continuity (existing admin/finance pages depend on it). Keep referral-code recording.

Return `{ success, paymentMethod: 'wallet', rentalId: rental_intent_id, paymentId, walletBalance, rentalExpiresAt }` — same shape `OptimizedRentalCheckout` already consumes.

**Paystack path:** before calling Paystack, insert a `rental_intents` row with:
- `user_id`, `rental_type`, `movie_id`/`season_id`/`episode_id`,
- `price = finalPrice` (kept in **naira** to match webhook's `expectedAmount = price * 100` calculation, since `payments.amount` is also stored in naira here),
- `currency: 'NGN'`, `payment_method: 'paystack'`, `status: 'pending'`,
- `expires_at` = computed rental expiry (so webhook uses the right value),
- `metadata` carrying content_id/type, referral info, original price.

Use the new intent's `id` as the Paystack `reference` and store it in both `provider_reference` and `paystack_reference`. Keep the `payments` insert too, but link it to the intent via `metadata.rental_intent_id` so `verify-payment.loadRentalIntent` resolves it.

Return `{ success, paymentMethod: 'paystack', rentalId: intent.id, paymentId, authorizationUrl, paystackReference }`.

Update `hasExistingRentalAccess` to call the `has_active_rental_access` RPC (single source of truth) and only fall back to the legacy `rentals` query if the RPC errors.

### 2. `supabase/functions/paystack-webhook/index.ts`

- Change every `.eq("revoked_at", null)` to `.is("revoked_at", null)` in `loadActiveRentalAccess`.
- Refactor `loadActiveRentalAccess` to build a fresh query for the by-content lookup instead of reusing the by-intent builder (avoids stacked filters).
- After the existing intent update, also insert a row into the legacy `rentals` table (status `completed`, expires_at, content_id/type) so legacy code paths and admin views keep working. Make it idempotent (check first or swallow unique violations).

### 3. `supabase/functions/verify-payment/index.ts`

- Same `.eq("revoked_at", null)` → `.is("revoked_at", null)` fix in `loadActiveRentalAccess`.
- In `loadRentalIntent`, also try resolving by `payment.intent_id` (currently only checks `metadata.rental_intent_id`, but `process-rental` historically wrote the reference there).

### 4. Backfill the stuck Paystack `payments` rows (one-off migration)

Add a SQL migration that, for each `payments` row with `purpose='rental'`, `provider='paystack'`, `enhanced_status` in (`pending`,`initiated`):

- create a matching `rental_intents` row (status `pending`, content fields from `metadata`, `provider_reference = intent_id`),
- store the new intent id back into `payments.metadata.rental_intent_id`.

This lets `verify-payment` resolve historical orders so users who already paid (or who retry) recover access. Skip rows older than 7 days to limit blast radius.

No frontend changes required — `useOptimizedRentals.processRental`, `OptimizedRentalCheckout`, and `usePaystackRentalVerification` already speak the right shape. `Watch.tsx`'s call to `rental-access` will start succeeding once `rental_access` rows are populated.

## Technical notes

- All amounts in `process-rental`, `payments`, `rental_intents.price`, and `wallets.balance` are currently stored in **naira** (not kobo) per the existing data; webhook multiplies by 100 only to compare against Paystack's kobo amount. Don't change units — just stay consistent.
- `process_wallet_rental_payment` exists as a SECURITY DEFINER RPC and already enforces single-active-rental and atomic balance deduction. Reuse it instead of re-implementing in the function.
- `has_active_rental_access` RPC handles episode→season delegation, so `hasExistingRentalAccess` collapses to a single RPC call.
- Paystack webhook URL must be configured in the Paystack dashboard to point at `…/functions/v1/paystack-webhook` (already present in `supabase/config.toml` with `verify_jwt = false`). No change needed if it's already set; mention to user to confirm.
