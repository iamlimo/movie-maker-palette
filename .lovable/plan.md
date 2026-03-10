

# Subtitle Feature Implementation

## Overview
Add subtitle (VTT/SRT) upload support for movies and episodes, with a toggle in all video players for users to enable/disable subtitles during playback.

---

## Database Changes

Add `subtitle_url` column to both `movies` and `episodes` tables:

```sql
ALTER TABLE public.movies ADD COLUMN subtitle_url text;
ALTER TABLE public.episodes ADD COLUMN subtitle_url text;
```

Create a `subtitles` storage bucket for VTT/SRT files:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('subtitles', 'subtitles', true);

CREATE POLICY "Anyone can view subtitles" ON storage.objects FOR SELECT USING (bucket_id = 'subtitles');
CREATE POLICY "Super admins can manage subtitles" ON storage.objects FOR ALL USING (bucket_id = 'subtitles' AND has_role(auth.uid(), 'super_admin'));
```

---

## Files to Modify

### Admin Upload Pages (add subtitle file input)

| File | Change |
|------|--------|
| `src/pages/admin/AddMovie.tsx` | Add subtitle file upload field |
| `src/pages/admin/EditMovie.tsx` | Add subtitle file upload + show existing |
| `src/pages/admin/EditEpisode.tsx` | Add subtitle file upload + show existing |
| `src/pages/admin/AddEpisode.tsx` | Add subtitle file upload field |

Each gets a simple file input that accepts `.vtt,.srt` files. On upload, the file is stored to the `subtitles` bucket with path `{contentType}/{contentId}.vtt`. The public URL is saved to `subtitle_url`.

### Video Players (add `<track>` element)

| File | Change |
|------|--------|
| `src/components/SecureVideoPlayer.tsx` | Accept `subtitleUrl` prop, render `<track>` |
| `src/components/NativeVideoPlayer.tsx` | Accept `subtitleUrl` prop, render `<track>` |
| `src/components/EpisodePlayer.tsx` | Accept `subtitleUrl` prop, pass to `<video>` |
| `src/components/VideoPlayer.tsx` | Accept `subtitleUrl` prop, render `<track>` |
| `src/components/PaymentGatedVideoPlayer.tsx` | Accept `subtitleUrl`, pass through |
| `src/components/OfflineVideoPlayer.tsx` | Accept `subtitleUrl`, pass through |

The `<track>` element is added inside `<video>`:
```html
<video ...>
  <source src="..." />
  {subtitleUrl && (
    <track kind="subtitles" src={subtitleUrl} srclang="en" label="English" default />
  )}
</video>
```

### Preview Pages (pass subtitle URL to players)

| File | Change |
|------|--------|
| `src/pages/MoviePreview.tsx` | Fetch `subtitle_url`, pass to player |
| `src/pages/TVShowPreview.tsx` | Fetch `subtitle_url` from episodes, pass to player |

---

## Implementation Flow

1. **Migration** -- Add `subtitle_url` columns + storage bucket
2. **Admin pages** -- Add file upload inputs for subtitle files, upload to `subtitles` bucket, save URL to DB
3. **Video players** -- Add optional `subtitleUrl` prop and render `<track>` element
4. **Preview pages** -- Include `subtitle_url` in queries and pass to players

Users will see a standard browser CC button on the video controls to toggle subtitles on/off.

