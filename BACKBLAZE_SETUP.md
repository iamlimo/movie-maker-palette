# Backblaze B2 Configuration Guide

## Overview
Your videos are stored in Backblaze B2, but the Supabase Edge Function needs credentials to generate signed URLs. This guide shows you how to configure Backblaze properly.

## Step 1: Get Your Backblaze Credentials

### 1.1 Log into Backblaze B2
1. Go to https://secure.backblaze.com/b2_buckets.htm
2. Sign in with your Backblaze account

### 1.2 Create Application Key (if you don't have one)
1. Click **App Keys** in the left sidebar
2. Click **Add a New Application Key**
3. Fill in:
   - **Name**: `movie-maker-palette` (or any descriptive name)
   - **Allow access to Bucket(s)**: Select your bucket (probably `signature-tv-movies`)
   - **Type of Access**: Read and Write (or Read Only if you prefer)
   - **File name prefix**: Leave empty (allows access to all files)
4. Click **Create New Key**
5. **IMPORTANT**: Save the **keyID** and **applicationKey** - you won't see the key again!

### 1.3 Get Your Bucket Information
1. Go to **Buckets** in the left sidebar
2. Find your bucket (e.g., `signature-tv-movies`)
3. Note the **Bucket Name** and **Bucket ID**

## Step 2: Configure Supabase Environment Variables

### 2.1 Access Supabase Dashboard
1. Go to https://app.supabase.com/
2. Select your project (`tsfwlereofjlxhjsarap`)

### 2.2 Add Environment Variables
1. Click **Settings** in the left sidebar
2. Click **Edge Functions**
3. Scroll down to **Environment Variables**
4. Click **Add Variable** for each of these:

```
BACKBLAZE_B2_APPLICATION_KEY_ID = your_key_id_here
BACKBLAZE_B2_APPLICATION_KEY = your_application_key_here
BACKBLAZE_B2_BUCKET_NAME = signature-tv-movies
BACKBLAZE_B2_BUCKET_ID = your_bucket_id_here
```

**Example:**
```
BACKBLAZE_B2_APPLICATION_KEY_ID = 004abcd123456789
BACKBLAZE_B2_APPLICATION_KEY = K004abcd12345678901234567890123456
BACKBLAZE_B2_BUCKET_NAME = signature-tv-movies
BACKBLAZE_B2_BUCKET_ID = abcdef1234567890
```

### 2.3 Deploy Function (Important!)
After adding environment variables, you **must redeploy** the Edge Function:
1. Go to **Edge Functions** → `get-video-url`
2. Click **Deploy** (even if code hasn't changed)
3. This makes the new environment variables available to the function

## Step 3: Test the Configuration

### 3.1 Check Function Logs
After deployment, test by trying to watch a video. Check the function logs:
- Go to **Edge Functions** → `get-video-url` → **Logs**
- Look for: `"Video URL generated successfully (Backblaze)"`

### 3.2 Verify in Browser
1. Try watching a rented movie
2. Open browser DevTools (F12) → Console
3. Look for logs showing successful Backblaze URL generation

## Troubleshooting

### Issue: "Backblaze authorization failed"
- Check your Application Key ID and Key are correct
- Verify the key has read access to the bucket

### Issue: "Invalid video file path format"
- Your Backblaze URLs might have a different format
- Check the function logs for the `videoUrl` being processed
- The function expects URLs like: `https://f005.backblazeb2.com/file/bucket-name/path/to/file.mp4`

### Issue: Still getting 403 errors
- Make sure you redeployed the function after adding environment variables
- Check that the rental access fix was also deployed

## Security Notes

- **Never commit** Backblaze credentials to git
- **Application Keys** can be restricted to specific buckets
- **Rotate keys** periodically for security
- The function generates short-lived signed URLs (2 hours) for security

## Alternative: Keep Supabase Fallback

If you prefer not to configure Backblaze, the current fallback to Supabase storage will work, but you'll need to ensure your videos exist in both places or migrate them to Supabase storage.

## Questions?

If you run into issues:
1. Check the Edge Function logs for detailed error messages
2. Verify all 4 environment variables are set correctly
3. Make sure the function was redeployed after adding variables