# Summary: Rented Video 403 Error - Root Cause & Fix

## The Problem
Users cannot watch rented movies - they get a **403 Forbidden** error:
```
POST https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/get-video-url 403 (Forbidden)
Error: Access denied. Purchase or rent this movie to watch.
```

This happens even after successfully renting a movie.

## Root Cause
The `get-video-url` Supabase Edge Function has a **critical bug**:

### What Happened
1. **Migration 20250915143338** (Sept 15, 2025) recreated the rentals table
   - New schema uses ONLY `expires_at` column
   - Old `expiration_date` column was removed

2. **get-video-url function** wasn't updated
   - Still checking for BOTH `expires_at` AND `expiration_date` columns
   - When querying: `.or('expires_at.gte...,expiration_date.gte...')`
   - This fails because `expiration_date` doesn't exist

3. **Result**
   - The rental query fails silently
   - Function never finds the user's valid rental
   - Always returns 403 "Access denied"

### Code Evidence
**Old (broken) code:**
```typescript
const { data: rental } = await supabase
  .from('rentals')
  .select('id, expires_at, expiration_date')
  .eq('user_id', user.id)
  .eq('content_id', movieId)
  .eq('content_type', 'movie')
  .eq('status', 'active')
  .or(
    `expires_at.gte.${new Date().toISOString()},expiration_date.gte.${new Date().toISOString()}`
  )
  .single();  // Also problematic - fails if no rows
```

**Current rentals table schema:**
```sql
CREATE TABLE public.rentals (
  id UUID,
  user_id UUID,
  content_id UUID,
  content_type TEXT,  -- 'movie' or 'tv'
  amount NUMERIC,
  status TEXT,        -- 'active' or 'expired'
  expires_at TIMESTAMP WITH TIME ZONE,  -- ← ONLY THIS
  created_at TIMESTAMP WITH TIME ZONE
  -- Note: NO expiration_date column!
);
```

## The Solution
Updated the `get-video-url/index.ts` function:

### 1. Fixed Column Reference
```typescript
// Use ONLY expires_at (the actual column that exists)
.gte('expires_at', new Date().toISOString())
```

### 2. Safer Query Pattern
```typescript
// Changed from .single() to .maybeSingle()
// .single() fails if no rows returned
// .maybeSingle() returns null gracefully
.maybeSingle()
```

### 3. Complete Fix
```typescript
const { data: rental, error: rentalError } = await supabase
  .from('rentals')
  .select('id, expires_at, user_id, content_id, content_type, status')
  .eq('user_id', user.id)
  .eq('content_id', movieId)
  .eq('content_type', 'movie')
  .eq('status', 'active')
  .gte('expires_at', new Date().toISOString())
  .maybeSingle();  // ← Safe null handling

if (!purchase && !rental) {
  // Return with debug info
  return new Response(
    JSON.stringify({
      error: 'Access denied. Purchase or rent this movie to watch.',
      debug: {
        movieId,
        hasPurchase: !!purchase,
        hasRental: !!rental,
        movieStatus: movie?.status
      }
    }),
    { status: 403, headers: corsHeaders }
  );
}
```

### 4. Additional Improvements
- Applied same fixes to purchase query
- Applied same fixes to role query
- Added detailed logging for debugging
- Enhanced error responses with diagnostic information

## What Was Actually Changed
**File**: `supabase/functions/get-video-url/index.ts`

Key edits:
1. Line ~112: `user_roles` query - added error handling, changed to `.maybeSingle()`
2. Line ~131: `purchases` query - changed to `.maybeSingle()`
3. Line ~141-149: `rentals` query - **CRITICAL FIX**
   - Removed `'expiration_date'` from select
   - Removed `.or()` with expiration_date
   - Changed to simple `.gte('expires_at', ...)`
   - Changed to `.maybeSingle()`
4. Added comprehensive logging throughout
5. Enhanced error responses with `debug` field

## Status

### ✅ Code Changes: COMPLETE
- [x] Identified root cause
- [x] Updated function code
- [x] Added comprehensive logging
- [x] Committed to git

### ⏳ Deployment: PENDING
- [ ] Deploy to Supabase
  - Preferred: Via Supabase Dashboard (easiest)
  - Alternative: Via CLI if authentication works
  - Only step remaining!

## Next Steps

### For Developers/DevOps:
1. Deploy `supabase/functions/get-video-url/index.ts` to Supabase
   - See `DEPLOY_FIX.md` for detailed instructions
   - Dashboard deployment is easiest option

2. Test the fix:
   - Try renting a movie
   - Watch the rented movie
   - Should load without errors

### For Users Experiencing the Issue:
1. After deployment, clear browser cache
2. Try renting and watching a movie again
3. If still issues, check browser console (F12) for debug info

## Verification

After deployment, to verify the fix is working:

```javascript
// In browser console
const { data } = await supabase.functions.invoke('get-video-url', {
  body: { movieId: 'MOVIE_ID', expiryHours: 24 }
});

// Should see:
// {
//   "success": true,
//   "signedUrl": "...",
//   "expiresAt": "...",
//   "message": "Video URL generated successfully",
//   "source": "backblaze"
// }
```

## Timeline

- **Sept 15, 2025**: Migration `20250915143338` removes `expiration_date` column
- **Apr 9, 2026**: User reports 403 error when watching rented movies
- **Apr 9, 2026**: Root cause identified - function references non-existent column
- **Apr 9, 2026**: Fix implemented and committed to git
- **Pending**: Function deployment to Supabase

## Prevention

To prevent similar issues:
1. Test edge functions after database schema changes
2. Add integration tests for rental validation
3. Monitor function logs for silent failures
4. Document schema changes in code comments
