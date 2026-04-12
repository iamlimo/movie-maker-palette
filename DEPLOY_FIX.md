# Deploy get-video-url Function Fix

The 403 "Access denied" error for rented movies has been fixed in the code. Now you need to deploy the updated function to Supabase.

## ⚠️ CRITICAL: Project is Paused

**The Supabase project is currently PAUSED.** This prevents deploying the fix.

### Unpause the Project First:
1. Go to https://app.supabase.com/dashboard/project/rdpyetpaqgujhvzcejky
2. Look for a "Pause" or "Resume" button
3. Click to resume/unpause the project
4. Wait a few moments for the project to resume
5. Then proceed with deployment below

---

## What Changed

The `get-video-url` function had a critical bug:
- **Old code**: Looked for both `expires_at` AND `expiration_date` columns in the rentals table
- **Reality**: The rentals table only has `expires_at` column (changed in migration 20250915143338)
- **Result**: Query failed silently, always returning 403

The fix:
- Changed to use only `expires_at` column
- Changed from `.single()` to `.maybeSingle()` for safer null handling
- Added detailed logging and error diagnostics

## Deployment Options

### Option 1: CLI Deployment (Recommended if you have access)

```bash
cd c:\Users\ASUS\Documents\new_projects\movie-maker-palette

# Make sure you're logged in to Supabase CLI
npx supabase login

# Deploy the function
npx supabase functions deploy get-video-url --project-ref tsfwlereofjlxhjsarap
```

### Option 2: Supabase Dashboard Deployment (Easiest)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com/
   - Sign in with your account

2. **Navigate to Functions**
   - Select project: `flatmate` (tsfwlereofjlxhjsarap)
   - Go to **Edge Functions** in the sidebar
   - Click on `get-video-url` function

3. **Update the Function**
   - Open the file: `supabase/functions/get-video-url/index.ts` from this project
   - Copy **ALL** the content
   - In the Supabase dashboard, clear the existing code and paste the new code
   - Click **Deploy** button

4. **Verify Deployment**
   - The function should show "Deployed" status
   - Check the **Logs** tab for any errors

### Option 3: API Deployment via Script

If you have a personal access token, you can use:

```bash
# Set your token
$env:SUPABASE_ACCESS_TOKEN = "YOUR_TOKEN_HERE"

# Deploy
npx supabase functions deploy get-video-url --project-ref tsfwlereofjlxhjsarap
```

To get a token:
1. Go to https://app.supabase.com/account/tokens
2. Create a new token with 'functions' scope
3. Copy the token value

## Testing After Deployment

### Test 1: Check Function Works
In your browser console (F12 > Console tab):

```javascript
const { data, error } = await supabase.functions.invoke('get-video-url', {
  body: {
    movieId: 'ACTUAL_MOVIE_ID',
    expiryHours: 24
  }
});

console.log('Response:', data);
console.log('Error:', error);
```

**Expected Success Response:**
```json
{
  "success": true,
  "signedUrl": "https://...",
  "expiresAt": "2026-04-10T...",
  "message": "Video URL generated successfully (Backblaze)",
  "source": "backblaze"
}
```

**If Still Getting 403, check the `debug` field:**
```json
{
  "error": "Access denied. Purchase or rent this movie to watch.",
  "debug": {
    "movieId": "...",
    "hasPurchase": false,
    "hasRental": false,  // <-- This tells you if rental exists
    "movieStatus": "approved"
  }
}
```

### Test 2: Verify Rental Exists

Run this query in Supabase SQL Editor:

```sql
-- Check if rental exists for your test user
SELECT 
  r.id,
  r.user_id,
  r.content_id,
  r.content_type,
  r.status,
  r.expires_at,
  r.created_at
FROM rentals r
WHERE r.content_id = 'MOVIE_ID'
  AND r.status = 'active'
  AND r.expires_at > now()
ORDER BY r.created_at DESC
LIMIT 5;
```

If no results, the rental wasn't created properly. Check:
1. Payment was processed successfully
2. Wallet had sufficient balance
3. Check `payments` table for the transaction

## Troubleshooting

### Issue: Still Getting 403 After Deployment

**Possible Cause 1: Rental doesn't exist**
- Check if user actually completed a rental purchase
- Verify payment was processed (`payments` table)

**Possible Cause 2: Rental is expired**
- Check `expires_at` date in `rentals` table
- Should be a future date

**Possible Cause 3: Wrong content_type**
- Rental created with `content_type = 'tv'` instead of `'movie'`
- Check `rentals` table for the specific user/movie combo

**Possible Cause 4: Movie not approved**
- Check `movies` table, `status` column should be `'approved'`

**Possible Cause 5: Old code still deployed**
- Check function logs in Supabase dashboard
- Look for log messages with "Rental check for user:"
- If you see "expiration_date" in logs, old code is still running

### Issue: Project is Paused

**Error: "project is paused"**
- Go to Supabase Dashboard: https://app.supabase.com/dashboard
- Find your project (flatmate / rdpyetpaqgujhvzcejky)
- Click the pause button or settings menu
- Select "Resume" or "Unpause"
- Wait for project to resume (may take 30-60 seconds)
- Try deployment again

### Issue: Function Deployment Failed

**Error: "Your account does not have privileges"**
- Log out and back in: `npx supabase logout` then `npx supabase login`
- Use personal access token instead
- Try dashboard deployment instead

**Error: "Command not found"**
- Make sure you're in the correct project directory
- Run: `npx supabase` to verify CLI is installed

**Error: "Docker is not running"**
- Docker is needed for some operations but NOT for deployment
- Ignore this warning and proceed
- The CLI will use API-based deployment instead

## Verify the Fix Works

After deployment, users should be able to:
1. Rent a movie successfully
2. See the video player load without errors
3. Play the rented video immediately

If users still see the error, check the logs in Supabase dashboard:
1. Go to **Edge Functions** > `get-video-url` > **Logs**
2. Look for recent invocations
3. Check the "Rental check for user:" log message to see what's happening

## Code Changes Summary

**File**: `supabase/functions/get-video-url/index.ts`

Key changes:
```typescript
// OLD - BROKEN:
.or(`expires_at.gte.${new Date().toISOString()},expiration_date.gte.${new Date().toISOString()}`)
.single()

// NEW - FIXED:
.gte('expires_at', new Date().toISOString())
.maybeSingle()
```

This ensures that:
- Only the existing `expires_at` column is queried
- No columns that don't exist are referenced
- The function doesn't crash when no results are found
- Error handling is more robust
