# TV Show Rental System - Discount Optimization Guide

## Overview
The TV show rental system now has optimized discount and payment features that work seamlessly for both wallet and card payments.

---

## Discount System Architecture

### How Discounts Work

#### Frontend (OptimizedRentalCheckout.tsx):
1. User enters referral code
2. Code is validated against `referral_codes` table
3. Discount is calculated:
   - **Percentage**: `discount_amount = price * (discount_value / 100)`
   - **Fixed**: `discount_amount = Math.min(discount_value, price)`
4. Final price calculated: `finalPrice = price - discount_amount`
5. Same `finalPrice` used for both wallet and card payments

#### Backend (process-rental cloud function):
1. Receives `userId`, `contentId`, `contentType`, `price`, `paymentMethod`, `referralCode`
2. Validates referral code if provided
3. Calculates discount (same logic as frontend)
4. Creates rental record with:
   - `price`: Original price (stored for reference)
   - `discount_applied`: Amount saved
   - `final_price`: Amount to be charged
5. Uses `final_price` for both payment methods
6. Tracks discount usage in `referral_code_uses` table

---

## Payment Method Integration

### Wallet Payment Flow with Discount
```
1. User has ₦1,000 wallet balance
2. Season rental price: ₦3,000
3. User applies discount code (20% off)
4. Discount amount: ₦600
5. Final price: ₦2,400
6. Process:
   - Check wallet balance ≥ ₦2,400 ✓
   - Create rental with final_price: ₦2,400
   - Deduct ₦2,400 from wallet
   - Result: Wallet balance = ₦1,000 - ₦2,400 (FAILS - insufficient)
   
   OR
   
   If wallet has ₦3,000+:
   - Wallet after payment: ₦600 remaining
   - Savings: ₦600
```

### Card Payment Flow with Discount
```
1. Season rental price: ₦3,000
2. User applies discount code (₦400 fixed)
3. Final price: ₦2,600
4. Process:
   - Initialize Paystack with amount: ₦2,600
   - Paystack charges card: ₦2,600
   - After verification, rental status: 'completed'
   - Savings: ₦400
```

---

## UI Enhancements for Discounts

### 1. Discount Banner (When Active)
- **Location**: Top of pricing section
- **Shows**:
  - "Discount Applied!" message
  - Savings amount (percentage or fixed)
  - Badge with discount value
  - Note: "Applies to all payment methods"
- **Styling**: Green highlight to indicate savings

### 2. Referral Code Input Section
- **Location**: Above payment method tabs
- **Features**:
  - Clear label: "Referral Code (Optional)"
  - Shows if discount is active: "✓ Discount Active"
  - When active: Shows code + "Applies to wallet & card payments"
  - Explanatory text: "Save on both wallet and card payments"

### 3. Pricing Summary
- **Line items**:
  - Original Price: ₦X
  - Discount (if active): -₦Y (green text)
  - **Total**: ₦Z (final price after discount)
- **Color coding**: Green for discounted total

### 4. Wallet Payment Tab
- **Shows**:
  - Current wallet balance
  - Amount to pay (with discount applied)
  - Balance after payment
  - Discount savings (if applicable)
  - Warning if insufficient balance
- **Key Info**: "Discount Saving: ₦Y" in green

### 5. Card Payment Tab (Paystack)
- **Shows**:
  - When discount active: Green banner confirming discount applies
  - "Your discount is applied. Pay only ₦Z"
  - All available payment methods
  - Bank transfer information

---

## Database Schema for Discounts

### referral_codes Table
```sql
{
  id: UUID,
  code: VARCHAR (e.g., "SAVE20"),
  discount_type: 'percentage' | 'fixed',
  discount_value: NUMERIC (20 for 20%, 1000 for ₦1,000),
  is_active: BOOLEAN,
  valid_until: TIMESTAMP,
  created_at: TIMESTAMP,
  max_uses: INTEGER (optional),
  created_by: UUID (admin)
}
```

### rentals Table (Updated)
```sql
{
  id: UUID,
  user_id: UUID,
  content_id: UUID,
  content_type: 'episode' | 'season' | 'movie' | 'tv',
  price: BIGINT (original price in kobo),
  discount_applied: BIGINT (savings amount in kobo),
  final_price: BIGINT (price after discount in kobo),
  payment_method: 'wallet' | 'paystack',
  status: 'pending' | 'completed' | 'cancelled' | 'expired',
  expires_at: TIMESTAMP,
  created_at: TIMESTAMP
}
```

### referral_code_uses Table
```sql
{
  id: UUID,
  code_id: UUID (FK to referral_codes),
  user_id: UUID,
  rental_id: UUID (FK to rentals),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

---

## API Endpoint (process-rental)

### Request
```json
{
  "userId": "uuid",
  "contentId": "uuid",
  "contentType": "season" | "episode",
  "price": 300000,
  "paymentMethod": "wallet" | "paystack",
  "referralCode": "SAVE20"
}
```

### Response (Wallet Payment Success)
```json
{
  "success": true,
  "rentalId": "uuid",
  "paymentMethod": "wallet",
  "discountApplied": 60000
}
```

### Response (Paystack Payment Success)
```json
{
  "success": true,
  "rentalId": "uuid",
  "paymentMethod": "paystack",
  "authorizationUrl": "https://checkout.paystack.com/...",
  "paystackReference": "ref_xxxxx",
  "discountApplied": 60000
}
```

---

## Testing Scenarios

### Scenario 1: Wallet Payment with Discount
1. Create referral code: "TESTSAVE" (20% discount)
2. User has ₦5,000 wallet balance
3. Navigate to TV show
4. Click "Rent Season" (₦3,000)
5. Enter code "TESTSAVE"
6. **Verify**: 
   - Banner shows "Save 20% (₦600)"
   - Total: ₦2,400
   - Wallet balance after: ₦2,600
7. Select Wallet payment
8. Click "Pay ₦2,400"
9. **Verify**: Success toast, access updates

### Scenario 2: Card Payment with Discount
1. Create referral code: "SAVE500" (₦500 fixed)
2. Navigate to TV show
3. Click "Rent Season" (₦3,000)
4. Enter code "SAVE500"
5. **Verify**: 
   - Banner shows "Save ₦500"
   - Total: ₦2,500
6. Select Card payment
7. **Verify**: Card tab shows "Discount Applied to Card Payment"
8. Click "Pay ₦2,500"
9. Complete Paystack payment
10. **Verify**: Access updates after verification

### Scenario 3: Insufficient Wallet Balance After Discount
1. User wallet: ₦2,000
2. Season rental: ₦3,000
3. Apply discount: 30% (₦900)
4. Final price: ₦2,100
5. **Verify**: Warning shows "You need ₦100 more"
6. Card payment option always available

### Scenario 4: Discount on Episode Rental
1. Create referral code: "EPISODE10" (10% discount)
2. Episode price: ₦350
3. Apply discount
4. Final price: ₦315
5. **Verify**: Discount works on episodes too
6. Can pay with wallet or card

### Scenario 5: Invalid/Expired Discount Code
1. Enter non-existent code: "INVALID"
2. **Verify**: Error message: "Invalid referral code"
3. Enter expired code
4. **Verify**: Error message: "This code has expired"
5. Original price remains unchanged

---

## Discount Code Management (Admin)

### Creating Codes
```sql
INSERT INTO referral_codes 
  (code, discount_type, discount_value, is_active, valid_until)
VALUES 
  ('SAVE20', 'percentage', 20, true, '2026-12-31'),
  ('SAVE500', 'fixed', 50000, true, '2026-06-30');
```

### Deactivating Codes
```sql
UPDATE referral_codes 
SET is_active = false 
WHERE code = 'SAVE20';
```

### Viewing Usage Statistics
```sql
SELECT 
  rc.code,
  rc.discount_type,
  rc.discount_value,
  COUNT(rcu.id) as total_uses,
  SUM(r.discount_applied) as total_savings,
  SUM(r.final_price) as total_revenue
FROM referral_codes rc
LEFT JOIN referral_code_uses rcu ON rc.id = rcu.code_id
LEFT JOIN rentals r ON rcu.rental_id = r.id
GROUP BY rc.id, rc.code, rc.discount_type, rc.discount_value
ORDER BY total_uses DESC;
```

---

## Features Summary

✅ **Discount Applied to Both Payment Methods**
- Wallet payment: Discount reduces wallet deduction
- Card payment: Discount reduces Paystack charge

✅ **Clear UI Communication**
- Discount banner shows savings prominently
- Both tabs indicate discount applies
- Referral code feedback (valid/invalid/expired)
- Savings displayed in multiple places

✅ **Flexible Discount Types**
- Percentage-based (e.g., 20% off)
- Fixed amount (e.g., ₦500 off)
- No maximum discount cap (can be 100% free)

✅ **Wallet Balance Consideration**
- Checks if discount brings price within wallet capacity
- Provides fallback to card if wallet insufficient
- Shows balance after discount payment

✅ **Audit Trail**
- `referral_code_uses` tracks every discount application
- Links discount to specific rental
- Enables analytics and fraud detection

✅ **Security & Validation**
- Code must be uppercase (case-insensitive input)
- Validates expiration date
- Checks active status before applying
- Prevents applying discount twice

---

## Performance Optimization

### Query Indexes
- `idx_referral_codes_active`: `(is_active, valid_until)` - Fast discount lookup
- `idx_rental_code_uses_rental`: `(rental_id)` - Track rentals with discounts
- `idx_rentals_discount`: `(discount_applied, final_price)` - Analytics queries

### Caching (Future)
- Cache active codes in frontend memory (5-min refresh)
- Validate code expiration on change detection
- Reduce database hits for code validation

---

## Error Handling

### Common Issues & Solutions

**Issue**: Discount not applying to Paystack payment
- **Check**: Cloud function receives `referralCode` parameter
- **Check**: Code is uppercase in database
- **Check**: Code `is_active = true`
- **Solution**: Verify code in referral_codes table

**Issue**: Wallet deduction showing wrong amount
- **Check**: `finalPrice` calculation includes discount
- **Check**: Discount amount is positive
- **Solution**: Verify discount_value in referral_codes

**Issue**: Discount appears applied but doesn't reduce payment
- **Check**: UI is showing calculated discount
- **Check**: Backend is receiving discount code
- **Solution**: Check browser console for validation errors

---

## Future Enhancements

1. **Bulk Discount Codes**
   - Generate multiple codes at once
   - Track individual code usage

2. **Tiered Discounts**
   - Different discounts for different content types
   - Seasonal promotions

3. **User-Specific Codes**
   - Personal referral codes
   - First-time user discounts

4. **Discount Analytics Dashboard**
   - Most used codes
   - Revenue impact
   - User engagement metrics

5. **Stacking**
   - Allow multiple discount codes
   - Limit maximum discount

---

## Configuration Checklist

- [ ] Referral codes table created with proper schema
- [ ] RLS policies allow users to apply codes
- [ ] process-rental cloud function deployed
- [ ] Admin dashboard for code management created
- [ ] Price formatting utilities in place
- [ ] Real-time updates working for access changes
- [ ] Discount UI enhancements tested
- [ ] Both wallet and card flows verified

---

**Last Updated**: April 18, 2026
**Status**: Fully Implemented & Optimized
