# Database & System Architecture Quick Reference

## Content Types

**Standard database types:**
```typescript
'movie' | 'tv' | 'season' | 'episode'
```

**Always use this function to normalize:**
```typescript
import { normalizeContentType } from "@/lib/contentTypes";

normalizeContentType('tv_show')    // → 'tv'
normalizeContentType('season')     // → 'season'
normalizeContentType('episode')    // → 'episode'
normalizeContentType('movie')      // → 'movie'
```

---

## What Users Can Rent

| Type | Rentable | Duration | Table |
|------|----------|----------|-------|
| movie | ✅ | 48h | `movies` |
| tv | ❌ NO | - | `tv_shows` |
| season | ✅ | 336h | `seasons` |
| episode | ✅ | 48h | `episodes` |

---

## Admin Workflow

### 1. Create Movie
```
Admin → Add Movie
├─ title, description, genre, language, rating
├─ release_date, duration (minutes)
├─ price (rental), rental_expiry_duration (hours)
└─ video_url, thumbnail_url
```

### 2. Create TV Show
```
Admin → Add TV Show
├─ title, description, genre, language, rating
├─ release_date, price (base/unused)
└─ thumbnail_url
Returns: tv_show_id
```

### 3. Add Seasons to TV Show
```
Admin → TV Shows → [Show Name] → Add Season
├─ tv_show_id (required)
├─ season_number (1, 2, 3, ...)
├─ title, description
├─ price (rental), rental_expiry_duration (default: 336h)
└─ thumbnail_url
Returns: season_id
```

### 4. Add Episodes to Season
```
Admin → Seasons → [Season Name] → Add Episode
├─ season_id (required)
├─ episode_number (1, 2, 3, ...)
├─ title, description
├─ duration (minutes), price, rental_expiry_duration (default: 48h)
├─ video_url
└─ video_file (for upload)
Returns: episode_id
```

---

## Payment Flow

### Method 1: Wallet (Instant)
```
1. User selects rental (movie/season/episode)
2. [Optional] Apply discount code
3. Deduct from wallet
4. Create rental record → Immediate access
```

### Method 2: Paystack Card (2 seconds)
```
1. User selects rental + enters card details
2. [Optional] Apply discount code
3. Initialize Paystack payment
4. User completes payment
5. Webhook fires → Create rental record
```

---

## Discount Codes

**Admin creates:**
- Code: "MOVIEPASS"
- Discount: 20% or ₦500 off
- Max uses: 100 (total)
- Max uses per user: 3
- Valid until: date
- Min purchase: ₦500

**Validation (6 checks):**
1. Code exists and active
2. Not expired
3. Has uses remaining  
4. User hasn't exceed per-user limit
5. Rental price ≥ minimum
6. Discount doesn't exceed cap

**Both wallet and card payments support codes**

---

## Database Constraints

```sql
-- Rentals: must be rentable types
CHECK (content_type IN ('movie', 'tv', 'season', 'episode'))

-- Watch history: all types except pure 'tv'
CHECK (content_type IN ('movie', 'episode', 'season', 'tv'))

-- Favorites: all types including 'tv_show'
CHECK (content_type IN ('movie', 'episode', 'season', 'tv_show'))
```

---

## Payment Functions

### wallet-payment
- **File:** `supabase/functions/wallet-payment/index.ts`
- **Handles:** movie, tv (tv_show), season, episode
- **Fallback:** If wallet insufficient → redirects to Paystack

### create-payment  
- **File:** `supabase/functions/create-payment/index.ts`
- **Handles:** Direct Paystack card payments
- **Applies:** Discount codes before sending to Paystack

### enhanced-webhook
- **File:** `supabase/functions/enhanced-webhook/index.ts`
- **Fulfills:** Rental creation after successful payment
- **Records:** Discount code usage

---

## Frontend Integration

### RentalButton Component
```typescript
<RentalButton
  contentId="uuid"
  contentType="movie" | "tv" | "season" | "episode" | "tv_show"
  price={2500}
  title="Content Title"
/>
```

**Component automatically:**
- Normalizes content_type
- Checks user's active rentals
- Handles both wallet and card payments
- Shows countdown timer for active rentals
- Applies discount codes

---

## Common Queries

### Get user's active rentals
```sql
SELECT * FROM rentals
WHERE user_id = 'user-uuid'
  AND status = 'active'
  AND expires_at > now()
ORDER BY expires_at DESC;
```

### Check if user has content access
```sql
SELECT * FROM rentals
WHERE user_id = 'user-uuid'
  AND content_id = 'content-uuid'
  AND content_type = 'movie' | 'season' | 'episode'
  AND status = 'active'
  AND expires_at > now();
```

### Get all seasons for TV show
```sql
SELECT *  FROM seasons
WHERE tv_show_id = 'show-uuid'
  AND status = 'active'
ORDER BY season_number ASC;
```

### Get all episodes for season
```sql
SELECT * FROM episodes
WHERE season_id = 'season-uuid'
  AND status = 'active'
ORDER BY episode_number ASC;
```

### Get discount code details
```sql
SELECT * FROM referral_codes
WHERE code = 'MOVIEPASS'
  AND is_active = true
  AND valid_until > now();
```

---

## Error Handling

### Invalid Content Types
```
Keep validating until you use normalizeContentType()
Normalize as early as possible (at component boundary)
```

### Insufficient Balance
```
User tries wallet payment but balance < price
Response: 400 error with balance info
Solution: Top up wallet or use card payment
```

### Rental Already Exists  
```
User tries to rent same content twice
Response: 400 error with expiry time
Solution: Wait for rental to expire or extend
```

### Code Limit Exceeded
```
User tries to use code for 4th time (max 3)
Response: 400 error "User limit reached"
Solution: Use different code
```

---

## Files to Know

| File | Purpose |
|------|---------|
| `src/lib/contentTypes.ts` | Type definitions & normalization |
| `src/components/RentalButton.tsx` | Payment orchestration |
| `src/components/RentalBottomSheet.tsx` | Discount code UI |
| `src/hooks/useRentals.ts` | Rental access checks |
| `supabase/migrations/20260413000000_standardize_content_types.sql` | DB schema update |
| `supabase/functions/wallet-payment/index.ts` | Wallet payments |
| `supabase/functions/create-payment/index.ts` | Paystack initiation |
| `supabase/functions/enhanced-webhook/index.ts` | Webhook fulfillment |

---

## Next Steps

1. Test movie rentals (48h)
2. Test season rentals (336h)
3. Test episode rentals (48h)
4. Test discount codes with movies
5. Test discount codes with seasons
6. Test discount codes with episodes
7. Verify all 4 content types in database as expected
8. Monitor rental expiry timestamps

---

## Recovery from Issues

### If normalizeContentType returns wrong value
- Check frontendContentType input - likely unsupported value
- Add to contentTypes.ts normalizeContentType switch case
- Test with new value

### If rental not created after payment
- Check webhook is receiving payload
- Verify signature verification passes
- Check rental table constraints match content_type
- Review enhanced-webhook logs in webhook_events table

### If discount code not working
- Verify code exists in referral_codes table
- Check is_active = true
- Check valid_until > now()
- Check times_used < max_uses
- Check user hasn't exceeded max_uses_per_user
- Check price >= min_purchase_amount

