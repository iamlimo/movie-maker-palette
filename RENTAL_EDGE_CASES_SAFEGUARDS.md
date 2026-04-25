# Rental System - Edge Case Handling & Safeguards

**Document Version**: 1.0  
**Date**: April 25, 2026  
**Status**: Production-Ready

This document outlines all critical edge cases in the rental system and how they are handled to ensure data integrity and user experience.

---

## 1. Duplicate Payment Prevention

### Problem
User clicks "Pay Now" twice or payment webhook fires multiple times, resulting in duplicate charges and rental access.

### Solution

#### Database Level
- **Unique Constraints**: Partial unique indexes prevent duplicate active rentals:
  ```sql
  CREATE UNIQUE INDEX uq_rental_intents_active_movie
    ON rental_intents(user_id, movie_id)
    WHERE status IN ('pending', 'paid');
  ```
- **Idempotent RPC Functions**: `grant_rental_access()` uses `ON CONFLICT DO NOTHING` to skip duplicate inserts
- **Status Transitions**: Only `pending` → `paid` transitions are allowed, preventing re-processing

#### Application Level
- **Idempotency Keys**: Frontend sends `idempotency-key` header (from process-rental function)
- **Payment Reference Deduplication**: Check if `paystack_reference` already exists before processing
- **Webhook Deduplication**: Check if `rental_intent.status` is already `paid` before granting access

#### Implementation
```typescript
// In paystack-webhook
if (rentalIntent.status === 'paid') {
  console.log('Payment already processed, skipping');
  return { received: true, message: 'Already processed' };
}

// Update intent and grant access atomically
await supabase.rpc('grant_rental_access', {
  p_user_id: rentalIntent.user_id,
  // ... other params
});
```

---

## 2. Race Condition: Payment Success + DB Failure

### Problem
Payment succeeds at Paystack, but database update fails (network timeout, DB connection lost). User doesn't see access, but payment was charged.

### Solution

#### Idempotent Design
- All updates use `ON CONFLICT DO NOTHING` (idempotent)
- Webhook can be safely replayed multiple times without side effects
- Access grant is the source of truth (not payment status)

#### Retry Logic
- **Webhook Retries**: Paystack retries webhook for 3 days if HTTP status != 200
- **Sync Function**: `sync-paystack-payments/` periodically reconciles missed payments
  - Queries Paystack API for transactions not yet confirmed in database
  - Marks transactions as `paid` and grants access

#### Example Sync Logic
```typescript
// Query Paystack for recent transactions
const paystackTxns = await fetch('paystack.co/transaction/search', {
  filters: { from: 24_hours_ago }
});

// For each transaction
for (const txn of paystackTxns) {
  const localTxn = await db.from('rental_intents')
    .eq('paystack_reference', txn.reference)
    .single();

  if (!localTxn) {
    // Create missing intent and grant access
    await db.rpc('grant_rental_access', { ... });
  }
}
```

---

## 3. Insufficient Wallet Balance Race Condition

### Problem
User has ₦500, two instances of the app both check balance, both pass validation, both attempt debit. Second one fails after first succeeds.

### Solution

#### Database Level
- **Row-Level Locking**: `process_wallet_rental_payment()` RPC uses `FOR UPDATE` lock:
  ```sql
  SELECT balance
    INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Locks row, prevents concurrent updates
  ```
- **Atomic Operation**: Balance check and debit happen in single transaction
- **SERIALIZABLE Isolation**: Payment function runs at SERIALIZABLE level

#### Application Level
- **Optimistic Locking**: Frontend caches balance and checks locally
- **Error Handling**: If insufficient balance error, show friendly message and allow retry
- **Refresh Before Debit**: Always fetch latest balance right before payment

---

## 4. Expired Rental Still Granting Access

### Problem
Rental access `expires_at` passes, but user still sees "Watch Now" button and can play video.

### Solution

#### Query-Level Checks
- All access checks include `WHERE expires_at > NOW()` and `revoked_at IS NULL`
- RPC function `has_active_rental_access()` enforces this in database
- Video URL signing function checks expiry before issuing presigned URL

#### Frontend Level
- `useOptimizedRentals()` hook filters expired rentals
- Subscription updates trigger re-render when rental expires
- Countdown timer shows user remaining time, triggers refresh at 0

#### Cleanup Jobs
- Scheduled task (via Supabase Edge Functions) marks expired rentals
- Not deleted (preserves audit trail), but marked with flag
- Admin dashboard shows warning for expiring rentals

---

## 5. Paystack Webhook Arrives Before Payment API Response

### Problem
User clicks "Pay" → Paystack processes payment instantly → Webhook arrives before Paystack API returns authorization URL to frontend. Frontend doesn't know payment started.

### Solution

#### Async-First Design
- Frontend doesn't wait for webhook to grant access
- `process-rental` function creates `rental_intent` with `status: 'pending'`
- Frontend polls `verify-payment` endpoint for confirmation (up to 5 minutes)
- Webhook independently grants access when it arrives

#### Implementation
```typescript
// Frontend flow
const response = await initializePayment();
const intentId = response.rentalIntentId;

// Start polling immediately (doesn't wait for webhook)
await pollPaymentStatus(intentId, {
  maxAttempts: 150,  // 5 minutes with 2-second intervals
  interval: 2000
});

// Webhook grants access independently
// Both polling and webhook converge on same result
```

---

## 6. Referral Code Applied Twice

### Problem
User applies referral code, gets discount. Later, admin accidentally applies same code to payment. User gets double discount.

### Solution

#### Database Constraints
- `referral_code_uses` table tracks which users used which codes
- Per-user limit enforced: `max_uses_per_user` constraint
- Check during code validation:
  ```sql
  SELECT COUNT(*) FROM referral_code_uses
  WHERE code_id = ? AND user_id = ?;
  
  IF count >= max_uses_per_user THEN
    RAISE EXCEPTION 'You have already used this code';
  END IF;
  ```

#### Immutable Records
- Once `referral_code_uses` is created, it's never deleted
- Code usage is recorded atomically with payment
- Admin cannot modify discount after payment

---

## 7. Episode Access via Season Rental Expiration

### Problem
User rents season (14 days), which grants access to all episodes. After 7 days, user still has access to episodes even though season rental hasn't expired. But what if user only rents an episode and season expires mid-watch?

### Solution

#### Expiry Hierarchy
1. **Episode Rental**: Expires after 7 days
2. **Season Rental**: Expires after 14 days (grants episode access)
3. **Show Purchase**: Never expires

#### Episode Access Check (in RPC)
```sql
-- Check direct episode rental
SELECT * FROM rental_access
WHERE episode_id = ? AND expires_at > NOW();

-- Check season rental (via episode.season_id)
SELECT * FROM rental_access
WHERE season_id = (SELECT season_id FROM episodes WHERE id = ?)
  AND expires_at > NOW();
```

#### User Experience
- Show countdown for both episode and season rentals
- Warn user if season expires before episode access used
- Allow renewing season access before it expires

---

## 8. Concurrent Admin Access Revocation

### Problem
Admin revokes rental access while user is watching. Video stops mid-stream. Confusing for user.

### Solution

#### Graceful Handling
- Video player checks access status every 30 seconds (lightweight check)
- If access revoked, show overlay: "Your rental has been revoked"
- Preserve playback state (user can re-rent to resume)
- Log revocation event for audit trail

#### Implementation
```typescript
// Video player hook
useEffect(() => {
  const interval = setInterval(async () => {
    const { has_access } = await checkRentalAccess(contentId);
    if (!has_access) {
      onAccessRevoked();  // Show overlay, pause video
    }
  }, 30000);  // Every 30 seconds
  
  return () => clearInterval(interval);
}, [contentId]);
```

---

## 9. Discount Code Expiration Mid-Transaction

### Problem
User starts checkout, validation passes (code is valid). By the time payment processes (2 seconds), code expires. Discount should not apply.

### Solution

#### Re-Validation
- Discount codes are validated **twice**:
  1. Initial validation (frontend button click)
  2. Server-side validation in `process-rental` function

#### Server-Side Check
```typescript
// In process-rental
const { data: codeData } = await supabase
  .from('referral_codes')
  .select('*')
  .eq('code', referralCode.toUpperCase())
  .eq('is_active', true)
  .gt('valid_until', 'now()')  // Ensure not expired
  .maybeSingle();

if (!codeData) {
  return { error: 'Referral code expired or invalid' };
}
```

#### User Experience
- If code expires during checkout, show error: "Code has expired"
- Don't deduct discount
- Suggest alternative codes if available

---

## 10. Paystack Amount Mismatch

### Problem
Paystack receives payment for ₦1000, but database expects ₦900 (after discount was applied). Payment is verified as successful, but amount doesn't match.

### Solution

#### Amount Validation
- Store `original_price`, `discount_amount`, `final_price` separately
- Webhook checks:
  ```typescript
  const expectedAmount = rentalIntent.price;  // This is final_price
  if (paidAmount < expectedAmount) {
    // Mark as amount_mismatch, don't grant access
    await updateIntent({ status: 'failed', reason: 'amount_mismatch' });
  }
  ```

#### Tolerance Range
- Allow small variance for currency conversion (e.g., ±50 kobo)
- Log warnings for investigation
- Admin dashboard alerts on mismatches

---

## 11. Network Timeout During Video URL Generation

### Problem
User clicks "Watch", rental access exists, but video URL generation times out (Backblaze B2 API down). User sees error.

### Solution

#### Fallback URLs
- Primary: Backblaze B2 signed URL
- Fallback: Supabase Storage presigned URL (already in system)
- Both validated for rental access before issuing

#### Retry Logic
```typescript
try {
  const url = await getVideoUrlFromB2(videoId);
  return url;
} catch (error) {
  console.warn('B2 timeout, using Supabase fallback:', error);
  const url = await getVideoUrlFromSupabase(videoId);
  return url;
}
```

#### User Messaging
- "Video loading..." (transparent loading)
- If both fail: "Unable to load video. Please try again."
- Auto-retry with exponential backoff

---

## 12. Webhook Signature Verification Failure

### Problem
Attacker forges Paystack webhook with fake payment confirmation. Access granted incorrectly.

### Solution

#### HMAC Signature Verification (CRITICAL)
```typescript
// In paystack-webhook
const signature = req.headers.get('x-paystack-signature');
const bodyText = await req.text();
const secret = Deno.env.get('PAYSTACK_SECRET_KEY');

// Verify HMAC-SHA512
const computedSignature = HMAC_SHA512(bodyText, secret);
if (computedSignature !== signature) {
  return { status: 400, error: 'Invalid signature' };
}
```

#### Additional Checks
- Verify webhook sender IP is from Paystack
- Log all invalid signature attempts (security alert)
- Never grant access without valid signature
- Test signature verification in CI/CD

---

## 13. Frontend Token Expiration During Payment

### Problem
Payment takes 2 minutes, user's JWT token expires after 1 hour of inactivity. Request fails with 401.

### Solution

#### Token Refresh
- All functions automatically refresh JWT if expired
- `authenticateUser()` helper handles refresh

#### User Session Persistence
- Mark payment as `in_progress` in local storage
- If refresh needed, complete payment verification after login
- Show "Session expired, please sign in again"

---

## 14. Rental Intent Created but Wallet Debit Fails

### Problem
`rental_intent` is created and marked `paid`, but wallet debit RPC fails. Rental granted but balance not deducted.

### Solution

#### Atomic Transactions
- All operations happen in single database transaction
- If any step fails, entire transaction rolls back
- `process_wallet_rental_payment()` RPC is single atomic operation

#### Example
```sql
BEGIN;
  -- 1. Check wallet balance
  -- 2. Debit wallet
  -- 3. Create rental_intent
  -- 4. Create rental_access
COMMIT;  -- All or nothing
```

---

## 15. Subscription/Real-Time Update Race Condition

### Problem
User clicks "Rent", gets confirmation, but subscription listener hasn't updated yet. User still sees "Rent" button instead of "Watch Now".

### Solution

#### Optimistic Updates
- Frontend assumes success immediately (before webhook)
- Update UI optimistically: `checkAccess = true`
- If webhook fails, rollback UI state

#### Implementation
```typescript
// Frontend
const onRentSuccess = () => {
  // Optimistic update
  setHasAccess(true);
  
  // Listen for confirmation
  subscribe(channel).on('rental_access', (payload) => {
    if (payload.user_id === userId) {
      // Confirms, no need to change (already updated)
      console.log('Rental confirmed');
    }
  });
};
```

---

## 16. High Concurrency: 1000+ Users Renting Same Movie

### Problem
Flash sale, 1000 users try to rent same movie simultaneously. Database connection pool exhausted, some requests fail.

### Solution

#### Rate Limiting
- Per-user: Max 5 payment requests per 60 seconds
- Per-endpoint: Max 1000 requests per 60 seconds (shared)
- Queue requests if limit exceeded

#### Connection Pooling
- Supabase auto-scales connection pool (up to 100 connections)
- Deno functions run independently (no shared connection pool)
- Graceful degradation: Return 429 (Too Many Requests) if pool exhausted

#### Caching
- Cache content prices and rental durations in memory
- Reduces database queries significantly

---

## 17. Admin Forcefully Grants Access

### Problem
Admin manually creates `rental_access` record without corresponding `rental_intent`. User sees access but system is confused.

### Solution

#### Constraints & Validation
- `rental_access` has optional `rental_intent_id` (allows admin grants)
- `source` field distinguishes: `'rental'` | `'purchase'` | `'admin_grant'`
- Admin actions are logged with admin user ID

#### Audit Trail
```sql
INSERT INTO rental_access (..., source, metadata)
VALUES (..., 'admin_grant', {
  'granted_by': 'admin_user_id',
  'reason': 'customer support',
  'timestamp': now()
});
```

---

## Testing Edge Cases

### Pre-Deployment Checklist

- [ ] Duplicate payment: Pay twice in rapid succession → Only one rental created
- [ ] Wallet race condition: Two concurrent wallet payments → Second fails gracefully
- [ ] Expired rental: Rent movie, wait for expiry, try to watch → Access denied
- [ ] Paystack webhook retry: Process webhook twice → Idempotent, no duplicate access
- [ ] Amount mismatch: Pay ₦900, expect ₦1000 → Transaction marked failed
- [ ] Concurrent admin revoke: User watching, admin revokes access → Video stops gracefully
- [ ] Network timeout: Video URL service down → Fallback URL works
- [ ] Signature verification: Fake webhook → Rejected with 400
- [ ] Token expiration: 90-min idle, then pay → Refresh token works
- [ ] 1000 concurrent rents: Stress test → No crashes, proper rate limiting

---

## Monitoring & Alerts

### Key Metrics
- Payment success rate (target: 99.9%)
- Webhook processing latency (target: < 5 seconds)
- Access grant latency (target: < 500ms)
- Database transaction rollback rate (target: < 0.1%)

### Alerts
- Payment failure spike (> 5% in 1 hour)
- Webhook signature failures (> 1 in 1 hour)
- Database connection pool exhaustion
- Paystack API errors (> 10 in 1 hour)
- Rental/access count discrepancy (audit)

---

## Conclusion

The rental system is designed with **idempotency**, **atomicity**, and **fallback mechanisms** to handle all common edge cases. Regular testing and monitoring ensure production stability.

---

**Last Updated**: April 25, 2026
