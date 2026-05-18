## RPC Contracts

### RPC: `process_wallet_rental_payment`

**Purpose**: Atomically process a wallet rental payment by deducting wallet balance and creating the canonical rental records (`rental_intents` + `rental_access`) for immediate entitlement.

#### Input Parameters
- `p_user_id` (uuid): User requesting rental
- `p_content_id` (uuid): Movie/season/episode ID
- `p_content_type` (text): `'movie' | 'season' | 'episode'`
- `p_final_price` (bigint): Amount in kobo (NGN)
- `p_expires_at` (timestamp): Expiry time for access
- `p_metadata` (jsonb): Additional metadata (caller may include payment origin, referral, etc.)
- `p_referral_code` (text, nullable): Discount/referral code (optional)
- `p_discount_amount` (bigint): Discount in kobo
- `p_provider_reference` (text, nullable): Optional provider reference for traceability

#### Return Type (as consumed by `supabase/functions/process-rental/index.ts`)
`RETURNS TABLE (...)` returning a row containing:
- `rental_intent_id` (uuid): ID of created `rental_intents` row
- `rental_access_id` (uuid | null): ID of created `rental_access` row (must exist for wallet success)
- `wallet_balance` (numeric): Updated wallet balance after deduction

> Note: In the edge function, the RPC result may arrive as an array or a single row; the caller normalizes it.

#### Guarantees (MUST)
1. **Atomicity**: wallet deduction + record creation happen in one transaction:
   - If any step fails, the entire transaction rolls back.
   - No wallet deduction should persist without successful intent/access creation.
2. **Wallet Deduction**:
   - Wallet balance is reduced by `p_final_price` for successful calls.
3. **Intent Status for wallet payments**:
   - `rental_intents.status` should be `'paid'` (immediate success).
   - `paid_at` should be set.
4. **Access Status for wallet payments**:
   - `rental_access.status` should be `'paid'`.
   - `revoked_at` should be `NULL`.
   - `expires_at` should be exactly `p_expires_at` (no rounding).
5. **Idempotency**:
   - The RPC can be safely called twice with the same logical inputs; it should not create duplicate paid access rows.
   - Enforced by the DB unique partial index on `rental_access` (paid & not revoked).

#### Failure Behavior
- On any error, RPC should throw and return no successful row.
- Caller should treat the payment as failed and show a clear error.
