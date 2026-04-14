# TV Shows Rental System - Optimization Guide

## Overview

The optimized TV shows rental system provides a clean, user-friendly approach for renting TV show episodes or entire seasons. Users can:

- **Rent Individual Episodes**: 48-hour rental period
- **Rent Complete Seasons**: Full season access (all episodes unlocked)
- **Pay via Wallet**: Instant payment from pre-loaded wallet balance
- **Pay via Card**: Secure Paystack integration for credit/debit cards
- **Apply Referral Codes**: Get discounts on rentals

---

## Architecture

### Core Components

#### 1. `useOptimizedRentals` Hook
**Location**: `src/hooks/useOptimizedRentals.tsx`

Manages all rental logic:
- Fetches active rentals for authenticated users
- Checks access for episodes and seasons
- Validates season purchases (auto-unlocks all episodes)
- Processes payments via wallet or Paystack
- Real-time rental status updates

**Key Methods**:
```typescript
// Check if user has access to episode/season
const access = checkAccess(contentId, 'episode')
// Returns: { hasAccess, rental, timeRemaining }

// Check if season purchase unlocks episodes
const hasSeasonAccess = checkSeasonAccess(seasonId)

// Process rental payment
const result = await processRental(
  contentId, 
  'episode', 
  price, 
  'wallet', // or 'paystack'
  referralCode // optional
)
```

#### 2. `OptimizedRentalCheckout` Component
**Location**: `src/components/OptimizedRentalCheckout.tsx`

Clean dialog UI for payment:
- Displays pricing summary with discounts
- Tabs for wallet vs. card payment
- Referral code validation
- Real-time discount application
- Mobile and desktop responsive design

**Usage**:
```tsx
<OptimizedRentalCheckout
  open={showCheckout}
  onOpenChange={setShowCheckout}
  contentId={episodeId}
  contentType="episode"
  price={price}
  title="Episode Title"
  onSuccess={() => {
    // Refetch access, navigate to watch, etc.
  }}
/>
```

#### 3. `OptimizedRentalButton` Component
**Location**: `src/components/OptimizedRentalButton.tsx`

Smart button that handles all states:
- **Not Signed In**: Show "Sign In to Rent"
- **Has Access**: Show "Watch Now" + time remaining
- **No Access**: Show "Rent [Episode/Season] - ₦price"

**Usage**:
```tsx
<OptimizedRentalButton
  contentId={contentId}
  contentType="season"
  price={seasonPrice}
  title="Season 1"
  onRentalSuccess={() => refreshAccess()}
/>
```

---

## Database Schema

### Rentals Table
```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  content_type VARCHAR(50), -- 'episode' or 'season'
  price BIGINT NOT NULL, -- in kobo
  discount_applied BIGINT DEFAULT 0,
  final_price BIGINT NOT NULL,
  payment_method VARCHAR(50), -- 'wallet' or 'paystack'
  status VARCHAR(50), -- 'pending', 'completed', 'expired'
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

### Rental Payments Table
```sql
CREATE TABLE rental_payments (
  id UUID PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES rentals(id),
  user_id UUID NOT NULL,
  paystack_reference VARCHAR(255),
  paystack_access_code VARCHAR(255),
  amount BIGINT NOT NULL,
  payment_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT now()
);
```

---

## Cloud Functions

### `process-rental`
**Location**: `supabase/functions/process-rental/index.ts`

Handles all rental payment processing:

**Request Body**:
```typescript
{
  userId: string;
  contentId: string;
  contentType: 'episode' | 'season';
  price: number; // in kobo
  paymentMethod: 'wallet' | 'paystack';
  referralCode?: string;
}
```

**Flow**:

1. **Wallet Payment**:
   - Validates user has sufficient balance
   - Creates rental record with status='completed'
   - Deducts from wallet immediately
   - Returns rental ID

2. **Paystack Payment**:
   - Creates rental record with status='pending'
   - Initializes Paystack transaction
   - Returns authorization URL
   - Client polls for completion

**Response**:
```typescript
{
  success: boolean;
  rentalId?: string;
  authorizationUrl?: string; // For Paystack only
  discountApplied?: number;
  error?: string;
}
```

### `get-episode-access` (Updated)
**Location**: `supabase/functions/get-episode-access/index.ts`

Verifies episode access:
- Checks direct episode rental
- Falls back to season rental check
- Returns signed video URL if authorized
- Returns public trailer URL always

---

## Payment Flow

### Wallet Payment Flow
```
User clicks "Rent" 
  ↓
OptimizedRentalCheckout opens
  ↓
User selects Wallet payment
  ↓
process-rental() called
  ↓
Check wallet balance
  ↓
Create rental (status=completed)
  ↓
Deduct from wallet
  ↓
Toast success
  ↓
Optionally navigate to watch page
```

### Paystack Payment Flow
```
User clicks "Rent"
  ↓
OptimizedRentalCheckout opens
  ↓
User selects Card payment
  ↓
process-rental() called
  ↓
Create rental (status=pending)
  ↓
Initialize Paystack transaction
  ↓
Return authorization URL
  ↓
Open Paystack checkout (popup or redirect)
  ↓
User completes payment
  ↓
Paystack redirects/callback
  ↓
Client polls verify-payment()
  ↓
Update rental status to completed
  ↓
Toast success
```

---

## TVShowPreview Integration

The TVShowPreview page has been updated to use the new system:

1. **Imports**: Uses `useOptimizedRentals` instead of `useRentals`
2. **Access Checks**: Uses `checkAccess()` to determine episode/season availability
3. **Season Logic**: Season purchase automatically unlocks all episodes
4. **Rental Buttons**: Both season and episode-level rentals use `OptimizedRentalButton`

**Key Logic**:
```tsx
// Season purchase unlocks all episodes in that season
const seasonRented = seasonAccess[seasonId];
const episode HasAccess = 
  episodeAccess[episodeId] || // Direct episode rental
  seasonRented; // Or season was rented

// Show appropriate button
{episodeHasAccess ? (
  <Button variant="default">Watch Now</Button>
) : (
  <OptimizedRentalButton
    contentType="episode"
    price={episode.price}
  />
)}
```

---

## Referral Code System

### Applying Referral Codes

Users can apply referral codes during checkout:

1. Enter code in referral field
2. Click "Apply"
3. Code is validated against `referral_codes` table
4. Discount is calculated (percentage or fixed amount)
5. Usage is tracked in `referral_code_uses`
6. Final price is updated

**Code Validation Rules**:
- Must be active (`is_active = true`)
- Must not be expired (`valid_until >= now()`)
- Must not exceed max uses
- Must not exceed per-user usage limit

---

## Access Expiration

### Episode Rentals
- **Expiry Duration**: 48 hours from rental
- **Auto-Expired**: Records are marked expired when `expires_at < now()`

### Season Rentals
- **Expiry Duration**: 1 year (or indefinite based on business model)
- **Cascading Access**: All episodes automatically expire when season rental expires

---

## Error Handling

### Common Error Scenarios

**Insufficient Wallet Balance**:
```
User sees: "Insufficient wallet balance. Use card payment."
Action: Prompt user to top up wallet or use Paystack
```

**Active Rental Exists**:
```
User sees: "User already has active rental for this content"
Action: Show "Watch Now" button instead of rent
```

**Paystack Initialization Failed**:
```
User sees: "Failed to initialize payment"
Action: Offer retry or suggest wallet payment
```

**Invalid Referral Code**:
```
User sees: "Invalid referral code"
Action: Allow user to continue without discount
```

---

## Best Practices

### For Developers

1. **Always check access before playing**:
   ```tsx
   const access = checkAccess(contentId, 'episode');
   if (!access.hasAccess) {
     return <OptimizedRentalButton ... />;
   }
   return <VideoPlayer ... />;
   ```

2. **Handle rental expiry gracefully**:
   ```tsx
   if (access.timeRemaining && access.timeRemaining.hours < 1) {
     toast({ title: "Rental expires soon" });
   }
   ```

3. **Use optimistic updates**:
   ```tsx
   // After successful payment, assume access granted
   // Then refetch to confirm (or handle failure)
   ```

### For Users

1. **Season vs Episode Pricing**:
   - Seasons should be discounted per-episode
   - Example: 10 episodes @ ₦100 each = ₦1000 season
   - Season usually ₦800-900 for better value

2. **Rental Duration Management**:
   - Watch episodes immediately after rental
   - Season rentals don't expire (or very long expiry)
   - Plan viewing before renting episodes

3. **Referral Code Tips**:
   - Always check for available codes before paying
   - Codes show discount amount before checkout complete

---

## Testing

### Manual Testing Checklist

- [ ] Sign in, view TV show with seasons/episodes
- [ ] Rent episode with wallet (sufficient balance)
- [ ] Retry with episode (should show "Already Rented")
- [ ] Check episode access in player
- [ ] Rent season - verify all episodes accessible
- [ ] Rent with Paystack - verify checkout opens
- [ ] Apply referral code - verify discount applied
- [ ] Try invalid code - verify error handling
- [ ] Check time remaining display
- [ ] Test on mobile (iOS and Android)
- [ ] Test offline behavior

### Testing with Paystack

Use Paystack test cards:
- **Success**: 4084084084084081
- **Failure**: 5050505050505050

---

## Configuration

### Environment Variables

```bash
# Supabase
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key

# Paystack
PAYSTACK_PUBLIC_KEY=your_key
PAYSTACK_SECRET_KEY=your_key
```

### Rental Duration Configuration

Edit in `supabase/functions/process-rental/index.ts`:
```typescript
const RENTAL_DURATION_HOURS = 48; // Episodes
// Seasons: 1 year (can be customized)
```

---

## Future Enhancements

1. **Batch Rentals**: Rent multiple episodes at once
2. **Subscription Model**: Monthly unlimited access
3. **Rental Extensions**: Extend expiry for additional fee
4. **Download for Offline**: Cache rentals on device
5. **Analytics**: Track rental patterns, popular content
6. **Sharing**: Limited sharing with family members

---

## Support & Troubleshooting

### Common Issues

**Rental button not updating after payment**:
- Manual refresh: ⌘R / Ctrl+R
- Check internet connection
- Verify payment completed in Paystack

**Missing rental access despite payment**:
- Check rental record in database
- Verify expiry_at timestamp
- Check user_id matches auth.uid()

**Referral code not applying**:
- Check code is active in database
- Verify user hasn't exceeded limit
- Check code expiry date

For more help, check `supabase/functions/process-rental/index.ts` for detailed error logging.
