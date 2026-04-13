# Content Architecture & Standardization Guide

## Overview

This guide documents the standardized content type system and the admin workflow for creating and managing content in the movie-maker-palette platform.

**Architecture Principle:** The system now cleanly separates content structure from rental mechanics.

---

## 1. Content Type Standard

### Database-Level Content Types

The standardized content types in the database are:

```typescript
type ContentType = 'movie' | 'tv' | 'season' | 'episode';
```

**Definitions:**
- **`movie`** - Standalone rentable item with a single video file
- **`tv`** - Collection of seasons (NOT directly rentable; only via seasons/episodes)
- **`season`** - Collection of episodes within a TV show (rentable as a unit)
- **`episode`** - Individual episode within a season (rentable individually)

### Frontend-to-Database Mapping

The frontend may receive various content types from API responses and component props. The `normalizeContentType()` function standardizes them:

```typescript
import { normalizeContentType } from "@/lib/contentTypes";

// Frontend values           → Database value
normalizeContentType('movie')     // → 'movie'
normalizeContentType('tv')        // → 'tv'
normalizeContentType('tv_show')   // → 'tv' (normalized)
normalizeContentType('season')    // → 'season'
normalizeContentType('episode')   // → 'episode'
```

**Key Point:** `'tv_show'` always normalizes to `'tv'`. This maintains backward compatibility while standardizing database queries.

---

## 2. Content Hierarchy

### Visual Structure

```
TV Show (content_type='tv')
├── Season 1 (content_type='season')
│   ├── Episode 1 (content_type='episode')
│   ├── Episode 2 (content_type='episode')
│   └── Episode N (content_type='episode')
├── Season 2 (content_type='season')
│   ├── Episode 1 (content_type='episode')
│   └── Episode M (content_type='episode')
└── Season N (content_type='season')

Movie (content_type='movie')
└── Single video (no episodes/seasons)
```

### Database Relationships

```sql
-- TV Shows
CREATE TABLE tv_shows (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,           -- Base price (may not be used for rental)
  rental_expiry_duration INTEGER,
  status TEXT,
  ...
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY,
  tv_show_id UUID NOT NULL REFERENCES tv_shows(id),
  season_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  price NUMERIC,           -- Season rental price
  rental_expiry_duration INTEGER,  -- Default: 336 hours (14 days)
  status TEXT,
  ...
  UNIQUE(tv_show_id, season_number)
);

-- Episodes
CREATE TABLE episodes (
  id UUID PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES seasons(id),
  episode_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  duration_minutes INTEGER,
  price NUMERIC,           -- Episode rental price
  rental_expiry_duration INTEGER,  -- Default: 48 hours (2 days)
  video_url TEXT,
  status TEXT,
  ...
  UNIQUE(season_id, episode_number)
);

-- Movies
CREATE TABLE movies (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,           -- Movie rental price
  rental_expiry_duration INTEGER,  -- Default: 48 hours (2 days)
  video_url TEXT,
  status TEXT,
  ...
);
```

---

## 3. Rental Capability

### What Users Can Rent

| Content Type | Rentable? | Duration | Example |
|---|---|---|---|
| **movie** | ✅ Yes | 48 hours (2 days) | "Inception" |
| **tv** (full show) | ❌ NO | N/A | Users must rent seasons/episodes instead |
| **season** | ✅ Yes | 336 hours (14 days) | "Breaking Bad S1" |
| **episode** | ✅ Yes | 48 hours (2 days) | "Breaking Bad S1E1" |

### Rental Rules

1. **Movies** - Rent entire movie for 48 hours
2. **Seasons** - Rent entire season (all episodes) for 14 days
3. **Episodes** - Rent individual episode for 48 hours
4. **TV Shows** - Users CANNOT rent entire TV show; must choose seasons or episodes

### Rental Table Schema

```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'tv', 'season', 'episode')),
  amount NUMERIC NOT NULL,
  status TEXT CHECK (status IN ('active', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- For efficient queries
  UNIQUE(user_id, content_id, content_type, status)
);
```

---

## 4. Admin Content Creation Workflow

### Step 1: Create a Movie

**UI:** Admin Dashboard → Content Management → Add Movie

**Required Fields:**
- Title
- Description
- Genre
- Language
- Rating (PG, 12A, 15, 18, etc.)
- Release Date
- Duration (minutes)
- Rental Price (in Naira)
- Rental Duration (hours) - Default: 48
- Video URL (or upload)
- Thumbnail URL

**Database Operation:**
```sql
INSERT INTO movies (title, description, genre_id, language, rating, 
                   release_date, duration, price, rental_expiry_duration, 
                   video_url, thumbnail_url, status)
VALUES (...);
```

**API Endpoint:** `POST /functions/v1/create-movie`

---

### Step 2: Create a TV Show

**UI:** Admin Dashboard → Content Management → Add TV Show

**Required Fields:**
- Title
- Description
- Genre
- Language
- Rating
- Release Date
- Base Price (may not be directly used)
- Thumbnail URL

**Database Operation:**
```sql
INSERT INTO tv_shows (title, description, genre_id, language, rating, 
                      release_date, price, thumbnail_url, status)
VALUES (...);
```

**API Endpoint:** `POST /functions/v1/create-tv-show`

**Returns:** `tv_show_id` (used in next step)

---

### Step 3: Add Seasons to TV Show

**UI:** Admin Dashboard → Content Management → TV Shows → [TV Show Name] → Add Season

**Required Fields:**
- TV Show (from dropdown)
- Season Number (1, 2, 3, ...)
- Season Title (e.g., "Season 1", "The Beginning", etc.)
- Description
- Rental Price (in Naira)
- Rental Duration (hours) - Default: 336
- Thumbnail/Poster URL

**Database Operation:**
```sql
INSERT INTO seasons (tv_show_id, season_number, title, description, 
                     price, rental_expiry_duration, thumbnail_url, status)
VALUES (...);
```

**API Endpoint:** `POST /functions/v1/create-season`

**Input:**
```json
{
  "tv_show_id": "uuid",
  "season_number": 1,
  "title": "Season 1",
  "description": "...",
  "price": 3000,
  "rental_expiry_duration": 336
}
```

**Returns:** `season_id` (used in next step)

---

### Step 4: Add Episodes to Season

**UI:** Admin Dashboard → Content Management → TV Shows → [TV Show Name] → Seasons → [Season Name] → Add Episode

**Required Fields:**
- Season (pre-filled from navigation)
- Episode Number (1, 2, 3, ...)
- Episode Title
- Description
- Duration (minutes)
- Rental Price (in Naira)
- Rental Duration (hours) - Default: 48
- Video URL (or upload)

**Database Operation:**
```sql
INSERT INTO episodes (season_id, episode_number, title, description, 
                      duration, price, rental_expiry_duration, video_url, status)
VALUES (...);
```

**API Endpoint:** `POST /functions/v1/upload-episode`

**Input:**
```json
{
  "season_id": "uuid",
  "episode_number": 1,
  "title": "Pilot",
  "description": "...",
  "duration": 45,
  "price": 800,
  "rental_expiry_duration": 48,
  "video_url": "...",
  "video_file": "binary data (if uploading)"
}
```

**Returns:** `episode_id`

---

## 5. Payment & Rental System

### Payment Methods

| Method | Speed | Supports | Requirements |
|--------|-------|----------|--------------|
| **Wallet** | Instant | All rental types | Wallet balance ≥ rental price |
| **Paystack** | ~2 seconds | All rental types | Card or bank account |
| **Discount Code** | Applied to both | Movie, Season, Episode | Code must be valid |

### Discount Codes (Admin-Created)

**Admin Creates Code:**
```
Code: MOVIEPASS2024
Discount: 20% off
Max Uses: 100
Max Uses Per User: 3
Valid Until: 2025-12-31
Minimum Purchase: ₦500
```

**User Applies Code During Checkout:**
1. Select rental (movie/season/episode)
2. Choose payment method (wallet or card)
3. In payment sheet: Enter discount code
4. System validates:
   - Code exists and is active
   - Code not expired
   - Code has uses remaining
   - User hasn't exceeded per-user limit
   - Rental price ≥ minimum purchase
5. Discount calculated and shown
6. Payment proceeds with discounted amount

**Validation Logic (Server-Side):**
```typescript
async function validateReferralCode(supabase, code, userId, price) {
  const codeData = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  // 6-level checks:
  if (!codeData) return { valid: false, error: 'Invalid code' };
  if (new Date(codeData.valid_until) < new Date()) return { valid: false, error: 'Expired' };
  if (codeData.times_used >= codeData.max_uses) return { valid: false, error: 'No uses left' };
  if (price < codeData.min_purchase_amount) return { valid: false, error: 'Minimum not met' };
  
  const userUsageCount = await checkUserUsageCount(codeData.id, userId);
  if (userUsageCount >= codeData.max_uses_per_user) return { valid: false, error: 'User limit reached' };
  
  // Calculate discount
  const discount = codeData.discount_type === 'percentage'
    ? Math.floor(price * codeData.discount_value / 100)
    : codeData.discount_value;

  return { valid: true, discount };
}
```

---

## 6. Payment Flow Diagrams

### Wallet Payment Flow

```
┌─────────────────────────────────┐
│ User selects rental + payment   │
│ method: WALLET                  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Apply discount code (optional)  │
│ - Validate code                 │
│ - Calculate final price         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Check wallet balance            │
│ balance ≥ final_price?          │
└──────────────┬──────────────────┘
               │
          ┌────┴────┐
          ▼         ▼
         YES       NO
         │         │
         │    ┌────────────────────┐
         │    │ Return error       │
         │    │ "Insufficient      │
         │    │  balance"          │
         │    └────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Deduct from wallet              │
│ wallet.balance -= final_price   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Create rental record            │
│ INSERT INTO rentals             │
│ - content_type: movie|season|.. │
│ - expires_at: now + duration    │
│ - status: 'active'              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Record discount  code usage     │
│ INSERT INTO referral_code_uses  │
│ UPDATE referral_codes           │
│ times_used++                    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Return success                  │
│ {                               │
│   success: true,                │
│   rental_expires_at: ...        │
│   discount_applied: amount      │
│ }                               │
└─────────────────────────────────┘
```

### Card Payment Flow (Paystack)

```
┌─────────────────────────────────┐
│ create-payment function         │
│ - Validate input                │
│ - Apply discount code           │
│ - Calculate final price         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Initialize Paystack             │
│ POST to paystack/initialize     │
│ - amount: final_price * 100     │
│ - reference: payment_id         │
│ - metadata: content details     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Return Paystack URL to client   │
│ User opens payment page         │
│ User enters card details        │
└──────────────┬──────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
   SUCCESS           FAILED
      │                 │
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Webhook fires│  │ Update       │
│ charge.      │  │ payment      │
│ success      │  │ status to    │
└──────────────┘  │ 'failed'     │
      │           └──────────────┘
      ▼
┌─────────────────────────────────┐
│ enhanced-webhook function       │
│ - Verify webhook signature      │
│ - Check for duplicates          │
│ - Process successful charge     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ fulfillRental()                 │
│ - Get rental duration for       │
│   content_type (movie/season..) │
│ - INSERT INTO rentals           │
│ - Record discount usage         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ Rental complete                 │
│ User can now access content     │
└─────────────────────────────────┘
```

---

## 7. Implementation Details

### Content Type Normalization

**File:** `src/lib/contentTypes.ts`

```typescript
export function normalizeContentType(
  contentType: FrontendContentType | string
): ContentType {
  const lowerType = String(contentType).toLowerCase().trim();
  
  // Normalize tv_show to tv
  if (lowerType === 'tv_show') {
    return 'tv';
  }
  
  // Accept standard types
  if (lowerType === 'movie' || lowerType === 'tv' || 
      lowerType === 'season' || lowerType === 'episode') {
    return lowerType as ContentType;
  }
  
  // Default fallback
  console.warn(`Unknown content type: ${contentType}, defaulting to 'tv'`);
  return 'tv';
}
```

### Rental Duration Defaults

```typescript
export function getDefaultRentalDuration(contentType: ContentType): number {
  switch (contentType) {
    case 'movie':
      return 48;           // 2 days
    case 'season':
      return 336;          // 14 days
    case 'episode':
      return 48;           // 2 days
    case 'tv':
      return 336;          // Shouldn't be rented, but default to season
  }
}
```

### Database Constraints

**Rentals Table:**
```sql
CREATE TABLE rentals (
  ...
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'tv', 'season', 'episode')),
  ...
);
```

**Watch History Table:**
```sql
CREATE TABLE watch_history (
  ...
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'episode', 'season', 'tv')),
  ...
);
```

---

## 8. Admin API Endpoints

### Create Movie
```
POST /functions/v1/create-movie

{
  "title": "Inception",
  "description": "...",
  "genre_id": "uuid",
  "language": "English",
  "rating": "12A",
  "release_date": "2010-07-16",
  "duration": 148,
  "price": 2500,
  "rental_expiry_duration": 48,
  "video_url": "...",
  "thumbnail_url": "..."
}

Response: { movie_id, status: 'success' }
```

### Create TV Show
```
POST /functions/v1/create-tv-show

{
  "title": "Breaking Bad",
  "description": "...",
  "genre_id": "uuid",
  "language": "English",
  "rating": "18",
  "release_date": "2008-01-20",
  "price": 500, // Base price (may not be used)
  "thumbnail_url": "..."
}

Response: { tv_show_id, status: 'success' }
```

### Create Season
```
POST /functions/v1/create-season

{
  "tv_show_id": "uuid",
  "season_number": 1,
  "title": "Season 1",
  "description": "...",
  "price": 3000,
  "rental_expiry_duration": 336,
  "thumbnail_url": "..."
}

Response: { season_id, status: 'success' }
```

### Add Episode
```
POST /functions/v1/upload-episode

{
  "season_id": "uuid",
  "episode_number": 1,
  "title": "Pilot",
  "description": "...",
  "duration": 58,
  "price": 800,
  "rental_expiry_duration": 48,
  "video_url": "...",
  "video_file": "binary data (optional for upload)"
}

Response: { episode_id, status: 'success' }
```

---

## 9. Common Admin Tasks

### View All TV Shows
```
GET /rest/v1/tv_shows?order=created_at.desc

Shows: [
  { id, title, status, created_at, season_count: (select count from seasons) }
]
```

### View Seasons for a TV Show
```
GET /rest/v1/seasons?tv_show_id=eq.{tv_show_id}&order=season_number.asc

Seasons: [
  { id, tv_show_id, season_number, title, price, episode_count: (select count from episodes) }
]
```

### View Episodes for a Season
```
GET /rest/v1/episodes?season_id=eq.{season_id}&order=episode_number.asc

Episodes: [
  { id, season_id, episode_number, title, duration, price, video_url }
]
```

### Update Season Price
```
PATCH /rest/v1/seasons?id=eq.{season_id}

{
  "price": 4000
}
```

### Deactivate Episode
```
PATCH /rest/v1/episodes?id=eq.{episode_id}

{
  "status": "inactive"
}
```

---

## 10. User-Facing Features

### Viewing Movies
- List all active movies
- Filter by genre
- Show price and rental duration
- "Rent" button → Checkout

### Viewing TV Shows
- List all active TV shows
- Browse seasons (can't rent full show)
- View episodes within season
- Can rent:
  - Full season (all episodes for 14 days)
  - Individual episode (48 hours)
- Show prices and durations separately

### Rental Checkout
1. Select movie/season/episode
2. Choose payment method:
   - Wallet (if balance ≥ price)
   - Card (Paystack)
3. Optional: Apply discount code
4. Review final price (with discount)
5. Complete payment
6. See rental countdown timer

### Active Rentals View
- Show all active rentals with content titles
- Display time remaining format: "14d 6h remaining" or "3h 45m remaining"
- Color coding: Green (most time), Yellow (< 24h), Red (< 1h)
- Quick "Watch" button for each rental
- One-click extend option (if enabled)

---

## 11. Testing Scenarios

### Scenario 1: Movie Rental
1. Admin creates movie "Inception"
2. User rents "Inception" for ₦2500 with wallet
3. User sees 48-hour countdown
4. After 48 hours, rental expires

### Scenario 2: Season Rental with Discount
1. Admin creates TV show "Breaking Bad" with 5 seasons
2. Admin creates Season 1 for ₦3000
3. Admin creates discount code "BINGE50": 50% off
4. User rents Season 1 using discount code
5. Final price: ₦1500
6. User sees 14-day countdown
7. User can watch all episode of Season 1

### Scenario 3: Episode Rental
1. Admin creates TV show "The Office"
2. Admin adds Season 1 with 6 episodes
3. User rents Episode 1 for ₦500 (48-hour rental)
4. User rents Episode 2 for ₦500 (48-hour rental)
5. User can watch both episodes independently
6. Each expires after 48 hours

### Scenario 4: Discount Code Limits
1. Admin creates code "FIRST10": ₦1000 off, max 5 uses per user
2. User 1 applies code to ₦3000 rental → ₦2000 paid (1 use)
3. User 1 applies code to ₦2500 rental → ₦1500 paid (2 uses)
4. User 1 tries again → System rejects (exceeded 5-use limit)
5. User 2 can still apply code (different user)

---

## 12. Error Handling

### Payment Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Insufficient wallet balance | Account balance too low | Top up wallet or pay by card |
| Invalid referral code | Code doesn't exist or invalid | Enter correct code or remove |
| Code expired | Discount code validity period ended | Use different code |
| Code fully redeemed | All code uses consumed | Use different code |
| Minimum purchase not met | Content price below code minimum | Purchase more expensive content |
| User limit exceeded | User already used code max times | Use different code |

### Content Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Content not found | Invalid content_id | Verify correct content |
| Season not found | Invalid season_id | Check TV show still has season |
| Episode not found | Invalid episode_id | Check season still has episode |
| Active rental exists | User already rented this content | Wait for rental to expire |

---

## 13. Performance Considerations

### Database Indexes

```sql
-- Rentals table
CREATE INDEX idx_rentals_user_id ON rentals(user_id);
CREATE INDEX idx_rentals_content ON rentals(content_id, content_type);
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_expires_at ON rentals(expires_at);

-- Episodes table
CREATE INDEX idx_episodes_season_id ON episodes(season_id);
CREATE INDEX idx_episodes_status ON episodes(status);

-- Seasons table  
CREATE INDEX idx_seasons_tv_show_id ON seasons(tv_show_id);
CREATE INDEX idx_seasons_status ON seasons(status);
```

### Query Optimization

- Use `content_type` in WHERE clauses for filtering
- Batch rental checks using `LEFT JOIN` instead of N queries
- Cache frequently accessed content (movies, popular seasons)
- Use pagination for large result sets

---

## 14. Migration Path (If You Had Legacy Data)

If migrating from old system where 'tv' meant something different:

```sql
-- Before migration backup
CREATE TABLE rentals_backup AS SELECT * FROM rentals;

-- Update existing tv rentals to behave like full-show
-- Full show rentals → manually create season rentals for each season they owned

-- Or simpler: keep legacy rentals as-is, only apply new logic to NEW rentals

-- Mark schema version
INSERT INTO schema_versions (version, description, applied_at)
VALUES (2, 'Standardized content types: movie, tv, season, episode', now());
```

---

## Summary

- **Database**  supports: movie, tv, season, episode
- **Users can rent**: movie, season, episode (NOT full tv)
- **Admin workflow**: Movie → OR → TV Show → Seasons → Episodes
- **Payment**: Wallet or Paystack, both support discount codes
- **Normalization**: 'tv_show' (frontend) → 'tv' (database)
- **Rental durations**: Movie/Episode = 48h, Season = 336h (configurable)

