import "../deno.d.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

interface ContinueWatchingItem {
  id: string;
  user_id: string;
  content_type: "movie" | "episode";
  content_id: string;
  progress: number;
  completed: boolean;
  last_watched_at: string;
  playback_position?: number;
  video_duration?: number;
  season_id?: string;
  title?: string;
  thumbnail_url?: string;
  duration?: number;
  price?: number;
  genre?: string;
  preview_slug?: string;
  rental_status: "active" | "expired" | "none";
  expires_at?: string;
  time_remaining?: {
    hours: number;
    minutes: number;
    formatted: string;
  };
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const { user, supabase } = await authenticateUser(req);

    // Get watch history with content details
    const { data: watchHistory, error: historyError } = await supabase
      .from("watch_history")
      .select(`
        id,
        user_id,
        content_type,
        content_id,
        progress,
        completed,
        last_watched_at,
        playback_position,
        video_duration,
        season_id
      `)
      .eq("user_id", user.id)
      .eq("completed", false)
      .gt("progress", 0)
      .order("last_watched_at", { ascending: false });

    if (historyError) {
      console.error("Error fetching watch history:", historyError);
      return errorResponse("Failed to fetch watch history", 500);
    }

    if (!watchHistory || watchHistory.length === 0) {
      return jsonResponse([]);
    }

    // Enrich with content details and rental status
    const enrichedItems: ContinueWatchingItem[] = [];

    for (const item of watchHistory) {
      let contentDetails: any = {};
      let rentalStatus: "active" | "expired" | "none" = "none";
      let expiresAt: string | undefined;
      let timeRemaining: any;

      try {
        // Get content details
        if (item.content_type === "movie") {
          const { data: movieData } = await supabase
            .from("movies")
            .select("title, thumbnail_url, duration, price, genre_id, genres(name)")
            .eq("id", item.content_id)
            .single();

          if (movieData) {
            contentDetails = {
              title: movieData.title,
              thumbnail_url: movieData.thumbnail_url,
              duration: movieData.duration,
              price: movieData.price,
              genre: movieData.genres?.name,
            };
          }
        } else if (item.content_type === "episode") {
          const { data: episodeData } = await supabase
            .from("episodes")
            .select(`
              title,
              duration,
              price,
              season_id,
              seasons!inner(
                id,
                tv_shows!inner(
                  title,
                  thumbnail_url,
                  genre_id,
                  genres(name)
                )
              )
            `)
            .eq("id", item.content_id)
            .single();

          if (episodeData) {
            contentDetails = {
              title: `${episodeData.seasons.tv_shows.title} - ${episodeData.title}`,
              thumbnail_url: episodeData.seasons.tv_shows.thumbnail_url,
              duration: episodeData.duration,
              price: episodeData.price,
              genre: episodeData.seasons.tv_shows.genres?.name,
              season_id: episodeData.season_id || episodeData.seasons.id,
            };
          }
        }

        // Check rental access
        const { data: accessData, error: accessError } = await supabase.rpc("has_active_rental_access", {
          p_user_id: user.id,
          p_content_id: item.content_id,
          p_content_type: item.content_type,
        });

        if (!accessError && accessData && accessData.length > 0) {
          const access = accessData[0];
          if (access.has_access) {
            rentalStatus = "active";
            expiresAt = access.expires_at;

            // Calculate time remaining
            if (expiresAt) {
              const now = new Date().getTime();
              const expiry = new Date(expiresAt).getTime();
              const remaining = expiry - now;

              if (remaining > 0) {
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

                let formatted = '';
                if (hours > 24) {
                  const days = Math.floor(hours / 24);
                  formatted = `${days}d ${hours % 24}h remaining`;
                } else if (hours > 0) {
                  formatted = `${hours}h ${minutes}m remaining`;
                } else {
                  formatted = `${minutes}m remaining`;
                }

                timeRemaining = { hours, minutes, formatted };
              } else {
                rentalStatus = "expired";
              }
            }
          } else {
            rentalStatus = "expired";
          }
        } else {
          rentalStatus = "none";
        }

        // Only include items with active rentals in continue watching
        // Expired items are excluded from this view
        if (rentalStatus === "active") {
          enrichedItems.push({
            ...item,
            ...contentDetails,
            rental_status: rentalStatus,
            expires_at: expiresAt,
            time_remaining: timeRemaining,
          });
        }

      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        // Still include the item but with minimal data
        enrichedItems.push({
          ...item,
          ...contentDetails,
          rental_status: "none",
        });
      }
    }

    return jsonResponse(enrichedItems);

  } catch (error: unknown) {
    console.error("Error in get-continue-watching:", error);
    return errorResponse("An unexpected error occurred", 500);
  }
});