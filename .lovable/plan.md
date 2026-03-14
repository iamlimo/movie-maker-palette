

# Wallet Payment Optimization Plan

## Issues Found

After thorough code review, here are the bugs and optimizations needed:

### Critical Bugs

1. **`enhanced-webhook` fulfillRental uses wrong column names**: Inserts `price_paid` and `expiration_date` but the `rentals` table has `amount` and `expires_at`. This means Paystack card rental payments silently fail.

2. **`enhanced-webhook` fulfillWalletTopup credits wrong amount**: Calls `fulfillWalletTopup(supabase, payment, amount / 100)` converting kobo to naira, but the wallet system stores everything in kobo. Users get 100x less credit than they paid for.

3. **`verify-payment` reads from URL params but clients send body**: Both `RentalButton` and `FundWalletModal` call `verify-payment` with `body: { payment_id }`, but the function reads from `url.searchParams`. Payment polling never finds the payment.

4. **`wallet-payment` callback_url uses edge function origin**: `new URL(req.url).origin` resolves to the Supabase functions domain, not the app domain. After Paystack card payment, users are redirected to a broken URL.

5. **`paystack-webhook` uses wrong payment lookup**: Queries `eq('id', paymentId)` where `paymentId = data.reference` which is the `intent_id` string, not the UUID `id`. Payment records are never found/updated. Also stores `amount / 100` but the table expects kobo.

### Data Reset
- Reset all wallet balances to zero.

---

## Changes (No new components or edge functions)

### 1. Database: Reset wallet balances (data operation via insert tool)
```sql
UPDATE wallets SET balance = 0, updated_at = now();
UPDATE wallet_transactions SET balance_after = 0 WHERE id IN (
  SELECT id FROM wallet_transactions ORDER BY created_at DESC
);
```

### 2. Fix `enhanced-webhook/index.ts`
- `fulfillWalletTopup`: Remove the `/ 100` — pass raw kobo amount from `payment.amount`
- `fulfillRental`: Fix column names `price_paid` → `amount`, `expiration_date` → `expires_at`. Also fetch content-specific rental duration like `wallet-payment` does.

### 3. Fix `verify-payment/index.ts`
- Add body parsing fallback: read `payment_id` from request body if not in URL params, so both polling patterns work.

### 4. Fix `wallet-payment/index.ts`
- Replace `new URL(req.url).origin` callback URL with the actual app domain (`https://movie-maker-palette.lovable.app`) using an `Origin` or `Referer` header fallback.

### 5. Fix `paystack-webhook/index.ts`
- Fix payment lookup to use `intent_id` column instead of `id`
- Store `amount` in kobo (remove `/ 100` conversion) to match the `rentals` table schema
- Fetch content-specific rental duration

### 6. Fix `RentalButton.tsx`
- Change verify-payment polling to pass `payment_id` as a query param instead of body

### 7. Fix `FundWalletModal.tsx`
- Change verify-payment polling to pass `payment_id` as a query param instead of body

### 8. Fix `TransactionHistory.tsx`
- Display amounts converted from kobo to naira (currently displays raw kobo values as if they're naira)

