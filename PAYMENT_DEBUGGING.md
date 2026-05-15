# Payment Issue Investigation

## Critical Findings

### 1. Payment System Components Verified ✅
- **process-rental edge function**: DEPLOYED and ACTIVE (version 74, updated 2026-05-15 22:30:13)
- **Payment hooks**: useOptimizedRentals, usePaystackRentalVerification, useWallet all present
- **Database tables**: rental_intents, rental_access created and indexed
- **RPC function**: process_wallet_rental_payment exists and is defined
- **View**: v_user_entitlements exists for access checking

### 2. Potential Issues to Investigate

#### A. Edge Function Response Handling
- **Current behavior**: `supabase.functions.invoke()` might be returning error responses that aren't being properly parsed
- **Risk**: If edge function returns `{ error: "..." }` with status 500, the hook might not handle it correctly
- **Location**: useOptimizedRentals.tsx, line ~140

#### B. Authentication/Authorization
- **Risk**: Edge function call might be missing authentication token or using wrong auth scope
- **Check needed**: Verify that Supabase client session is properly authenticated before payment attempt
- **Impact**: Would cause "Unauthorized" or "403 Forbidden" errors

#### C. Content Price Mismatch
- **Current**: Prices passed from frontend (in kobo) should match edge function expectations
- **Risk**: If prices are passed in wrong unit (naira vs kobo), calculations could fail
- **Locations to verify**:
  - MoviePreview.tsx:320 - passes `movie.price` (kobo)
  - TVShowPreview.tsx:567, 615 - pass `currentSeason.price`, `episode.price` (kobo)
  - OptimizedRentalCheckout calculates VAT on these prices

#### D. RPC Function Parameter Type Mismatch
- **Issue**: Edge function invokes RPC with parameters, but types might not match
- **Locations**:
  - process-rental/index.ts:260-270 (RPC invocation)
  - migration 20260425000000 (RPC definition)
- **Check**: Verify all parameter types match (BIGINT vs INTEGER, TEXT vs VARCHAR, etc.)

#### E. Wallet/Balance Issues
- **Risk**: User might not have wallet created or sufficient balance
- **Check**: useWallet hook creates wallet if missing, but might be out of sync
- **Fallback**: Edge function should return clear error if wallet not found or insufficient balance

#### F. Content Doesn't Exist in Database
- **Risk**: getRentalExpiryHours() queries for content but might return NULL
- **Fallback**: Uses getDefaultRentalDurationHours() if not found
- **Check**: Verify movies, seasons, episodes actually exist in DB

### 3. Next Steps to Diagnose

1. **Check browser console for actual error message**
   - Look for red errors when attempting payment
   - Check Network tab for request/response details

2. **Enable verbose logging in edge function**
   - Add console.error() statements for each failure point
   - Check Supabase Function Logs

3. **Test edge function directly**
   - Use Supabase Dashboard → Functions → process-rental → Test Function
   - Try wallet payment with test values

4. **Verify RPC function parameters**
   - Check if RPC expects different parameter names
   - Verify BIGINT type for prices (kobo should be integers)

5. **Check authentication state**
   - Verify user is authenticated before payment
   - Check if session token is being passed to edge function

6. **Validate content in database**
   - Ensure test content (movies/seasons/episodes) exist
   - Verify price fields are populated (not NULL)
   - Check rental_expiry_duration fields are set

## Debug Test Cases

### Test 1: Wallet Payment with Debug Logging
```typescript
// In OptimizedRentalCheckout handlePayment()
console.log('=== PAYMENT DEBUG ===');
console.log('User:', user.id);
console.log('Content:', contentId, contentType);
console.log('Price (in kobo):', finalPrice);
console.log('Payment method:', paymentMethod);
console.log('Wallet balance:', balance);

const result = await processRental(
  contentId,
  contentType,
  finalPrice,
  paymentMethod,
  discount?.code,
);

console.log('Process rental result:', result);
```

### Test 2: Direct Edge Function Call
```typescript
// Test in browser console
const { data, error } = await supabase.functions.invoke('process-rental', {
  body: {
    userId: '<USER_ID>',
    contentId: '<CONTENT_ID>',
    contentType: 'movie',
    price: 500000, // 5000 naira in kobo
    paymentMethod: 'wallet'
  }
});

console.log('Response:', { data, error });
```

### Test 3: Check RPC Function
```typescript
// Test in browser console
const { data, error } = await supabase.rpc('process_wallet_rental_payment', {
  p_user_id: '<USER_ID>',
  p_content_id: '<CONTENT_ID>',
  p_content_type: 'movie',
  p_final_price: 500000,
  p_expires_at: new Date(Date.now() + 48*60*60*1000).toISOString(),
  p_metadata: {},
  p_referral_code: null,
  p_discount_amount: 0,
  p_provider_reference: null
});

console.log('RPC Response:', { data, error });
```

## Summary

The payment system appears to be fully configured, but there's a gap in error reporting. The most likely issues are:
1. Edge function returns errors that aren't properly propagated to UI
2. Authentication is missing or incorrect
3. Content prices or IDs don't exist in database
4. RPC function parameters don't match expected types

Recommend: Enable detailed console logging and test edge function directly to identify the exact failure point.
