/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const { user, supabase } = await authenticateUser(req);
    const url = new URL(req.url);
    let contentId = url.searchParams.get('content_id');
    let contentType = url.searchParams.get('content_type');

    if (!contentId || !contentType) {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        contentId = body.content_id || contentId;
        contentType = body.content_type || contentType;
      }
    }

    if (!contentId || !contentType) {
      return errorResponse("content_id and content_type are required", 400);
    }

    return await checkAccess(user, supabase, contentId, contentType);
  } catch (error: any) {
    console.error("Error in rental-access:", error);
    return errorResponse('An unexpected error occurred', 500);
  }
});

function normalizeContentType(contentType: string) {
  const lowerType = String(contentType).toLowerCase().trim();
  if (lowerType === 'tv_show' || lowerType === 'tv') return 'season';
  if (['movie', 'season', 'episode'].includes(lowerType)) {
    return lowerType;
  }
  return 'season';
}

async function findDirectRentalAccess(supabase: any, userId: string, contentId: string, contentType: string) {
  const now = new Date().toISOString();

  const buildQuery = (column: 'movie_id' | 'season_id' | 'episode_id', value: string) =>
    supabase
      .from('rental_access')
      .select('*')
      .eq('user_id', userId)
      .eq(column, value)
      .eq('revoked_at', null)
      .eq('status', 'paid')
      .gt('expires_at', now)
      .order('expires_at', { ascending: false });

  if (contentType === 'movie') {
    const { data, error } = await buildQuery('movie_id', contentId).maybeSingle();
    if (!error && data) return data;
  }

  if (contentType === 'season') {
    const { data, error } = await buildQuery('season_id', contentId).maybeSingle();
    if (!error && data) return data;
  }

  if (contentType === 'episode') {
    const { data: episodeAccess, error: episodeAccessError } = await buildQuery('episode_id', contentId).maybeSingle();
    if (!episodeAccessError && episodeAccess) return episodeAccess;

    const { data: episodeData } = await supabase
      .from('episodes')
      .select('season_id')
      .eq('id', contentId)
      .maybeSingle();

    if (episodeData?.season_id) {
      const { data: seasonAccess, error: seasonAccessError } = await buildQuery('season_id', episodeData.season_id).maybeSingle();
      if (!seasonAccessError && seasonAccess) return seasonAccess;
    }
  }

  return null;
}

async function checkAccess(user: any, supabase: any, contentId: string, contentType: string) {
  const normalizedType = normalizeContentType(contentType);

  const isSuperAdmin = await hasRole(supabase, user.id, 'super_admin');
  if (isSuperAdmin) {
    return jsonResponse({
      has_access: true,
      access_type: 'admin',
      expires_at: null,
    });
  }

    try {
    // Use optimized RPC function for access check
    // This handles episode->season access delegation automatically
    let accessResult: any = null;
    try {
      const { data, error } = await supabase.rpc('has_active_rental_access', {
        p_user_id: user.id,
        p_content_id: contentId,
        p_content_type: normalizedType,
      });

      if (error) {
        console.warn('RPC access check error, falling back to direct lookup:', error);
      } else {
        accessResult = Array.isArray(data) ? data[0] : data;
      }
    } catch (rpcError) {
      console.warn('RPC access check failed, falling back to direct lookup:', rpcError);
    }

    if (accessResult?.has_access) {
      return jsonResponse({
        has_access: true,
        access_type: accessResult.access_type || 'rental',
        expires_at: accessResult.expires_at,
        rental_access_id: accessResult.rental_access_id,
      });
    }

    const directAccess = await findDirectRentalAccess(supabase, user.id, contentId, normalizedType);
    if (directAccess) {
      return jsonResponse({
        has_access: true,
        access_type: directAccess.source === 'purchase' ? 'purchase' : 'rental',
        expires_at: directAccess.expires_at,
        rental_access_id: directAccess.id,
      });
    }

    // Fallback: check legacy rentals table for backward compatibility
    const now = new Date().toISOString();
    const { data: legacyRental } = await supabase
      .from('rentals')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('content_type', normalizedType)
      .eq('status', 'completed')
      .gte('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyRental) {
      return jsonResponse({
        has_access: true,
        access_type: 'rental',
        expires_at: legacyRental.expires_at,
      });
    }

    // Check purchases for permanent access
    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('content_type', normalizedType)
      .maybeSingle();

    if (purchase) {
      return jsonResponse({
        has_access: true,
        access_type: 'purchase',
        expires_at: null,
      });
    }

    // For episodes, check if season rental/purchase exists
    if (normalizedType === 'episode') {
      const { data: episodeData } = await supabase
        .from('episodes')
        .select('season_id, seasons(tv_show_id)')
        .eq('id', contentId)
        .maybeSingle();

      if (episodeData?.season_id) {
        const seasonId = episodeData.season_id;

        // Check season rental
        const { data: seasonRental } = await supabase
          .from('rentals')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_id', seasonId)
          .eq('content_type', 'season')
          .eq('status', 'completed')
          .gte('expires_at', now)
          .limit(1)
          .maybeSingle();

        if (seasonRental) {
          return jsonResponse({
            has_access: true,
            access_type: 'rental',
            expires_at: seasonRental.expires_at,
          });
        }

        // Check season purchase and show purchase
        const { data: seasonPurchase } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_id', seasonId)
          .eq('content_type', 'season')
          .maybeSingle();

        if (seasonPurchase) {
          return jsonResponse({
            has_access: true,
            access_type: 'purchase',
            expires_at: null,
          });
        }

        if (episodeData.seasons?.tv_show_id) {
          const { data: showPurchase } = await supabase
            .from('purchases')
            .select('*')
            .eq('user_id', user.id)
            .eq('content_id', episodeData.seasons.tv_show_id)
            .in('content_type', ['tv', 'tv_show'])
            .maybeSingle();

          if (showPurchase) {
            return jsonResponse({
              has_access: true,
              access_type: 'purchase',
              expires_at: null,
            });
          }
        }
      }
    }

    // For seasons, check if show purchase exists
    if (normalizedType === 'season') {
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('tv_show_id')
        .eq('id', contentId)
        .maybeSingle();

      if (seasonData?.tv_show_id) {
        const { data: showPurchase } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_id', seasonData.tv_show_id)
          .in('content_type', ['tv', 'tv_show'])
          .maybeSingle();

        if (showPurchase) {
          return jsonResponse({
            has_access: true,
            access_type: 'purchase',
            expires_at: null,
          });
        }
      }
    }

    return jsonResponse({
      has_access: false,
      access_type: null,
      expires_at: null,
    });
  } catch (error) {
    console.error('Error checking access:', error);
    return errorResponse('Unable to verify access', 500);
  }
}

async function hasRole(supabase: any, userId: string, role: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();

  return !!data && !error;
}
