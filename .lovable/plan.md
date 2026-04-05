

# Referral Code & Discount System

## Overview
Super admins create alphanumeric referral/promo codes with discount options (percentage or fixed amount). Users apply codes during checkout to get discounts on rentals.

## Database

### New table: `referral_codes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `code` | text UNIQUE NOT NULL | Alphanumeric, uppercase, e.g. "SAVE20" |
| `discount_type` | text NOT NULL | `'percentage'` or `'fixed'` |
| `discount_value` | numeric NOT NULL | e.g. 20 for 20%, or 5000 for ₦50 off (kobo) |
| `max_uses` | integer | NULL = unlimited |
| `times_used` | integer DEFAULT 0 | |
| `max_uses_per_user` | integer DEFAULT 1 | |
| `min_purchase_amount` | numeric DEFAULT 0 | Minimum cart value in kobo |
| `valid_from` | timestamptz DEFAULT now() | |
| `valid_until` | timestamptz | NULL = no expiry |
| `is_active` | boolean DEFAULT true | |
| `created_by` | uuid | Super admin who created it |
| `created_at` | timestamptz DEFAULT now() | |

RLS: Super admins full access; authenticated users SELECT on active codes only.

### New table: `referral_code_uses`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `code_id` | uuid NOT NULL | References referral_codes |
| `user_id` | uuid NOT NULL | |
| `payment_id` | uuid | |
| `discount_applied` | numeric NOT NULL | Actual discount in kobo |
| `created_at` | timestamptz DEFAULT now() | |

RLS: Super admins full access; users can view their own; system can insert.

## Files to Modify

### 1. New admin page: `src/pages/admin/ReferralCodes.tsx`
- Table listing all codes with: code, type, value, uses/max, status, valid dates
- Create dialog: code input (auto-generate option), discount type dropdown, value, max uses, per-user limit, min purchase, validity dates
- Toggle active/inactive, delete codes
- View usage history per code

### 2. `src/components/admin/AdminLayout.tsx`
- Add "Referral Codes" to sidebar under a new item or alongside Finance (icon: `Tag`)

### 3. `src/App.tsx`
- Add route `/admin/referral-codes` pointing to the new page

### 4. `src/components/RentalButton.tsx`
- Add state for referral code input and validated discount
- Before payment, show a collapsible "Have a referral code?" input
- On code entry, validate via `supabase.functions.invoke('validate-referral-code')` 
- Pass `referralCode` to `wallet-payment` edge function
- Display discounted price when valid

### 5. `src/components/RentalBottomSheet.tsx`
- Add referral code input field and apply button
- Show original price struck through + discounted price when code applied
- Pass referral code up to parent via callback

### 6. `supabase/functions/wallet-payment/index.ts`
- Accept optional `referralCode` in request body
- If provided: validate code (active, not expired, usage limits, per-user limit, min purchase)
- Calculate discounted price, use that for wallet debit or Paystack amount
- After successful payment, increment `times_used` and insert into `referral_code_uses`
- Include discount info in payment metadata

### 7. `supabase/functions/enhanced-webhook/index.ts`
- On successful Paystack payment, check metadata for referral code info
- Record usage in `referral_code_uses` if not already recorded

## Implementation Details

- Codes stored uppercase; user input normalized to uppercase before validation
- Discount capped so final price never goes below 0
- For percentage discounts: `discount = Math.floor(price * value / 100)`
- For fixed discounts: `discount = Math.min(value, price)`
- Admin can auto-generate codes using a random 8-char alphanumeric string

## UI Flow

```text
┌─────────────────────────────┐
│  Rent "Movie Title"         │
│  ₦1,000.00 · 48hr rental   │
│                             │
│  ▸ Have a referral code?    │  <- collapsible
│  ┌─────────────┬─────────┐  │
│  │ SAVE20      │ Apply   │  │
│  └─────────────┴─────────┘  │
│  ✓ 20% off applied (-₦200) │
│                             │
│  ~~₦1,000~~ ₦800.00        │
│                             │
│  [Pay with Wallet]          │
│  [Pay with Card]            │
└─────────────────────────────┘
```

