import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { jsonResponse, handleOptions, errorResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";

serve(async (req) => {
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
  if (lowerType === 'tv_show') return 'tv';
  if (['movie', 'tv', 'season', 'episode'].includes(lowerType)) {
    return lowerType;
  }
  return 'tv';
}

async function checkAccess(user: any, supabase: any, contentId: string, contentType: string) {
  const normalizedType = normalizeContentType(contentType);
  const now = new Date().toISOString();

  const isSuperAdmin = await hasRole(supabase, user.id, 'super_admin');
  if (isSuperAdmin) {
    return jsonResponse({
      has_access: true,
      access_type: 'purchase',
      rental: null,
      purchase: null,
      expires_at: null,
    });
  }

  const rentalQuery = supabase
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

  const purchaseQuery = supabase
    .from('purchases')
    .select('*')
    .eq('user_id', user.id)
    .eq('content_id', contentId)
    .eq('content_type', normalizedType)
    .maybeSingle();

  const [{ data: rental }, { data: purchase }] = await Promise.all([rentalQuery, purchaseQuery]);

  if (rental || purchase) {
    return jsonResponse({
      has_access: true,
      access_type: rental ? 'rental' : 'purchase',
      rental: rental || null,
      purchase: purchase || null,
      expires_at: rental?.expires_at || null,
    });
  }

  if (normalizedType === 'episode') {
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .select('id, season_id, seasons(tv_show_id)')
      .eq('id', contentId)
      .maybeSingle();

    if (episodeError) {
      console.error('Episode lookup failed:', episodeError);
      return errorResponse('Unable to verify episode access', 500);
    }

    if (!episodeData) {
      return errorResponse('Episode not found', 404);
    }

    const seasonId = episodeData.season_id;
    const tvShowId = episodeData.seasons?.tv_show_id;

    const seasonRentalQuery = seasonId
      ? supabase
          .from('rentals')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_id', seasonId)
          .eq('content_type', 'season')
          .eq('status', 'completed')
          .gte('expires_at', now)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const seasonPurchaseQuery = seasonId
      ? supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_id', seasonId)
          .eq('content_type', 'season')
          .maybeSingle()
      : Promise.resolve({ data: null });

    const showPurchaseQuery = tvShowId
      ? supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_id', tvShowId)
          .in('content_type', ['tv', 'tv_show'])
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [seasonRentalResult, seasonPurchaseResult, showPurchaseResult] = await Promise.all([
      seasonRentalQuery,
      seasonPurchaseQuery,
      showPurchaseQuery,
    ]);

    const seasonRental = seasonRentalResult?.data;
    const seasonPurchase = seasonPurchaseResult?.data;
    const showPurchase = showPurchaseResult?.data;

    if (seasonRental || seasonPurchase) {
      return jsonResponse({
        has_access: true,
        access_type: seasonRental ? 'rental' : 'purchase',
        rental: seasonRental || null,
        purchase: seasonPurchase || null,
        expires_at: seasonRental?.expires_at || null,
      });
    }

    if (showPurchase) {
      return jsonResponse({
        has_access: true,
        access_type: 'purchase',
        rental: null,
        purchase: showPurchase,
        expires_at: null,
      });
    }
  }

  if (normalizedType === 'season') {
    const { data: seasonData, error: seasonError } = await supabase
      .from('seasons')
      .select('tv_show_id')
      .eq('id', contentId)
      .maybeSingle();

    if (seasonError) {
      console.error('Season lookup failed:', seasonError);
      return errorResponse('Unable to verify season access', 500);
    }

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
          rental: null,
          purchase: showPurchase,
          expires_at: null,
        });
      }
    }
  }

  return jsonResponse({
    has_access: false,
    access_type: null,
    rental: null,
    purchase: null,
    expires_at: null,
  });
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
