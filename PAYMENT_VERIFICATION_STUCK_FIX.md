# Payment Verification Stuck - Debugging Guide

## Problem
Rental button shows "Verifying Payment..." and remains disabled indefinitely.

## Root Causes (Fixed)

### 1. ✅ Missing Dependency in useEffect (CRITICAL - FIXED)
**File**: `src/components/OptimizedRentalButton.tsx`
**Issue**: The `refresh` function wasn't in the useEffect dependency array, creating a stale closure.
**Fix**: Added `refresh` to dependency array and replaced continuous polling with a 30-second timeout.

### 2. ✅ Conflicting Polling Strategy (FIXED)
**Issue**: Component was polling every 5 seconds, but `useEntitlements` already has realtime subscriptions.
**Fix**: Removed aggressive polling, rely on:
  - Realtime subscriptions to `rental_intents` and `rental_access` tables
  - 30-second safety refresh for delayed webhooks
  - Manual "Refresh Status" button for user recovery

### 3. ✅ Missing v_user_entitlements View (FIXED)
**File**: `supabase/migrations/20260517_ensure_v_user_entitlements_view.sql`
**Issue**: View might not exist or doesn't properly map state transitions
**Fix**: Migration ensures view exists with correct state machine logic

## How State Transitions Work

```
NOT_RENTED
    ↓
    → wallet payment: PAYMENT_PENDING (instant) → ACTIVE
    → paystack payment: PAYMENT_VERIFICATION (waiting for webhook) → ACTIVE
    ↓
EXPIRED (rental expired)
    ↓
REVOKED (admin or system revocation)

FAILED: Payment failed or cancelled
REFUNDED: Payment refunded
```

## Debugging Steps

### Step 1: Check Browser Console
Look for debug logs:
```
[OptimizedRentalButton] Payment verification timeout - forcing refresh
[useEntitlements] ⏳ Payment verification states found: { count: 1, items: [...] }
```

### Step 2: Check Backend Payment Status
Run this in Supabase SQL editor:
```sql
-- Check rental intent status
SELECT 
  id, 
  user_id, 
  content_id, 
  content_type,
  status,
  payment_method,
  paystack_reference,
  created_at,
  updated_at
FROM public.rental_intents
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Check rental access
SELECT 
  id,
  user_id,
  content_id,
  content_type,
  status,
  expires_at,
  revoked_at,
  created_at
FROM public.rental_access
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Check view state (source of truth)
SELECT 
  content_id,
  content_type,
  state,
  expires_at,
  payment_method,
  intent_id,
  access_id
FROM public.v_user_entitlements
WHERE user_id = 'YOUR_USER_ID';
```

### Step 3: Check Paystack Webhook
For Paystack payments, verify webhook was received:
```sql
-- Check payments table
SELECT 
  id,
  user_id,
  provider,
  status,
  enhanced_status,
  provider_reference,
  created_at,
  updated_at
FROM public.payments
WHERE user_id = 'YOUR_USER_ID'
  AND provider = 'paystack'
ORDER BY created_at DESC
LIMIT 5;

-- Check audit logs
SELECT 
  step,
  status,
  message,
  metadata,
  created_at
FROM public.rental_audit_log
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

### Step 4: Manual Recovery
If stuck, user can:
1. Click "Refresh Status" button in the UI
2. Or refresh the page (realtime subscriptions will auto-update)
3. Or wait 30 seconds for automatic refresh

## Common Issues & Solutions

### Issue: "Verifying Payment" stays for >30 seconds

**Possible Causes:**
1. **Webhook not received** - Paystack webhook failed or was late
2. **View not querying properly** - Database view hasn't been deployed
3. **Realtime subscriptions broken** - Supabase realtime connection issue

**Solutions:**
- Check `rental_intents` table - is `status` = 'pending' still?
- Check `rental_access` table - does access record exist?
- Check Paystack dashboard - did webhook fire?
- Run migration: `supabase migration up`

### Issue: "Payment Failed" appears immediately

**Possible Causes:**
1. Insufficient wallet balance
2. Paystack API error
3. User already has active rental

**Solutions:**
- Check wallet balance
- Check Paystack API status
- Verify no duplicate active rentals exist

### Issue: After payment, still see "Verifying"

**Possible Causes:**
1. Database replication lag (<1 second, usually)
2. Browser cache not updated
3. Realtime subscription not working

**Solutions:**
- Wait a few seconds (replication lag)
- Click "Refresh Status"
- Hard refresh page (Ctrl+Shift+R)
- Check browser network tab for realtime connection

## Testing Payment Verification

### Test 1: Quick Wallet Payment
```
1. Open DevTools → Network tab
2. Click "Rent" → select Wallet
3. Confirm payment
4. Should see: PAYMENT_PENDING → ACTIVE (instant)
5. Watch for debug logs confirming state change
```

### Test 2: Paystack Payment (Sandbox)
```
1. Click "Rent" → select Card (Paystack)
2. Use test card: 4111111111111111 / 12/23 / 123
3. Complete payment on Paystack page
4. Return to app
5. Should see: PAYMENT_VERIFICATION → (waiting for webhook)
6. Webhook should fire within 5 seconds
7. Should auto-transition to ACTIVE
```

### Test 3: Manual Refresh
```
1. Intentionally leave "Verifying" state
2. Click "Refresh Status" button
3. Should transition to ACTIVE or show error
```

## Environment Checklist

- [ ] Migration deployed: `20260517_ensure_v_user_entitlements_view.sql`
- [ ] Edge function deployed: `process-rental`
- [ ] Edge function deployed: `verify-payment`
- [ ] Edge function deployed: `paystack-webhook`
- [ ] Supabase realtime enabled for `rental_intents` and `rental_access`
- [ ] Paystack webhook configured with correct URL
- [ ] Webhook HMAC signature verification working
- [ ] Database view `v_user_entitlements` exists

## Performance Notes

- **useEntitlements** debounces refetches to max 1 per 250ms
- **Realtime subscriptions** fire immediately on database changes
- **30-second timeout** is safety net, not primary update mechanism
- **Manual refresh button** available for user-initiated updates

## Key Files

- [src/components/OptimizedRentalButton.tsx](src/components/OptimizedRentalButton.tsx) - Fixed useEffect
- [src/hooks/useEntitlements.tsx](src/hooks/useEntitlements.tsx) - Enhanced logging
- [supabase/migrations/20260517_ensure_v_user_entitlements_view.sql](supabase/migrations/20260517_ensure_v_user_entitlements_view.sql) - View definition

## Questions?

1. Check browser console for debug logs
2. Check Supabase logs (Settings → Functions)
3. Check database audit logs (`rental_audit_log`)
4. Verify webhook in Paystack dashboard
