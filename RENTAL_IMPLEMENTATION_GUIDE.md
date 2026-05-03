# Quick Implementation Guide - TV Shows Rental Optimization

## What Was Built

A complete, user-friendly TV show rental system supporting:
- **Episode Rentals** (48-hour access, individual purchase)
- **Season Rentals** (full season purchase, unlocks all episodes automatically)
- **Dual Payment**: Wallet or Paystack card payment
- **Referral Codes**: Apply discount codes during checkout
- **Smart UI**: Automatic state management (Sign In → Rent → Watch)

---

## Files Created/Modified

### New Files
```
src/hooks/useOptimizedRentals.tsx                    ← Core rental logic
src/components/OptimizedRentalCheckout.tsx          ← Payment dialog UI
src/components/OptimizedRentalButton.tsx            ← Smart rent button
supabase/functions/process-rental/index.ts          ← Payment processor
supabase/migrations/20260414000000_optimize_tv_rental_system.sql  ← Schema
```

### Modified Files
```
src/pages/TVShowPreview.tsx                         ← Updated to use new system
```

### Documentation
```
TV_SHOWS_RENTAL_OPTIMIZATION.md                    ← Full documentation
```

---

## Quick Start - Using in Your Components

### Basic Episode Rental Button
```tsx
import { OptimizedRentalButton } from '@/components/OptimizedRentalButton';

<OptimizedRentalButton
  contentId={episode.id}
  contentType="episode"
  price={episode.price}
  title={`Episode ${episode.episode_number}: ${episode.title}`}
  onRentalSuccess={() => {
    // Refresh access or navigate
  }}
/>
```

### Season Rental Button
```tsx
<OptimizedRentalButton
  contentId={season.id}
  contentType="season"
  price={season.price}
  title={`Season ${season.season_number}`}
/>
```

### Check User Access
```tsx
import { useOptimizedRentals } from '@/hooks/useOptimizedRentals';

const { checkAccess, checkSeasonAccess } = useOptimizedRentals();

// Check episode access
const episodeAccess = checkAccess(episodeId, 'episode');
if (episodeAccess.hasAccess) {
  // Show: Watch Now + time remaining
  console.log(episodeAccess.timeRemaining.formatted); // "2h 30m remaining"
}

// Check if season includes episodes
const hasSeason = checkSeasonAccess(seasonId);
if (hasSeason) {
  // All episodes in this season are accessible
}
```

---

## Payment Processing Flow

### User Flow Diagram
```
┌─────────────┐
│   Sign In   │  (if needed)
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Click "Rent Episode" │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ OptimizedRentalCheckout opens    │
│ - Shows price & discount options │
│ - Lets user enter referral code  │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────┐
│ Select Payment   │
├──────────────────┤
│ Wallet or Card?  │
└──────┬───────────┘
       │
       ├─────────────────────┬─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
   ┌────────┐         ┌────────────┐        ┌─────────┐
   │ WALLET │         │ PAYSTACK   │        │ PENDING │
   ├────────┤         ├────────────┤        └─────────┘
   │ • Check│         │ • Create   │           (if fails)
   │   bal. │         │   pending  │
   │ • Pay  │         │ • Open     │
   │ • DONE │         │   payment  │
   └─┬──────┘         └────┬───────┘
     │                     │
     │              Complete payment
     │              in Paystack
     │                     │
     │                     ▼
     │              ┌─────────────┐
     │              │ Confirm Pay │
     │              └──────┬──────┘
     │                     │
     └─────────┬───────────┘
               │
               ▼
        ┌─────────────┐
        │ WATCH NOW!  │
        │ + Timer     │
        └─────────────┘
```

---

## Key Implementation Details

### 1. Database Schema
The new optimization uses an optimized `rentals` table:

```sql
rentals(
  id, 
  user_id,
  content_id,        -- Episode or Season ID
  content_type,      -- 'episode' or 'season'
  price,             -- Original price (kobo)
  discount_applied,  -- Referral discount amount
  final_price,       -- Actual paid amount
  payment_method,    -- 'wallet' or 'paystack'
  status,            -- 'pending' | 'completed' | 'expired'
  expires_at         -- When rental ends
)
```

### 2. Access Logic
- **Episode Rental**: User can watch that episode for 48 hours
- **Season Rental**: User can watch ALL episodes in season indefinitely (or 1 year)
- **Cascading Effect**: Season rental automatically unlocks all episodes without requiring separate payment

### 3. Referral Code System
```tsx
// User enters code during checkout
// Code validated with:
- is_active = true
- valid_until >= now()
- times_used < max_uses
- user_uses < max_uses_per_user

// Discount calculated:
// Percentage: Math.floor(price * discount_value / 100)
// Fixed: Math.min(discount_value, price)

// Usage recorded in referral_code_uses table
```

### 4. Error Handling
All error scenarios are handled gracefully:

| Scenario | User Sees | Action |
|----------|-----------|--------|
| Insufficient wallet | Balance warning + card option | Use card or top up |
| Invalid referral | Error message | Try another code |
| Payment fails | Retry or use other method | Automatic retry option |
| Already rented | "Already purchased" message | Show Watch Now button |
| Network error | Retry button | Automatic retry logic |

---

## Testing Checklist

### Basic Functionality
- [ ] Can rent episode with wallet (have balance)
- [ ] Can rent episode with card (Paystack)
- [ ] Can apply valid referral code
- [ ] Season rental unlocks all episodes
- [ ] Watch button shows time remaining

### Error Cases
- [ ] Insufficient wallet shows error
- [ ] Invalid code shows error
- [ ] Already rented shows "Watch Now"
- [ ] Network failure retries automatically

### Edge Cases
- [ ] Referral code expires during checkout
- [ ] User runs out of per-user code limit
- [ ] Season expires (episodes become inaccessible)
- [ ] Direct navigate to video without checking access

---

## API Reference

### `useOptimizedRentals()` Hook

```typescript
interface RentalAccess {
  hasAccess: boolean;
  rental: RentalRecord | null;
  timeRemaining: {
    hours: number;
    minutes: number;
    formatted: string;
  } | null;
}

interface RentalRecord {
  id: string;
  user_id: string;
  content_id: string;
  content_type: 'episode' | 'season';
  price: number;
  payment_method: 'wallet' | 'paystack';
  status: 'pending' | 'completed' | 'expired';
  expires_at: string;
}

// Methods
checkAccess(contentId, 'episode' | 'season'): RentalAccess
checkSeasonAccess(seasonId): boolean
processRental(contentId, type, price, method, code?): Promise<{
  success: boolean;
  rentalId?: string;
  authorizationUrl?: string;
  error?: string;
}>
```

### `OptimizedRentalCheckout` Component

```typescript
interface OptimizedRentalCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentType: 'episode' | 'season';
  price: number;
  title: string;
  onSuccess?: () => void;
}
```

### `OptimizedRentalButton` Component

```typescript
interface OptimizedRentalButtonProps {
  contentId: string;
  contentType: 'episode' | 'season';
  price: number;
  title: string;
  onRentalSuccess?: () => void;
}
```

---

## Migration Path

If you have existing rentals:

1. **Data Migration**: Run migration to create new tables
2. **Parallel Running**: Old and new systems can coexist
3. **Gradual Rollout**: Switch pages one by one
4. **Cleanup**: Archive old rental tables after full migration

(See TVShowPreview.tsx for example of updated page)

---

## Performance Optimizations

1. **Indexed Queries**: Fast lookups on `(user_id, status, expires_at)`
2. **Subscription Updates**: Real-time rental status via Supabase subscriptions
3. **Memoized Checks**: Access checks cached until rentals change
4. **Lazy Loading**: Episodes only fetched when season selected

---

## Future Enhancements

Ready for:
- ✅ Subscription model (monthly unlimited)
- ✅ Batch rentals (rent multiple at once)
- ✅ Rental extensions (pay to extend)
- ✅ Analytics (popular content, user patterns)
- ✅ Offline viewing (cached rentals)
- ✅ Family sharing (limited episode access)

---

## Support

### Common Questions

**Q: Can user rent same episode twice?**  
A: No, active rental prevents duplicate. Shows "Watch Now" instead.

**Q: Does season auto-unlock new episodes added later?**  
A: Yes, based on `check_episode_access()` function that checks season_id.

**Q: How long does episode rental last?**  
A: 48 hours from purchase. Configurable in `process-rental` function.

**Q: Can referral code be used multiple times?**  
A: Yes, limited by `max_uses_per_user` setting per code.

**Q: What if wallet payment fails halfway?**  
A: Automatic rollback: rental record deleted, wallet unchanged.

---

## Next Steps

1. ✅ Deploy migrations: `supabase db push`
2. ✅ Deploy cloud function: `supabase functions deploy process-rental`
3. ✅ Test with sample data in staging
4. ✅ Update other content pages (RemoteMovies, SingleMovie, etc.)
5. ✅ Create admin dashboard for referral code management
6. ✅ Monitor payment success/failure rates
