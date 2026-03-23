

# Optimize Admin CRUD for Movies & TV Shows

## Issues Found

After thorough investigation, here are the bugs and gaps in the admin CRUD system:

### Critical Bugs

1. **EditMovie -- missing fields in update payload**: `status`, `video_url`, and `trailer_url` are NOT included in the update payload (`handleSubmit`). Changing status or video URLs on edit silently does nothing.

2. **TVShows admin -- episodes never load or render**: The `expandedSeasons` state and UI exist, but `fetchEpisodes` is never called when a season is expanded, and there's no episode row rendering. Expanding a season shows nothing.

3. **ViewMovie -- delete button is non-functional**: The "Delete" button in `ViewMovie.tsx` has no `onClick` handler -- it's a dead button.

4. **AddSeason -- creates season as `pending`**: The insert omits `status`, so it defaults to `'pending'`. The RLS policy only shows seasons of approved TV shows, but seasons themselves need `status: 'approved'` to be usable in the content flow.

5. **EditMovie/EditTVShow -- slug not updated on title change**: When the title is edited, the slug column is not recalculated, leading to stale URLs.

### UX Issues

6. **TVShows admin -- uses browser `confirm()` for deletes**: Movies uses proper `AlertDialog` with soft/hard delete options. TV Shows uses raw `confirm()` with only hard delete.

7. **TVShows admin -- missing React key on fragment**: The `<>` wrapping each show + seasons lacks a key, causing React warnings.

---

## Files to Modify

### 1. `src/pages/admin/EditMovie.tsx`
- Add `status`, `video_url`, `trailer_url` to the update payload in `handleSubmit`
- Recalculate and include `slug` when title changes

### 2. `src/pages/admin/TVShows.tsx`
- Add `fetchEpisodes` call when a season is expanded
- Render episode rows under expanded seasons (episode number, title, status, price, actions)
- Replace `confirm()` with `AlertDialog` for TV show and season deletion (soft + hard delete options)
- Add proper `key` to React fragments

### 3. `src/pages/admin/ViewMovie.tsx`
- Wire up the Delete button with an `AlertDialog` offering soft/hard delete, matching Movies.tsx pattern

### 4. `src/pages/admin/AddSeason.tsx`
- Add `status: 'approved'` to the season insert payload so new seasons are immediately available

### 5. `src/pages/admin/EditTVShow.tsx`
- Recalculate and include `slug` when title changes in the update payload

### 6. `src/pages/admin/EditSeason.tsx`
- No changes needed (already handles status)

---

## Implementation Details

**Slug recalculation** uses existing `generateSlug()` from `src/lib/slugUtils.ts`.

**Episode rows in TVShows.tsx** will show: episode number, title, duration, status badge, price, and action buttons (edit, delete) -- matching the pattern already used in `ViewTVShow.tsx`.

**Delete dialogs** will follow the existing Movies.tsx pattern with soft delete (set status to `rejected`) and hard delete (permanent removal) options.

No new components, edge functions, or database changes required.

