/**
 * Standardized Content Types and Architecture
 * 
 * This file defines the canonical content types and architecture for the movie/TV platform.
 * 
 * ARCHITECTURE:
 * - Movie: Standalone rentable item with single video
 * - TV Show: Collection of seasons (accessed via full-tv purchase only, not rentable directly)
 * - Season: Collection of episodes (rentable as a unit)
 * - Episode: Individual episode (rentable as a unit)
 * 
 * RENTAL RULES:
 * - Users can rent: SingleMovie | FullSeason | SingleEpisode
 * - Users CANNOT rent full TV show (only individual seasons or episodes)
 * - Premium users can buy full TV shows for unlimited access
 */

/**
 * Standardized content type for database values.
 * These are the ONLY values accepted by the database.
 */
export type ContentType = 'movie' | 'tv' | 'season' | 'episode';

/**
 * Frontend content type that may come from various sources.
 * This includes legacy values and API responses.
 */
export type FrontendContentType = 'movie' | 'tv_show' | 'tv' | 'season' | 'episode';

/**
 * Rental-specific content types.
 * Seasons and episodes can be rented; TV shows cannot.
 */
export type RentableContentType = 'movie' | 'season' | 'episode';

/**
 * Content type for purchases (permanent access).
 * TV shows can be purchased for unlimited access.
 */
export type PurchasableContentType = 'movie' | 'tv' | 'tv_show' | 'season' | 'episode';

/**
 * Normalize any frontend content type to standardized database value.
 * 
 * @param contentType - The content type from frontend/API
 * @returns Standardized content type value for database
 * 
 * @example
 * normalizeContentType('tv_show') // returns 'tv'
 * normalizeContentType('season') // returns 'season'
 */
export function normalizeContentType(contentType: FrontendContentType | string): ContentType {
  const lowerType = String(contentType).toLowerCase().trim();
  
  // Normalize tv_show to tv
  if (lowerType === 'tv_show') {
    return 'tv';
  }
  
  // Accept standard types
  if (lowerType === 'movie' || lowerType === 'tv' || lowerType === 'season' || lowerType === 'episode') {
    return lowerType as ContentType;
  }
  
  // Default fallback
  console.warn(`Unknown content type: ${contentType}, defaulting to 'tv'`);
  return 'tv';
}

/**
 * Validate that a content type is rentable.
 */
export function isRentableContentType(contentType: ContentType): contentType is RentableContentType {
  return contentType === 'movie' || contentType === 'season' || contentType === 'episode';
}

/**
 * Get default rental duration in hours for a content type.
 */
export function getDefaultRentalDuration(contentType: ContentType): number {
  switch (contentType) {
    case 'movie':
      return 48; // 48 hours
    case 'season':
      return 168; // 7 days
    case 'episode':
      return 48; // 48 hours
    case 'tv':
    default:
      return 168; // fallback
  }
}

/**
 * Get human-readable name for content type.
 */
export function getContentTypeName(contentType: ContentType): string {
  switch (contentType) {
    case 'movie':
      return 'Movie';
    case 'tv':
      return 'TV Show';
    case 'season':
      return 'Season';
    case 'episode':
      return 'Episode';
  }
}

/**
 * Content pricing structure.
 * Allows specifying different prices for rentals vs purchases.
 */
export interface ContentPricing {
  content_id: string;
  content_type: ContentType;
  rental_price?: number; // For rentals
  purchase_price?: number; // For permanent purchase
  rental_expiry_duration_hours?: number; // Rental duration in hours
}

/**
 * Rental record in database.
 * Represents a temporary access grant to content.
 */
export interface RentalRecord {
  id: string;
  user_id: string;
  content_id: string;
  content_type: RentableContentType;
  amount: number;
  status: 'active' | 'expired';
  expires_at: string; // ISO 8601
  created_at: string; // ISO 8601
}

/**
 * Content access check result.
 */
export interface ContentAccessCheck {
  hasAccess: boolean;
  accessType?: 'rental' | 'purchase' | 'free';
  expiresAt?: string; // ISO 8601, only for rentals
  content_id: string;
  content_type: ContentType;
}

/**
 * Admin content creation request.
 */
export interface CreateContentRequest {
  content_type: ContentType;
  title: string;
  description?: string;
  price: number;
  rental_expiry_duration_hours?: number;
  genre_id?: string;
  
  // TV show specific
  tv_show_id?: string; // For seasons
  season_number?: number; // For seasons
  
  // Episode specific
  season_id?: string; // For episodes
  episode_number?: number; // For episodes
  duration_minutes?: number; // For episodes
  
  // Media
  thumbnail_url?: string;
  video_url?: string;
}

/**
 * Rental initiation request.
 */
export interface InitiateRentalRequest {
  content_id: string;
  content_type: ContentType;
  price: number;
  payment_method: 'wallet' | 'card';
  referral_code?: string;
  use_wallet?: boolean;
}

/**
 * Content query filter.
 */
export interface ContentFilter {
  types?: ContentType[];
  genres?: string[];
  status?: 'active' | 'inactive';
  search?: string;
}

/**
 * Standardized error for content type issues.
 */
export class ContentTypeError extends Error {
  constructor(message: string, public contentType?: ContentType) {
    super(message);
    this.name = 'ContentTypeError';
  }
}

/**
 * Standardized error for rental validation.
 */
export class RentalValidationError extends Error {
  constructor(message: string, public reason?: string) {
    super(message);
    this.name = 'RentalValidationError';
  }
}

/**
 * PHASE 2: Unified content resolver
 * 
 * Resolves ANY content type to a normalized structure.
 * This is the SINGLE TRUTH SOURCE for content fetching in the rental system.
 * 
 * @param contentType - Normalized content type
 * @param contentId - ID of the content
 * @param supabase - Supabase client
 * @returns Resolved content with pricing and rental duration
 */
export async function resolveContent(
  contentType: ContentType,
  contentId: string,
  supabase: any
): Promise<{
  id: string;
  type: ContentType;
  title: string;
  price: number;
  rental_expiry_duration: number; // in hours
  currency: string;
  video_url?: string;
}> {
  console.log(`[resolveContent] Resolving ${contentType}/${contentId}`);
  
  try {
    if (contentType === 'movie') {
      const { data, error } = await supabase
        .from('movies')
        .select('id, title, price, rental_expiry_duration, video_url')
        .eq('id', contentId)
        .maybeSingle();

      if (error || !data) throw new Error(`Movie not found: ${contentId}`);
      
      return {
        id: data.id,
        type: 'movie',
        title: data.title,
        price: data.price || 0,
        rental_expiry_duration: data.rental_expiry_duration || 48,
        currency: 'NGN',
        video_url: data.video_url,
      };
    }

    if (contentType === 'season') {
      const { data, error } = await supabase
        .from('seasons')
        .select(`id, season_number, rental_expiry_duration, price, tv_shows(id, title)`)
        .eq('id', contentId)
        .maybeSingle();

      if (error || !data) throw new Error(`Season not found: ${contentId}`);
      
      const tvShow = (data as any).tv_shows;
      const seasonTitle = tvShow?.title ? `${tvShow.title} - Season ${data.season_number}` : `Season ${data.season_number}`;
      
      return {
        id: data.id,
        type: 'season',
        title: seasonTitle,
        price: data.price || 0,
        rental_expiry_duration: data.rental_expiry_duration || 168,
        currency: 'NGN',
      };
    }

    if (contentType === 'episode') {
      const { data, error } = await supabase
        .from('episodes')
        .select(`id, episode_number, rental_expiry_duration, price, video_url, seasons(season_number, tv_shows(id, title))`)
        .eq('id', contentId)
        .maybeSingle();

      if (error || !data) throw new Error(`Episode not found: ${contentId}`);
      
      const season = (data as any).seasons;
      const tvShow = season?.tv_shows;
      const episodeTitle = tvShow?.title 
        ? `${tvShow.title} - S${season.season_number}E${data.episode_number}`
        : `Episode ${data.episode_number}`;
      
      return {
        id: data.id,
        type: 'episode',
        title: episodeTitle,
        price: data.price || 0,
        rental_expiry_duration: data.rental_expiry_duration || 48,
        currency: 'NGN',
        video_url: data.video_url,
      };
    }

    throw new ContentTypeError(`Unsupported content type for resolution: ${contentType}`, contentType);
  } catch (error) {
    console.error(`[resolveContent] Error:`, error);
    throw new ContentTypeError(
      `Failed to resolve ${contentType}/${contentId}: ${error instanceof Error ? error.message : String(error)}`,
      contentType
    );
  }
}
