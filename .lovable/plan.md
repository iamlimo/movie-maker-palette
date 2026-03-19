

# Readable URLs for Movies & TV Shows

## Approach

Add a `slug` column to both `movies` and `tv_shows` tables. Generate slugs from titles (e.g., "The Last Dance" → `the-last-dance`). Routes change from `/movie/:id` to `/movie/:slug` and `/tvshow/:id` to `/tvshow/:slug`. The preview pages will query by slug instead of UUID. A migration will backfill slugs for all existing content.

## Database Changes

**Migration:**
- Add `slug text UNIQUE` column to `movies` and `tv_shows`
- Backfill existing rows: `slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))` with deduplication via appending a short ID suffix for collisions
- Add unique index on slug for fast lookups

## Files to Modify

### Route definition
- **`src/App.tsx`** — Change `/movie/:id` to `/movie/:slug` and `/tvshow/:id` to `/tvshow/:slug`

### Preview pages (query by slug instead of id)
- **`src/pages/MoviePreview.tsx`** — Use `useParams<{ slug }>`, query `.eq("slug", slug)` instead of `.eq("id", movieId)`
- **`src/pages/TVShowPreview.tsx`** — Same slug-based query

### All navigation links (pass slug instead of id)
- **`src/components/EnhancedContentCard.tsx`** — Navigate to `/movie/${slug}` or `/tvshow/${slug}`
- **`src/components/MovieCard.tsx`** — Same
- **`src/components/SearchModal.tsx`** — Same
- **`src/components/CinematicHeroSlider.tsx`** — Same
- **`src/components/MyLibrary.tsx`** — Same
- **`src/components/ContinueWatchingSection.tsx`** — Same
- **`src/pages/admin/ViewTVShow.tsx`** — Same

### Admin content creation
- **`src/pages/admin/AddMovie.tsx`** / **`AddMovieNew.tsx`** — Auto-generate slug from title on save
- **`src/pages/admin/AddTVShow.tsx`** — Same
- **`src/hooks/useContentManager.tsx`** — Include slug generation in content creation/update logic

### Deep linking
- **`src/lib/navigationUtils.ts`** — Update `parseDeepLink` for slug-based routes

### Supabase types
- Types file will auto-update after migration

## Slug Generation Logic

```typescript
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

The database migration handles backfill with collision resolution by appending a 4-char ID suffix when duplicates exist.

