# Admin Dashboard - Content Architecture Verification ✅

**Date:** April 13, 2026  
**Status:** ✅ Verified - Already Aligned with Standardized Architecture

---

## 📋 Summary

Your admin dashboard **already supports the standardized content architecture**! The implementation includes:

✅ Movie creation with independent pricing and rental duration  
✅ TV show creation with hierarchical structure (Seasons → Episodes)  
✅ Season creation with season numbers and independent pricing  
✅ Episode creation with episode numbers and independent pricing  
✅ Proper rental duration defaults for each content type  
✅ Admin workflow matching the standardized architecture  

---

## 🎬 Content Creation Workflow

### 1. Movies
**File:** `src/pages/admin/AddMovieNew.tsx`

**Flow:**
```
Admin Dashboard → Movies → "Add Movie" button
↓
Form with fields:
- Title (required)
- Description (required)
- Genre
- Release Date
- Duration (minutes)
- Language
- Rating (PG, 12A, 15, 18, etc.)
- Price (rental price in Naira)
- rental_expiry_duration (default: 48 hours)
- Video URL
- Thumbnail URL
- Trailer URL
↓
Submits to edge function: create-movie
↓
Creates record in `movies` table with content_type="movie"
```

**Defaults:**
- Rental Duration: 48 hours (configurable)
- Independent pricing per movie

---

### 2. TV Shows
**File:** `src/pages/admin/AddTVShow.tsx`  
**Component:** `src/components/admin/TVShowCreator.tsx`

**Flow:**
```
Admin Dashboard → TV Shows → "Add TV Show" button
↓
Form with fields:
- Title (required)
- Description (required)
- Release Date
- Age Rating
- Category/Genre (tags)
- Poster image
- Banner image
- Trailer URL
↓
Submits to edge function: create-tv-show
↓
Creates record in `tv_shows` table with content_type="tv"
```

**Important:** TV shows are NOT directly rentable (by design). Users must rent seasons or episodes.

---

### 3. Seasons
**File:** `src/pages/admin/AddSeason.tsx`

**Flow:**
```
Admin Dashboard → TV Shows → [TV Show Name] → "Add Season"
↓
Form with fields:
- TV Show ID (auto-filled)
- Season Number (auto-incremented)
- Description
- Price (rental price in Naira)
- rental_expiry_duration (default: 336 hours/14 days)
↓
Submits to edge function: create-season
↓
Creates record in `seasons` table with:
  tv_show_id = [parent show]
  season_number = [auto-determined]
  price = [independent pricing]
  rental_expiry_duration = [14 days default]
↓
Season is immediately rentable
```

**Key Features:**
- Season numbers auto-increment (1, 2, 3, ...)
- Pricing independent from parent TV show
- Rental duration independent from parent TV show
- Each season is a distinct rentable unit

---

### 4. Episodes
**File:** `src/pages/admin/AddEpisode.tsx`

**Flow:**
```
Admin Dashboard → TV Shows → [TV Show] → Seasons → [Season] → "Add Episode"
↓
Form with fields:
- Season ID (auto-filled)
- Episode Number (auto-incremented)
- Title (required)
- Description
- Duration (minutes)
- Price (rental price in Naira)
- rental_expiry_duration (default: 48 hours)
- Video file (required)
- Thumbnail file (required)
- Trailer file (optional)
- Release Date
↓
Submits to edge function: upload-episode
↓
Creates record in `episodes` table with:
  season_id = [parent season]
  episode_number = [auto-determined]
  title = [episode name]
  price = [independent pricing]
  rental_expiry_duration = [48 hours default]
  video_url = [uploaded to tv-episodes bucket]
↓
Episode is immediately rentable
```

**Key Features:**
- Episode numbers auto-increment per season (1, 2, 3, ...)
- Pricing independent from seasonand TV show
- Each episode is a distinct rentable unit
- Video and thumbnail uploaded to secure storage

---

## 🏗️ Content Structure on Admin Dashboard

### Movies Page
**File:** `src/pages/admin/Movies.tsx`

**Display:**
```
Movies Table:
┌─────────────────────────────────────────────────┐
│ Title │ Genre │ Price │ Duration │ Status │ Actions │
├─────────────────────────────────────────────────┤
│ Inception │ Sci-Fi │ ₦2,500 │ 148m │ Active │ Edit/Delete │
│ Dark Knight │ Action │ ₦3,000 │ 152m │ Active │ Edit/Delete │
└─────────────────────────────────────────────────┘
```

**Features:**
- Search by title
- Filter by status (Active/Inactive)
- Filter by genre
- Edit individual movies
- Delete movies
- View movie details

---

### TV Shows Page
**File:** `src/pages/admin/TVShows.tsx`

**Display (Hierarchical Expand/Collapse):**
```
TV Shows Table:
┌─ Breaking Bad (Dropped down) ─────────────────┐
│ Status: Active │ Price: ₦500 │ Actions        │
│                                                 │
│ └─ Season 1 (Expanded)                          │
│    Price: ₦3,000 | Duration: 336h              │
│    └─ Episode 1: Pilot                          │
│       Price: ₦800 | Duration: 48h              │
│    └─ Episode 2: Cat's in the Bag              │
│       Price: ₦800 | Duration: 48h              │
│    └─ [Add Episode Button]                     │
│    [Add Season Button]                         │
│                                                 │
├─ Game of Thrones (Collapsed) ───────────────────│
│ Status: Active │ Price: ₦600 │ Actions        │
└──────────────────────────────────────────────────┘
```

**Features:**
- Expand/collapse individual TV shows
- Expand/collapse individual seasons
- View all seasons and episodes in hierarchy
- Add seasons to any TV show
- Add episodes to any season
- Edit/delete seasons
- Edit/delete episodes
- Filter TV shows by status
- Search by title

---

## 🗄️ Database Structure

### Movies Table
```sql
CREATE TABLE movies (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre_id UUID,
  release_date DATE,
  duration INTEGER,           -- minutes
  language TEXT,
  rating TEXT,
  price NUMERIC NOT NULL,     -- rental price
  rental_expiry_duration INTEGER DEFAULT 48,  -- hours
  video_url TEXT,
  thumbnail_url TEXT,
  trailer_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP,
  ...
);
```

### TV Shows Table
```sql
CREATE TABLE tv_shows (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  genre_id UUID,
  release_date DATE,
  language TEXT,
  rating TEXT,
  price NUMERIC,              -- base price (may not be used for rental)
  thumbnail_url TEXT,
  trailer_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP,
  ...
);
```

### Seasons Table
```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY,
  tv_show_id UUID NOT NULL REFERENCES tv_shows(id),
  season_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  price NUMERIC NOT NULL,     -- season rental price
  rental_expiry_duration INTEGER DEFAULT 336,  -- hours (14 days)
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP,
  UNIQUE(tv_show_id, season_number),
  ...
);
```

### Episodes Table
```sql
CREATE TABLE episodes (
  id UUID PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES seasons(id),
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER,           -- minutes
  price NUMERIC NOT NULL,     -- episode rental price
  rental_expiry_duration INTEGER DEFAULT 48,  -- hours
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP,
  UNIQUE(season_id, episode_number),
  ...
);
```

---

## ✅ Verification Checklist

### Movie Creation
- [ ] Navigate to Admin → Movies → Add Movie
- [ ] Fill in all required fields (title, description, genre, etc.)
- [ ] Verify rental_expiry_duration defaults to 48 hours
- [ ] Submit form
- [ ] Verify movie appears in Movies table with price and duration
- [ ] Verify content_type='movie' in database
- [ ] Try editing an existing movie
- [ ] Change price and rental duration
- [ ] Save changes
- [ ] Verify updates reflected in database

### TV Show Creation
- [ ] Navigate to Admin → TV Shows → Add TV Show
- [ ] Fill in form (title, description, rating, etc.)
- [ ] Upload poster and banner images
- [ ] Submit form
- [ ] Verify TV show appears in TV Shows table
- [ ] Verify content_type='tv' in database
- [ ] Click on TV show to expand
- [ ] Verify no "Rent" button appears for full TV show in user interface

### Season Creation
- [ ] In TV Shows, find your test TV show
- [ ] Click "Add Season" button
- [ ] Verify season_number auto-increments (should be 1 for first season)
- [ ] Fill in title, description, price
- [ ] Verify rental_expiry_duration defaults to 336 hours
- [ ] Submit form
- [ ] Verify season appears under the TV show
- [ ] Check database: should have unique(tv_show_id, season_number)
- [ ] Add second season
- [ ] Verify season_number auto-increments to 2
- [ ] Verify each season has independent pricing

### Episode Creation
- [ ] In TV Shows, find a season
- [ ] Click "Add Episode" button
- [ ] Verify episode_number auto-increments (should be 1 for first episode)
- [ ] Fill in title, description, duration, price
- [ ] Verify rental_expiry_duration defaults to 48 hours
- [ ] Upload video file
- [ ] Upload thumbnail
- [ ] Submit form
- [ ] Verify episode appears under the season
- [ ] Check database: should have unique(season_id, episode_number)
- [ ] Add second episode
- [ ] Verify episode_number auto-increments to 2
- [ ] Verify each episode has independent pricing

### Pricing Independence Verification
- [ ] Create TV show with base price ₦500
- [ ] Create Season 1 with price ₦3,000
- [ ] Create 5 episodes in Season 1 each priced at ₦800
- [ ] Verify Season 1 rental costs ₦3,000 (NOT 5 × ₦800)
- [ ] Verify single Episode 1 rental costs ₦800
- [ ] Create Season 2 with different price ₦2,500
- [ ] Verify Season 1 and Season 2 have independent pricing

### Rental Duration Verification
- [ ] Create movie with default 48h duration
- [ ] Create season with default 336h duration
- [ ] Create episode with default 48h duration
- [ ] Edit movie duration to 72h
- [ ] Edit season duration to 240h
- [ ] Save changes
- [ ] Verify each content type maintains its own duration

### Hierarchy Verification
- [ ] Create TV show "Test Show"
- [ ] Create 3 seasons
- [ ] For Season 1, create 5 episodes
- [ ] For Season 2, create 3 episodes
- [ ] For Season 3, create 7 episodes
- [ ] In TVShows admin page, expand "Test Show"
- [ ] Verify all 3 seasons visible
- [ ] Expand Season 1
- [ ] Verify all 5 episodes visible with correct numbers (1-5)
- [ ] Collapse Season 1, expand Season 2
- [ ] Verify Season 2 episodes numbered 1-3 (not 6-8)
- [ ] Verify each season preserves its own episode numbering

---

## 🎯 Admin Workflow Summary

**For Creating Rentable Content:**

1. **Movie** (Direct rental)
   - Admin → Movies → Add Movie
   - Required: Title, Description, Genre, Price, Video URL
   - Default: 48h rental duration
   - Result: Users can immediately rent for 48 hours

2. **Season** (Rentable unit)
   - Admin → TV Shows → [Show Name] → Add Season
   - Required: Show ID, Season Number, Price
   - Default: 336h (14 days) rental duration  
   - Result: Users can immediately rent entire season for 14 days

3. **Episode** (Rentable unit)
   - Admin → TV Shows → [Show] → Seasons → [Season] → Add Episode
   - Required: Season ID, Episode Number, Title, Video URL, Price
   - Default: 48h rental duration
   - Result: Users can immediately rent single episode for 48 hours

**Structure:**
```
MOVIES (direct rentals) ———————— User rents movie for 48h

TV SHOWS (collection container - not rentable)
├─ SEASON 1 ———————— User rents season for 14 days
│   ├─ Episode 1 —— User rents episode for 48h
│   ├─ Episode 2 —— User rents episode for 48h
│   └─ Episode N —— User rents episode for 48h
├─ SEASON 2 ———————— User rents season for 14 days
│   └─ Episodes...
└─ SEASON N ———————— User rents season for 14 days
    └─ Episodes...
```

---

## 🔗 Connected Components

### Frontend Admin Components
- `src/pages/admin/Movies.tsx` - Movies management page
- `src/pages/admin/AddMovieNew.tsx` - Movie creation form
- `src/pages/admin/TVShows.tsx` - TV shows hierarchical browser
- `src/pages/admin/AddTVShow.tsx` - TV show creation entry point
- `src/components/admin/TVShowCreator.tsx` - TV show creation form
- `src/pages/admin/AddSeason.tsx` - Season creation form
- `src/pages/admin/AddEpisode.tsx` - Episode creation form

### Backend Edge Functions
- `supabase/functions/create-tv-show/` - Create TV show
- `supabase/functions/create-season/` - Create season
- `supabase/functions/upload-episode/` - Create episode and upload video

### User-Facing Components
- `src/components/RentalButton.tsx` - Initiates rental for any content type
- `src/components/RentalBottomSheet.tsx` - Payment sheet with discount codes
- `src/hooks/useRentals.ts` - Checks rental access for any content type
- `src/lib/contentTypes.ts` - Type normalization and validation

---

## 📊 Testing Scenarios

### Scenario 1: Complete Movie Rental
```
1. Admin creates "Inception" movie for ₦2,500 (48h default)
2. User navigates to movie page
3. User clicks "Rent" button
4. User selects wallet or card payment
5. User optionally applies discount code
6. Payment completes (wallet instant, card after webhook)
7. Rental record created in database
8. User sees 48-hour countdown timer
9. User can watch movie
10. After 48 hours, access expires
```

### Scenario 2: Full Season Rental
```
1. Admin creates "Breaking Bad" TV show
2. Admin adds Season 1 for ₦3,000 (336h/14d default)
3. Admin adds 13 episodes (₦800 each)
4. User navigates to Breaking Bad page
5. User sees Season 1 for ₦3,000 (NOT ₦10,400 = 13 × ₦800)
6. User clicks "Rent Season 1"
7. User pays ₦3,000 with discount code (e.g., -₦500 = ₦2,500)
8. Rental created with 14-day expiry
9. User can watch all 13 episodes
10. After 14 days, access to all 13 episodes expires
```

### Scenario 3: Individual Episode Rental
```
1. Breaking Bad Season 1 already created with episodes
2. User wants only Episode 1: "Pilot"
3. User unselects full season, selects Episode 1
4. Episode rental price ₦800 shown
5. User pays ₦800
6. Rental created with 48-hour expiry
7. User can watch only Episode 1
8. User cannot watch other episodes (no access)
9. Full season rental: User can rent episodes 2-13 separately
```

### Scenario 4: Mixed Rentals
```
1. User rents Movie "Inception" (48h) — expires tomorrow at 5pm
2. User rents Season 1 "Breaking Bad" (336h) — expires in 14 days
3. User rents Episode 2 "Cat's in the Bag" (48h) — expires tomorrow at 8pm
4. User sees 3 separate rental records with different timers
5. User can watch all 3 content types independently
6. After 48h: Movie and Episode 2 expire, Season 1 still accessible
7. After 336h from season rent: Season 1 expires
```

---

## 🎓 Key Architecture Benefits

1. **Fine-Grained Monetization**
   - Users can buy cheap access (₦800 episode) or expensive (₦3,000 season)
   - Encourages users to try premium content at lower price point

2. **Independent Pricing**
   - Season price ≠ sum of episode prices
   - Incentivizes users to rent full season (often cheaper than individual episodes)

3. **Flexible Rental Durations**
   - Movies: Quick 48h access
   - Seasons: Extended 14-day access for binge-watching
   - Episodes: Quick 48h access for catch-up viewing

4. **Admin Control**
   - Separate pricing strategies per content type
   - Ability to adjust pricing without cascading effects
   - Independent duration management

5. **User Choice**
   - Some users want full seasons
   - Others prefer individual episodes
   - Supports different user preferences and budgets

---

## ✅ Status: READY FOR TESTING 🎉

All admin components are in place and aligned with the standardized architecture. The system is ready to:

1. ✅ Create movies with independent pricing
2. ✅ Create TV shows with hierarchical seasons and episodes
3. ✅ Create seasons with independent pricing (14-day default)
4. ✅ Create episodes with independent pricing (48h default)
5. ✅ Support users renting any content type
6. ✅ Apply discount codes to all rental types
7. ✅ Manage rental access based on content type and user

**Next Step:** Test the entire workflow from movie/TV creation through user rental to verify everything works with the new content type standardization.

