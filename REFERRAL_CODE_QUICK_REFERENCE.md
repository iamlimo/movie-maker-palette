# Referral Code Implementation - Quick Reference

## What Was Changed

### 1. Frontend Components (React/TypeScript)

#### **RentalBottomSheet.tsx** - Payment Sheet UI
- Added referral code input with collapsible section
- Enhanced price display to show original → discounted price
- Real-time code validation with error messages
- Shows savings amount and percentage
- Per-user usage limit checking
- Smooth animations for applied codes

#### **RentalButton.tsx** - Payment Logic
- Now passes `referralCode` to both payment methods
- Enhanced toast notifications with savings info
- Shows discount applied messages with emojis
- Imports `useAuth` for user context

### 2. Backend Functions (Deno/Edge Functions)

#### **create-payment/index.ts** - Card Payment Init
- Added `validateReferralCode()` function
- Validates code on amount BEFORE sending to Paystack
- Includes referral metadata in Paystack payment
- Returns `discount_applied` in response
- Supports per-user usage limit checking

#### **enhanced-webhook/index.ts** - Payment Processing
- Already handles referral code recording (no changes needed)
- Records usage in `referral_code_uses` table
- Increments `times_used` counter on referral_codes
- Idempotent - prevents double-counting on retries

#### **wallet-payment/index.ts** - Wallet Payment
- Already had referral code support (checked)
- Deducts discount from wallet balance
- Passes metadata with referral details
- Falls back to card payment option

## How It Works

### User Perspective:
1. User lands on rent page → clicks "Rent" button
2. Bottom sheet opens showing price and payment options
3. User taps "Apply referral code" section (collapsed by default)
4. User enters code (auto-uppercase)
5. System validates code in real-time
6. If valid → code applied, shows discounted price
7. User completes payment (wallet or card)
8. Success message shows total savings

### System Perspective:
1. Code validation checks 6 criteria:
   - Code exists and is active
   - Not expired
   - Global usage not exceeded
   - Per-user usage limit respected
   - Minimum purchase amount met
   - Discount doesn't exceed rental price

2. Payment processing:
   - Wallet: Immediately deducts discounted amount
   - Card: Sends discounted amount to Paystack
   - Webhook: Records final usage when payment completes

3. Database tracking:
   - Stores discount applied in referral_code_uses
   - Increments times_used on referral_codes
   - Stores full metadata with payment record

## File Changes Summary

```
Modified Files (6):
├── src/components/RentalBottomSheet.tsx
│   ├── Added useAuth import
│   ├── Added validation error state
│   ├── Added per-user limit checking
│   ├── Enhanced UI with animations
│   └── Improved error messages
│
├── src/components/RentalButton.tsx
│   ├── Added Gift, Zap icons
│   ├── Pass referralCode to create-payment
│   ├── Enhanced toast messages
│   └── Show discount in success feedback
│
├── supabase/functions/create-payment/index.ts
│   ├── Added validateReferralCode function
│   ├── Validate code before Paystack
│   ├── Deduct discount from price
│   ├── Include metadata in payment
│   └── Return discount_applied to frontend
│
├── supabase/functions/wallet-payment/index.ts
│   └── No changes (already supported)
│
├── supabase/functions/enhanced-webhook/index.ts
│   └── No changes (already handles referral recording)
│
└── REFERRAL_CODE_IMPLEMENTATION.md (NEW)
    └── Complete implementation guide
```

## Testing Checklist

- [ ] Create test referral code in admin panel
- [ ] Try using wallet payment with code
- [ ] Try using card payment with code
- [ ] Verify database records created
- [ ] Check that code can't be used twice
- [ ] Test error messages (expired, limit, etc)
- [ ] Verify toast notifications show savings
- [ ] Test on mobile (touch friendly)
- [ ] Test code removal and re-entry
- [ ] Check webhook payment recording

## Key Features

✅ **Smooth UX** - Code section is collapsible, doesn't overwhelm  
✅ **Real-time Validation** - Error feedback as users type  
✅ **Both Payment Methods** - Works with wallet AND card payments  
✅ **Per-User Limits** - Prevents code reuse abuse  
✅ **Beautiful UI** - Animated transitions, color feedback  
✅ **Security** - All validation server-side  
✅ **Audit Trail** - All usage recorded with payment ID  
✅ **Error Handling** - Friendly error messages  
✅ **Performance** - Minimal database queries  
✅ **Mobile Ready** - Touch-friendly, responsive design  

## Error Scenarios & Messages

| Issue | Message |
|-------|---------|
| Code not found | "This referral code is not valid" |
| Code expired | "This code has expired" |
| Global limit exceeded | "This code is no longer available" |
| User already used it | "You've already used this code X time(s)" |
| Below minimum purchase | "Minimum purchase required: ₦X.XX" |
| Validation error | "Error validating code. Please try again." |

## Admin Features (Already Exist)

Admins can create referral codes with:
- Custom code (auto-generated or manual)
- Discount type (percentage or fixed amount)
- Global usage limit
- Per-user usage limit
- Minimum purchase requirement
- Validity date range
- Active/Inactive toggle
- View usage history and users

## Amount Handling

All monetary amounts in system:
- Database: Stored in **kobo** (lowest currency unit)
- Wallet: Amounts in kobo
- Display: Formatted to currency using `formatNaira()`
- Paystack: Integers in kobo
- Discount: Calculated in kobo, applied in kobo

Formula:
```
discount_amount = (price * discount_value) / 100  // for percentage
discount_amount = min(discount_value, price)      // for fixed
final_price = max(0, price - discount_amount)
```

## Monitoring & Analytics

Track in admin dashboard:
- Total codes created
- Total usage by code
- Revenue impact of discounts
- Most popular codes
- Users with multiple uses (if limit > 1)
- Unused codes
- Expired codes

## Future Enhancements

- [ ] User-sharable referral links
- [ ] Referral analytics dashboard
- [ ] Tiered discount codes
- [ ] Seasonal promotions
- [ ] Affiliate tracking
- [ ] Email marketing integration
- [ ] Referral rewards program

---

**Status:** ✅ Implementation Complete  
**Ready for:** Testing, QA, Deployment
