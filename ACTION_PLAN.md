# ACTION PLAN: Fix Rented Video 403 Error

## Summary
✅ **Root cause identified**: The `get-video-url` function references a non-existent database column
✅ **Code fix completed**: Updated function code and committed to git
⏳ **Deployment blocked**: Supabase project is currently PAUSED

## Immediate Action Required

### Step 1: Unpause the Supabase Project
This is blocking all deployments.

1. Go to: https://app.supabase.com/dashboard
2. Select project: **flatmate** (or rdpyetpaqgujhvzcejky)
3. Look for a **Pause/Resume** button (usually in the top bar or settings)
4. Click **Resume** or **Unpause**
5. Wait 30-60 seconds for project to start back up
6. Verify it shows "Active" status

### Step 2: Deploy the Function Fix
Once project is active, deploy using one of these methods:

#### Option A: CLI Deployment (Fastest)
```powershell
cd c:\Users\ASUS\Documents\new_projects\movie-maker-palette
npx supabase functions deploy get-video-url --project-ref rdpyetpaqgujhvzcejky
```

#### Option B: Dashboard Deployment (Most Reliable)
1. In Supabase Dashboard, go to **Edge Functions**
2. Click on `get-video-url` function
3. Replace all code with content from: `supabase/functions/get-video-url/index.ts`
4. Click **Deploy** button
5. Wait for "Deployed" message

### Step 3: Test the Fix
After deployment, test in browser console (F12):
```javascript
// Should work now and return signed URL
supabase.functions.invoke('get-video-url', {
  body: { movieId: 'test-movie-id', expiryHours: 24 }
}).then(result => console.log(result.data))
```

## What's Already Done

✅ Identified the bug:
  - Rentals table migration removed `expiration_date` column
  - Function still referenced the old column
  - Query failed silently → always 403

✅ Fixed the code:
  - Updated function to use only `expires_at`
  - Changed from `.single()` to `.maybeSingle()` for safe null handling
  - Added detailed logging
  - Enhanced error messages with debug info

✅ Tested changes locally:
  - Code compiles without errors
  - Committed to git: `git commit -m "Fix: Correct rental access check..."`

## Files Modified
- `supabase/functions/get-video-url/index.ts` - Main fix
- `SOLUTION_SUMMARY.md` - Technical details
- `DEPLOY_FIX.md` - Deployment instructions
- `docs/RENTAL_DEBUGGING.md` - Debugging guide

## Timeline

**April 9, 2026 - CURRENT STATUS**
```
23:22 UTC: Found root cause - database schema mismatch
23:25 UTC: Fixed get-video-url function code
23:27 UTC: Discovered project is PAUSED
23:30 UTC: Prepared comprehensive deployment guide
```

**Next Actions:**
- [ ] Unpause Supabase project
- [ ] Deploy function fix
- [ ] Test with real user
- [ ] Verify users can watch rented movies

## Success Criteria

After deployment, users should be able to:
1. ✅ Rent a movie without errors
2. ✅ See video player load on watch page
3. ✅ Play the video without 403 errors
4. ✅ Stream video from Backblaze or fallback to Supabase

## Rollback Plan (if needed)

If deployment causes issues:
1. Revert in Supabase Dashboard
2. Copy from last known-good version
3. Run: `git revert HEAD` to undo commit

## Questions?

Check these for troubleshooting:
- `SOLUTION_SUMMARY.md` - What went wrong
- `DEPLOY_FIX.md` - How to deploy
- `docs/RENTAL_DEBUGGING.md` - Debugging queries
