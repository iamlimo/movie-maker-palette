# TV Rental System - Debugging & Fixes

## Issues Identified & Fixed

### Critical Issue #1: Payment Method Tab Not Initialized
**Problem:** Users couldn't rent TV shows or episodes because the payment method wasn't automatically selected when the rental checkout dialog opened.

**Root Cause:**
- `OptimizedRentalCheckout.tsx` initialized `paymentMethod` state as `null`
- The Tabs component value was `paymentMethod || ''` (empty string when null)
- TabsContent components required exact value match (`"wallet"` or `"paystack"`)
- Result: No tab content rendered, users couldn't proceed

**Fix Applied:**
```typescript
// In OptimizedRentalCheckout.tsx - Added useEffect after line 80
useEffect(() => {
  if (open) {
    // Auto-select first available payment method
    if (canPayWithWallet) {
      setPaymentMethod('wallet');
    } else {
      setPaymentMethod('paystack');
    }
  } else {
    // Reset when dialog closes
    setPaymentMethod(null);
    setPaymentStatus({ show: false, status: 'processing', message: '' });
  }
}, [open, canPayWithWallet]);
```

**Impact:** Users now see the payment method tabs with content pre-selected, allowing them to proceed with payment immediately.

---

### Critical Issue #2: Rental Access Not Updated After Purchase
**Problem:** When a user successfully rented a season or episode, their access wasn't immediately reflected in the UI.

**Root Cause:**
- When rental completed, the real-time subscription updated `rentals` array in `useOptimizedRentals`
- However, `TVShowPreview.tsx` only checked access during initial load
- No mechanism to re-check access when rentals array changed
- Result: Rental was created in database, but UI still showed "Rent" button instead of "Watch"

**Fix Applied:**
```typescript
// In TVShowPreview.tsx - Line 99
// Changed from:
const { checkAccess: checkAccessOptimized, checkSeasonAccess } = useOptimizedRentals();

// To:
const { checkAccess: checkAccessOptimized, checkSeasonAccess, rentals } = useOptimizedRentals();

// Then added after line 137:
// Re-check access whenever rentals change (when user completes a rental)
useEffect(() => {
  if (user && Object.keys(episodes).length > 0 && seasons.length > 0) {
    checkSeasonAndEpisodeAccess(seasons, episodes);
  }
}, [rentals, user]);
```

**Impact:** Access state now automatically updates when a rental completes, reflecting the user's rental status in real-time.

---

## How the Rental Flow Now Works

### Complete Flow Diagram:
```
1. User clicks "Rent Season" or "Rent Episode" button
   ↓
2. OptimizedRentalButton component shows rental price
   ↓
3. User clicks button → OptimizedRentalCheckout dialog opens
   ↓
4. ✅ FIXED: Payment method auto-selected (Wallet or Card)
   ↓
5. User clicks "Pay ₦XXX"
   ↓
6. handlePayment() called → processRental() invoked
   ↓
7. Cloud function process-rental creates rental record
   ↓
8. Real-time subscription fires (postgres_changes event)
   ↓
9. fetchRentals() called in useOptimizedRentals hook
   ↓
10. rentals state updated
    ↓
11. ✅ FIXED: useEffect in TVShowPreview detects rentals change
    ↓
12. checkSeasonAndEpisodeAccess() re-runs
    ↓
13. seasonAccess & episodeAccess state updated
    ↓
14. Component re-renders with updated access status
    ↓
15. User sees "Watch Now" button (or included in season rental)
```

---

## Testing Procedure

### Test 1: Payment Method Selection
1. Navigate to a TV show page with available seasons/episodes
2. Click "Rent Season" or "Rent Episode" button
3. **Expected:** Checkout dialog opens with payment method pre-selected
4. **Verify:** Either "Wallet" or "Card" tab is highlighted (not empty)
5. **Expected:** Content shows under selected tab (balance info or payment options)

### Test 2: Wallet Payment
1. Ensure user has sufficient wallet balance
2. Open rental checkout (payment method should be "Wallet")
3. Click "Pay ₦XXX"
4. **Expected:** Success toast appears
5. **Expected:** Dialog closes within 2 seconds
6. **Expected:** Access status updates to show "Watch Now" button
7. **Verify:** Season rental shows all episodes as "Included in season rental"

### Test 3: Paystack Payment
1. Ensure user has low or no wallet balance
2. Open rental checkout → payment method should default to "Card"
3. Click "Pay ₦XXX"
4. **Expected:** Paystack checkout page opens
5. **Expected:** Payment status shows "Processing..."
6. Complete Paystack payment
7. **Expected:** System verifies payment and updates rental status
8. **Expected:** Access updates automatically

### Test 4: Season vs Episode Access
1. Rent a full season
2. **Expected:** All episodes show "Included in season rental"
3. **Expected:** All episodes are playable
4. In another session, rent just one episode
5. **Expected:** Only that episode shows as playable
6. **Expected:** Other episodes still show "Rent Episode" button

### Test 5: Multiple TV Shows
1. Rent content from one TV show
2. Navigate to another TV show
3. **Expected:** Access checking doesn't mix between shows
4. **Expected:** Rental history is per-show

---

## Debugging Checklist

### If Rental Payment Fails:
- [ ] Check browser console for error messages
- [ ] Verify cloud function `process-rental` is deployed
- [ ] Check Supabase logs for function errors
- [ ] Verify user has sufficient wallet balance (if using wallet)
- [ ] Verify Paystack API keys are configured correctly

### If Access Doesn't Update:
- [ ] Check Supabase real-time subscriptions are enabled
- [ ] Verify RLS policies allow user to read their own rentals
- [ ] Check if rentals table actually contains the new record
- [ ] Verify `checkSeasonAndEpisodeAccess()` is being called

### If Payment Method Doesn't Auto-Select:
- [ ] Check browser DevTools → Elements → OptimizedRentalCheckout component
- [ ] Verify useEffect with `[open, canPayWithWallet]` dependencies
- [ ] Check if Dialog `open` prop is true
- [ ] Verify canPayWithWallet calculation in useWallet hook

---

## Key Files Modified

1. **src/components/OptimizedRentalCheckout.tsx**
   - Added useEffect to auto-select payment method
   - Lines: ~80-100 (after triggerHaptic function)

2. **src/pages/TVShowPreview.tsx**
   - Imported `rentals` from useOptimizedRentals
   - Added useEffect to re-check access when rentals change
   - Lines: ~99 (import), ~137-144 (new useEffect)

---

## Configuration Requirements

### Environment Variables:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
PAYSTACK_SECRET_KEY=your_paystack_secret
```

### Database Schema:
- `rentals` table must have:
  - `id` (UUID)
  - `user_id` (UUID, FK to auth.users)
  - `content_id` (UUID)
  - `content_type` (VARCHAR: 'episode', 'season', 'movie', 'tv')
  - `price` (BIGINT, in kobo)
  - `status` (VARCHAR: 'pending', 'completed', 'cancelled', 'expired')
  - `expires_at` (TIMESTAMP)
  - `payment_method` (VARCHAR: 'wallet', 'paystack')

### Cloud Functions Required:
- `process-rental` - Creates rental and handles payment
- `verify-rental-payment` - Verifies Paystack payment
- `rental-access` - Checks user access to content

### RLS Policies:
```sql
-- Users can view their own rentals
CREATE POLICY "Users can view their own rentals"
  ON rentals FOR SELECT
  USING (auth.uid() = user_id);

-- System can create/update rentals
CREATE POLICY "System can insert rentals"
  ON rentals FOR INSERT
  WITH CHECK (true);
```

---

## Performance Considerations

### Real-Time Updates:
- Real-time subscription handles automatic updates
- No polling required
- Access check runs only when rentals change

### Price Conversions:
- All prices stored in kobo (100 kobo = ₦1)
- `formatNaira()` utility handles display conversion
- No conversion needed in rental components

---

## Future Improvements

1. **Add rental history page**
   - Show user's active and expired rentals
   - Option to extend rental

2. **Improve payment method selection UX**
   - Show warning if wallet has insufficient balance
   - Suggest card payment as fallback

3. **Add loading state for real-time updates**
   - Skeleton loading while access updates
   - Smooth transition from "Rent" to "Watch" state

4. **Add analytics**
   - Track rental completion rates
   - Monitor payment failures
   - Identify drop-off points in rental flow

---

## Related Documentation

- See `RENTAL_IMPLEMENTATION_GUIDE.md` for complete rental system architecture
- See `RENTAL_QUICK_REFERENCE.md` for quick integration examples
- See `README_TV_RENTAL_SYSTEM.md` for system overview

---

**Last Updated:** April 18, 2026
**Status:** Fixes Applied and Ready for Testing
