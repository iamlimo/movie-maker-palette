# Backblaze B2 Video Storage Integration

## Overview

This document explains how the Signature TV platform has been upgraded to use Backblaze B2 for video storage, replacing direct Supabase storage uploads for large video files.

## Why Backblaze B2?

- **Cost-effective**: Significantly lower storage costs for large video files
- **Better performance**: Optimized for large file storage and streaming
- **Scalability**: Handles millions of video files without performance degradation
- **Bandwidth**: Lower bandwidth costs compared to traditional storage

## Important: Videos AND Trailers Use Backblaze B2

**Both main video content AND trailers should be uploaded to Backblaze B2.** This applies to:
- Movie videos and movie trailers
- TV show episode videos and episode trailers

The same upload process and URL format applies to both content types.

## How It Works

### Admin Workflow

1. **Manual Upload to Backblaze**:
   - Super admins manually upload movie/episode videos AND trailers to their Backblaze B2 bucket
   - Videos should be organized in folders (e.g., `movies/`, `movies/trailers/`, `episodes/`, `episodes/trailers/`)
   - Recommended folder structure:
     ```
     my-bucket/
       movies/
         movie-name.mp4
         trailers/
           movie-name-trailer.mp4
       tv-shows/
         show-name/
           season-1/
             episode-1.mp4
             trailers/
               episode-1-trailer.mp4
     ```

2. **Creating Content**:
   - In the admin dashboard (Add Movie or Add Episode), paste the Backblaze file URL or path for both video and trailer
   - Example formats:
     - Full URL: `https://f002.backblazeb2.com/file/my-bucket/movies/movie-name.mp4`
     - File path: `movies/movie-name.mp4` (recommended)
     - Trailer path: `movies/trailers/movie-name-trailer.mp4`
   - Click "Test Video" to preview the video before publishing
   - Upload other media (thumbnails, posters) normally through Supabase

3. **Publishing**:
   - Once the video and trailer are validated, submit the form
   - The video paths are stored in the database (not the public URLs)

### User Workflow

1. **Browsing**:
   - Users browse movies/episodes normally
   - Only thumbnails and posters are displayed

2. **Renting/Purchasing**:
   - Users rent or purchase content
   - Payment is processed through Paystack

3. **Watching**:
   - After successful payment, users click "Play"
   - A secure, time-limited signed URL is generated from Backblaze B2
   - The signed URL expires after 2 hours for security (1 hour for trailers)
   - URL is automatically refreshed during long viewing sessions

### Security Features

1. **Signed URLs**: 
   - All video URLs are temporary and expire after 2 hours (1 hour for trailers)
   - Users cannot share video URLs (they expire quickly)

2. **Access Control**:
   - Main videos are only accessible to users with active rentals/purchases
   - Trailers are publicly accessible (no payment required)
   - Super admins can view all content

3. **Download Protection**:
   - Video player disables right-click and download options
   - Context menu is blocked
   - Watermark overlay indicates protected content

4. **Automatic Refresh**:
   - URLs are refreshed 5 minutes before expiry during playback
   - Seamless experience for users watching long content

## Technical Architecture

### Components Created

1. **Edge Functions**:
   - `generate-b2-signed-url`: Generates time-limited Backblaze signed URLs (for main videos, requires payment)
   - `generate-trailer-url`: Generates time-limited Backblaze signed URLs (for trailers, no payment required)
   - `get-video-url`: Updated to support both Backblaze and legacy Supabase storage

2. **React Components**:
   - `BackblazeUrlInput`: Admin form component for pasting Backblaze URLs
   - `SecureVideoPreview`: Admin preview player for testing videos
   - `SecureVideoPlayer`: Protected video player for users

3. **Utilities**:
   - `backblazeValidation.ts`: URL validation and sanitization functions

### Database Schema

No changes to database schema were needed. The existing `video_url` and `trailer_url` columns in `movies` and `episodes` tables now store:
- Backblaze file paths (e.g., `videos/movie.mp4`, `trailers/movie-trailer.mp4`)
- OR legacy Supabase storage paths (for backward compatibility)

### Environment Variables Required

Ensure these secrets are configured in Supabase:
- `BACKBLAZE_B2_APPLICATION_KEY_ID`
- `BACKBLAZE_B2_APPLICATION_KEY`
- `BACKBLAZE_B2_BUCKET_NAME`

## Migration Guide

### For Existing Content

Existing movies/episodes with videos and trailers in Supabase storage will continue to work. No migration is required unless you want to move them to Backblaze.

### Moving Videos to Backblaze

1. Download videos and trailers from Supabase storage
2. Upload to Backblaze B2 bucket (in organized folders)
3. Update the `video_url` and `trailer_url` fields in the database with the new Backblaze paths
4. Test playback to ensure it works

## Admin Instructions

### Uploading Videos to Backblaze

1. **Get Backblaze Credentials**:
   - Log into Backblaze B2 account
   - Create an application key if you don't have one
   - Note your bucket name

2. **Upload Video**:
   - Use Backblaze web interface, CLI, or any S3-compatible tool
   - Upload videos AND trailers to a logical folder structure:
     ```
     my-bucket/
       movies/
         movie-name.mp4
         trailers/
           movie-name-trailer.mp4
       tv-shows/
         show-name/
           season-1/
             episode-1.mp4
             trailers/
               episode-1-trailer.mp4
     ```

3. **Copy File Paths**:
   - After upload, copy the file paths (not the public URLs)
   - Example video: `movies/movie-name.mp4`
   - Example trailer: `movies/trailers/movie-name-trailer.mp4`

4. **Create Content in Dashboard**:
   - Navigate to Admin → Movies → Add Movie (or Add Episode)
   - Paste the Backblaze video file path in "Video URL" field
   - Paste the Backblaze trailer file path in "Trailer URL" field
   - Click "Test Video" to preview both video and trailer
   - Fill in other details (title, description, price, etc.)
   - Upload thumbnail and poster images through Supabase
   - Submit the form

### Troubleshooting

**Video preview doesn't work**:
- Check the file path is correct
- Ensure Backblaze credentials are configured
- Verify the video file exists in the bucket

**Video playback fails for users**:
- Check user has active rental/purchase
- Verify Backblaze credentials are valid
- Check edge function logs for errors

**Signed URL expires during playback**:
- The system automatically refreshes URLs 5 minutes before expiry
- If issues persist, check network connectivity

## API Reference

### Generate Signed URL

**Endpoint**: `supabase/functions/v1/generate-b2-signed-url`

**Method**: POST

**Request Body**:
```json
{
  "contentId": "uuid",
  "contentType": "movie" | "episode"
}
```

**Response**:
```json
{
  "signedUrl": "https://...",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

### Get Video URL (Movies)

**Endpoint**: `supabase/functions/v1/get-video-url`

**Method**: POST

**Request Body**:
```json
{
  "movieId": "uuid",
  "expiryHours": 24
}
```

**Response**:
```json
{
  "success": true,
  "signedUrl": "https://...",
  "expiresAt": "2024-01-01T12:00:00Z",
  "message": "Video URL generated successfully (Backblaze)"
}
```

## Future Enhancements

- Automatic transcoding integration
- CDN integration for faster delivery
- Multi-quality streaming (HLS/DASH)
- Analytics on viewing patterns
- Automatic video optimization
- Direct upload from admin panel to Backblaze

## Support

For issues or questions:
1. Check edge function logs in Supabase dashboard
2. Verify Backblaze credentials are correctly configured
3. Test video URLs using the admin preview feature
4. Contact technical support with error details
