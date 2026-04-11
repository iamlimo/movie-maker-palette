# Rental Access Issue Debugging

## Problem
Users are getting a 403 "Access denied" error when trying to watch rented movies on the VideoPlayer.

## Root Cause Analysis
The `get-video-url` function checks for active rentals but might not be finding them due to:
1. **Column name mismatch**: Old code looked for both `expires_at` and `expiration_date` columns
2. **Data type issues**: Content type mismatch between what's stored and what's queried
3. **Expired rentals**: The rental's `expires_at` is in the past
4. **Missing rental records**: Rentals weren't created properly during payment

## Diagnostic Steps

### Step 1: Check Rental Table Schema
Run this in Supabase SQL Editor:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'rentals'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (uuid)
- `user_id` (uuid)
- `content_id` (uuid)
- `content_type` (text) - Should be 'movie' or 'tv'
- `amount` (numeric)
- `status` (text) - Should be 'active' or 'expired'
- `expires_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)

### Step 2: Check Active Rentals for a User
Replace `YOUR_USER_ID` with the user's UUID:
```sql
SELECT 
  r.*,
  m.title,
  m.status as movie_status
FROM rentals r
LEFT JOIN movies m ON r.content_id = m.id
WHERE r.user_id = 'YOUR_USER_ID'
  AND r.content_type = 'movie'
  AND r.status = 'active'
ORDER BY r.expires_at DESC;
```

**What to check:**
- Are there rental records?
- Is `expires_at` in the future?
- Is `status` actually 'active'?
- Is `content_type` exactly 'movie'?

### Step 3: Check Movie Status
```sql
SELECT id, title, status, price, rental_expiry_duration
FROM movies
WHERE id = 'MOVIE_ID'
LIMIT 1;
```

**Expected:**
- `status` should be 'approved'

### Step 4: Review Recent Payments
```sql
SELECT 
  p.id,
  p.user_id,
  p.amount,
  p.status,
  p.enhanced_status,
  p.metadata->>'content_id' as content_id,
  p.metadata->>'content_type' as content_type,
  p.created_at
FROM payments p
WHERE p.user_id = 'YOUR_USER_ID'
  AND p.purpose = 'rental'
  AND p.enhanced_status = 'completed'
ORDER BY p.created_at DESC
LIMIT 10;
```

## Solution

### Issue 1: Old Column Name in Function
The `get-video-url` function has been updated to use only the `expires_at` column.

**File**: `supabase/functions/get-video-url/index.ts`

Changed from:
```typescript
.or(`expires_at.gte.${new Date().toISOString()},expiration_date.gte.${new Date().toISOString()}`)
.single()
```

To:
```typescript
.gte('expires_at', new Date().toISOString())
.maybeSingle()
```

### Issue 2: Improve Error Messages
Added debug information to error responses so users/admins can see:
- Whether the movie exists and its status
- Whether user has a purchase
- Whether user has a valid rental

### Deployment Instructions

#### Option A: Deploy via CLI (requires auth)
```bash
cd c:\Users\ASUS\Documents\new_projects\movie-maker-palette
npx supabase functions deploy get-video-url --project-ref tsfwlereofjlxhjsarap
```

#### Option B: Deploy via Supabase Dashboard
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select project `flatmate`
3. Go to **Edge Functions**
4. Select `get-video-url` function
5. Copy the content from `supabase/functions/get-video-url/index.ts`
6. Paste into the editor
7. Click **Deploy**

## Testing the Fix

After deployment, test with:
```javascript
// In browser console
const { data, error } = await supabase.functions.invoke('get-video-url', {
  body: {
    movieId: 'MOVIE_ID',
    expiryHours: 24
  }
});

console.log(data);
console.log(error);
```

**Expected response:**
```json
{
  "success": true,
  "signedUrl": "...",
  "expiresAt": "...",
  "message": "...",
  "source": "backblaze" or "supabase-fallback"
}
```

**Error response should include debug info:**
```json
{
  "error": "...",
  "debug": {
    "movieId": "...",
    "hasPurchase": false,
    "hasRental": true,
    "movieStatus": "approved"
  }
}
```

## Additional Fixes Applied

1. **Enhanced Logging**: The function now logs detailed information about:
   - Movie lookup status
   - Purchase check results
   - Rental check results
   - User role verification

2. **Better Error Handling**: Changed from `.single()` to `.maybeSingle()` for queries that might return zero results

3. **Diagnostic Output**: Error responses now include `debug` field showing what was actually checked

## Browser Console Debugging

If users still have issues, check the browser console:
1. Open the browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for log messages starting with "Movie lookup:", "Rental check for user:"
4. These will show exactly what's happening in the function

## If Issue Persists

1. Verify rental was created: Run Step 2 diagnostic query
2. Check movie status: Run Step 3 diagnostic query
3. Look at the error response's `debug` field to see which check failed
4. Check function logs in Supabase Dashboard > Functions > Logs
