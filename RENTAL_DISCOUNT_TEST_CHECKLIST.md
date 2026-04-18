# TV Show Rental Optimization - Testing Checklist

## Pre-Testing Setup

### Database Setup
- [ ] Verify `referral_codes` table exists
- [ ] Verify `rentals` table has: `price`, `discount_applied`, `final_price` columns
- [ ] Verify `referral_code_uses` table exists
- [ ] Create test referral codes:
  ```sql
  INSERT INTO referral_codes (code, discount_type, discount_value, is_active)
  VALUES 
    ('TEST20', 'percentage', 20, true),
    ('TEST500', 'fixed', 50000, true);
  ```

### User Setup
- [ ] Create test user with ₦5,000 wallet balance
- [ ] Create second test user with ₦500 wallet balance

### TV Show Setup
- [ ] Verify TV shows with seasons exist
- [ ] Verify episodes are created for seasons
- [ ] Set season prices: ₦3,000 (300000 kobo)
- [ ] Set episode prices: ₦350 (35000 kobo)

---

## Test Suite 1: Discount Code Validation

### Test 1.1: Valid Percentage Discount
- [ ] Navigate to TV show rental page
- [ ] Click "Rent Season"
- [ ] **Enter code**: TEST20
- [ ] **Expected**: "✓ Discount Applied!"
- [ ] **Verify**:
  - Discount shows: "Save 20% (₦600)"
  - Total changes from ₦3,000 to ₦2,400
  - Code appears as: "TEST20 | Applies to wallet & card payments"

### Test 1.2: Valid Fixed Discount
- [ ] Clear current discount
- [ ] **Enter code**: TEST500
- [ ] **Expected**: "✓ Discount Applied!"
- [ ] **Verify**:
  - Discount shows: "Save ₦500"
  - Total changes from ₦3,000 to ₦2,500

### Test 1.3: Invalid Code
- [ ] Clear current discount
- [ ] **Enter code**: INVALID123
- [ ] Click Apply
- [ ] **Expected**: Error message "Invalid referral code"

### Test 1.4: Case Insensitivity
- [ ] Clear current discount
- [ ] **Enter code**: test20
- [ ] **Expected**: Code normalizes to TEST20, discount applies

### Test 1.5: Expired Code
- [ ] Create expired code in database
- [ ] **Enter expired code**
- [ ] Click Apply
- [ ] **Expected**: Error message "This code has expired"

---

## Test Suite 2: Wallet Payment with Discount

### Test 2.1: Sufficient Balance - Percentage Discount
- [ ] Login as user with ₦5,000 balance
- [ ] Open season rental (₦3,000)
- [ ] Apply TEST20 code (20% = ₦600 savings)
- [ ] **Final price**: ₦2,400
- [ ] Click "Rent Season"
- [ ] **Verify Wallet tab shows**:
  - Current balance: ₦5,000
  - Amount to pay: ₦2,400
  - Balance after payment: ₦2,600
  - Discount saving: ₦600 (green)
- [ ] Select Wallet payment
- [ ] Click "Pay ₦2,400"
- [ ] **Expected**: Success toast "🎉 Payment Successful!"
- [ ] **Verify in database**:
  - Rental created with `final_price: 240000`
  - `discount_applied: 60000`
  - User wallet balance: 260000

### Test 2.2: Sufficient Balance - Fixed Discount
- [ ] Apply TEST500 (₦500 fixed)
- [ ] **Final price**: ₦2,500
- [ ] Verify wallet shows balance after: ₦2,500
- [ ] Complete wallet payment
- [ ] **Verify**: Rental created with correct discount

### Test 2.3: Insufficient Balance After Discount
- [ ] Login as user with ₦500 balance
- [ ] Open episode rental (₦350)
- [ ] Apply TEST20 (20% = ₦70 savings)
- [ ] **Final price**: ₦280
- [ ] Wallet tab **should show**:
  - Warning: "You need ₦0 more" (actually sufficient)
- [ ] Complete payment ✓

### Test 2.4: Insufficient Balance Without Discount
- [ ] Same user ₦500 balance
- [ ] Open season (₦3,000)
- [ ] Apply discount (₦2,400 final)
- [ ] Wallet tab **should show warning**:
  - "You need ₦1,900 more to complete this payment"
- [ ] Wallet payment disabled (grayed out)
- [ ] Card payment tab available ✓

---

## Test Suite 3: Card/Paystack Payment with Discount

### Test 3.1: Card Payment with Percentage Discount
- [ ] Open season rental (₦3,000)
- [ ] Apply TEST20 (20% discount)
- [ ] **Final price**: ₦2,400
- [ ] **Verify Card tab shows**:
  - "Discount Applied to Card Payment" (green banner)
  - "Your discount is applied. Pay only ₦2,400"
- [ ] Click "Rent Season"
- [ ] Select Card payment
- [ ] Click "Pay ₦2,400"
- [ ] **Expected**: Paystack checkout opens
- [ ] **Verify Paystack shows**: ₦2,400 amount
- [ ] Complete test payment
- [ ] **Expected**: Success message
- [ ] **Verify in database**:
  - Rental created with `final_price: 240000`
  - `discount_applied: 60000`
  - `payment_method: paystack`

### Test 3.2: Card Payment with Fixed Discount
- [ ] Apply TEST500
- [ ] **Final price**: ₦2,500
- [ ] Complete card payment
- [ ] **Verify**: Rental shows correct discount

### Test 3.3: Card Payment on Episode with Discount
- [ ] Open episode rental (₦350)
- [ ] Apply TEST20 (20% = ₦70)
- [ ] **Final price**: ₦280
- [ ] Complete card payment
- [ ] **Verify**: Works for episodes too

---

## Test Suite 4: UI & UX

### Test 4.1: Discount Banner Display
- [ ] Apply discount
- [ ] **Verify banner shows**:
  - ✓ Icon
  - "Discount Applied!" heading
  - Savings percentage/amount
  - Green badge with saving value
- [ ] Clear discount
- [ ] **Verify**: Banner disappears

### Test 4.2: Pricing Summary
- [ ] Apply discount
- [ ] **Verify pricing summary shows**:
  - Price: ₦3,000
  - Discount: -₦600 (green)
  - Total (after discount): ₦2,400 (green text)
- [ ] Verify layout is clear and readable

### Test 4.3: Referral Code Input
- [ ] Active discount state:
  - Shows "✓ Discount Active" next to label
  - Code displayed in green box
  - Text: "Applies to wallet & card payments"
  - Remove (X) button visible
- [ ] Inactive state:
  - Input field ready for code
  - Apply button disabled until text entered
  - Helper text: "Have a discount code? Apply it..."

### Test 4.4: Payment Tab Visibility
- [ ] Wallet tab shows only when balance > 0
- [ ] Card tab always available
- [ ] Discount information shown in both tabs
- [ ] Payment method auto-selects correctly

### Test 4.5: Responsive Design
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] **Verify**:
  - All elements visible
  - Pricing summary readable
  - Buttons are clickable
  - Discount banner visible on all sizes

---

## Test Suite 5: Edge Cases

### Test 5.1: Zero Discount
- [ ] Create code with 0% discount
- [ ] Apply to rental
- [ ] **Expected**: Shows "Save 0%" or no discount
- [ ] Final price = original price

### Test 5.2: 100% Discount (Free Rental)
- [ ] Create code with 100% discount
- [ ] Apply to season (₦3,000)
- [ ] **Final price**: ₦0
- [ ] Proceed with wallet payment
- [ ] **Expected**: "Balance after payment" = current balance
- [ ] Rental created but no wallet deduction

### Test 5.3: Discount Larger Than Price
- [ ] Create fixed discount: ₦5,000
- [ ] Apply to episode (₦350)
- [ ] **Final price**: Should be max(0, 350-5000) = 0
- [ ] Works as 100% free rental

### Test 5.4: Decimal Discount Values
- [ ] Create 15.5% discount
- [ ] Apply and verify calculation
- [ ] **Expected**: Correctly rounded/floored to nearest kobo

### Test 5.5: Very Large Discount
- [ ] Create 9999% discount
- [ ] Apply to rental
- [ ] **Expected**: Capped at 100% or handled gracefully

---

## Test Suite 6: Real-Time Updates

### Test 6.1: Access Update After Wallet Payment
- [ ] Complete wallet payment with discount
- [ ] **Expected**: 
  - Success toast appears
  - Dialog closes in ~2 seconds
  - Page auto-updates to show access
  - "Watch Now" button visible instead of "Rent"
  - Episode shows "Included in season rental" badge (if season)

### Test 6.2: Access Update After Card Payment
- [ ] Complete card payment
- [ ] Return from Paystack
- [ ] **Expected**: Access updates automatically
- [ ] **Verify**: "Watch Now" button visible

### Test 6.3: Real-Time in Background
- [ ] Open two tabs with same TV show
- [ ] Complete rental in Tab 1
- [ ] **Check Tab 2**: Should auto-update within 5 seconds

---

## Test Suite 7: Data Integrity

### Test 7.1: Discount Applied Field
```sql
SELECT id, price, discount_applied, final_price 
FROM rentals 
WHERE discount_applied > 0 
LIMIT 5;
```
- [ ] **Verify**: 
  - `price` = original (not discount applied)
  - `discount_applied` > 0
  - `final_price` = price - discount_applied
  - All in kobo

### Test 7.2: Referral Code Uses Tracking
```sql
SELECT COUNT(*) 
FROM referral_code_uses 
WHERE rental_id IS NOT NULL;
```
- [ ] After N discounted rentals, count = N
- [ ] Each record links to specific rental

### Test 7.3: Wallet Deduction Accuracy
- [ ] Initial balance: B₁
- [ ] Rent with discount: D
- [ ] **Verify wallet**: B₂ = B₁ - D
- [ ] No floating-point errors

---

## Test Suite 8: Mobile/Native

### Test 8.1: Mobile Browser (iOS Safari)
- [ ] Access checkout on iPhone
- [ ] Apply discount code
- [ ] Select payment method
- [ ] Complete wallet payment (if enough balance)
- [ ] Complete card payment
- [ ] **Verify**: All UI readable, no layout breaks

### Test 8.2: Mobile Browser (Android Chrome)
- [ ] Repeat Test 8.1 on Android
- [ ] **Verify**: Responsive layout works

### Test 8.3: Native App (iOS)
- [ ] Complete rental with discount via native app
- [ ] **Verify**: All features work
- [ ] Check if prices hidden due to App Store policy

### Test 8.4: Native App (Android)
- [ ] Complete rental with discount
- [ ] **Verify**: All features work

---

## Post-Testing Verification

### Database Audit
```sql
-- Verify discount application
SELECT 
  COUNT(*) as total_rentals,
  COUNT(CASE WHEN discount_applied > 0 THEN 1 END) as discounted_rentals,
  SUM(discount_applied) as total_savings,
  SUM(final_price) as total_revenue
FROM rentals;

-- Verify referral code usage
SELECT code, COUNT(*) as usage_count
FROM referral_codes rc
JOIN referral_code_uses rcu ON rc.id = rcu.code_id
GROUP BY rc.code
ORDER BY usage_count DESC;
```

### Performance Check
- [ ] Discount code validation < 100ms
- [ ] Paystack initialization < 2s
- [ ] Access update < 5s after payment

### Security Check
- [ ] Cannot apply same code twice
- [ ] Cannot manipulate discount amount in frontend
- [ ] Cannot access other users' discount history
- [ ] Cloud function validates all inputs

---

## Sign-Off Checklist

- [ ] All test suites passed
- [ ] No console errors
- [ ] Responsive design verified
- [ ] Database integrity confirmed
- [ ] Mobile experience validated
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete

---

**Testing Date**: _______
**Tested By**: _______
**Status**: ✅ Ready / ⚠️ Issues Found

---

## Issues Found (if any)
- [ ] Issue 1: ...
- [ ] Issue 2: ...

**Notes**: ________________________________________________________________

---

**Last Updated**: April 18, 2026
