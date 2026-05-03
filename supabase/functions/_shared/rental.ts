export type RentalContentType = 'movie' | 'season' | 'episode';
export type RentalStatus = 'pending' | 'paid' | 'failed';
export type RentalSource = 'rental' | 'purchase' | 'admin_grant';

export interface RentalAccessResult {
  has_access: boolean;
  access_type: 'rental' | 'purchase' | 'free' | null;
  expires_at: string | null;
  rental_access_id: string | null;
}

export interface CreateRentalIntentInput {
  userId: string;
  contentId: string;
  contentType: RentalContentType;
  price: number;
  paymentMethod: 'wallet' | 'paystack';
  status?: RentalStatus;
  providerReference?: string | null;
  paystackReference?: string | null;
  referralCode?: string | null;
  discountAmount?: number;
  expiresAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GrantRentalAccessInput {
  userId: string;
  contentId: string;
  contentType: RentalContentType;
  expiresAt: string;
  rentalIntentId?: string | null;
  source?: RentalSource;
  metadata?: Record<string, unknown>;
}

export function normalizeContentType(contentType: string): RentalContentType {
  const lowerType = String(contentType).toLowerCase().trim();

  if (lowerType === 'movie' || lowerType === 'season' || lowerType === 'episode') {
    return lowerType;
  }

  if (lowerType === 'tv_show' || lowerType === 'tv') {
    return 'season';
  }

  return 'movie';
}

export function isRentableContentType(contentType: string): contentType is RentalContentType {
  const normalized = String(contentType).toLowerCase().trim();
  return normalized === 'movie' || normalized === 'season' || normalized === 'episode';
}

export function getDefaultRentalDurationHours(contentType: RentalContentType): number {
  switch (contentType) {
    case 'movie':
      return 48;
    case 'season':
      return 336;
    case 'episode':
      return 48;
    default:
      return 48;
  }
}

export function buildRentalContentFields(contentId: string, contentType: RentalContentType) {
  return {
    movie_id: contentType === 'movie' ? contentId : null,
    season_id: contentType === 'season' ? contentId : null,
    episode_id: contentType === 'episode' ? contentId : null,
    rental_type: contentType,
  };
}

async function findDirectRentalAccess(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => any;
      eq: (column: string, value: unknown) => any;
      gt: (column: string, value: unknown) => any;
      order: (column: string, options: { ascending: boolean }) => any;
      maybeSingle: () => Promise<{ data: any; error: any }>;
    };
  },
  userId: string,
  contentId: string,
  contentType: RentalContentType,
) {
  const now = new Date().toISOString();

  const queryByColumn = async (column: 'movie_id' | 'season_id' | 'episode_id', value: string) => {
    const { data, error } = await supabase
      .from('rental_access')
      .select('*')
      .eq('user_id', userId)
      .eq(column, value)
      .eq('status', 'paid')
      .eq('revoked_at', null)
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
  };

  if (contentType === 'movie') {
    return await queryByColumn('movie_id', contentId);
  }

  if (contentType === 'season') {
    return await queryByColumn('season_id', contentId);
  }

  const episodeAccess = await queryByColumn('episode_id', contentId);
  if (episodeAccess) {
    return episodeAccess;
  }

  const { data: episodeData } = await supabase
    .from('episodes')
    .select('season_id')
    .eq('id', contentId)
    .maybeSingle();

  if (episodeData?.season_id) {
    const seasonAccess = await queryByColumn('season_id', episodeData.season_id);
    if (seasonAccess) {
      return seasonAccess;
    }
  }

  return null;
}

export async function hasActiveRentalAccess(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    from: (table: string) => {
      select: (columns: string) => any;
      eq: (column: string, value: unknown) => any;
      gt: (column: string, value: unknown) => any;
      order: (column: string, options: { ascending: boolean }) => any;
      maybeSingle: () => Promise<{ data: any; error: any }>;
    };
  },
  userId: string,
  contentId: string,
  contentType: string,
): Promise<RentalAccessResult> {
  const normalizedType = normalizeContentType(contentType);

  try {
    const { data, error } = await supabase.rpc('has_active_rental_access', {
      p_user_id: userId,
      p_content_id: contentId,
      p_content_type: normalizedType,
    });

    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      const row = rows[0] as Partial<RentalAccessResult> | undefined;

      return {
        has_access: !!row?.has_access,
        access_type: (row?.access_type as RentalAccessResult['access_type']) ?? null,
        expires_at: (row?.expires_at as string | null) ?? null,
        rental_access_id: (row?.rental_access_id as string | null) ?? null,
      };
    }
  } catch {
    // Fall through to direct lookup when the RPC is missing from schema cache.
  }

  const directAccess = await findDirectRentalAccess(supabase, userId, contentId, normalizedType);
  if (directAccess) {
    return {
      has_access: true,
      access_type: directAccess.source === 'purchase' ? 'purchase' : 'rental',
      expires_at: directAccess.expires_at ?? null,
      rental_access_id: directAccess.id ?? null,
    };
  }

  return {
    has_access: false,
    access_type: null,
    expires_at: null,
    rental_access_id: null,
  };
}

export async function grantRentalAccess(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  },
  input: GrantRentalAccessInput,
): Promise<string | null> {
  const normalizedType = normalizeContentType(input.contentType);

  const { data, error } = await supabase.rpc('grant_rental_access', {
    p_user_id: input.userId,
    p_content_id: input.contentId,
    p_content_type: normalizedType,
    p_rental_type: input.contentType,
    p_expires_at: input.expiresAt,
    p_rental_intent_id: input.rentalIntentId ?? null,
    p_source: input.source ?? 'rental',
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  return (data as string | null) ?? null;
}

export async function findActiveRentalIntent(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => any;
      eq: (column: string, value: string) => any;
      in: (column: string, values: string[]) => any;
      order: (column: string, options: { ascending: boolean }) => any;
      maybeSingle: () => Promise<{ data: any; error: any }>;
    };
  },
  userId: string,
  contentId: string,
  contentType: RentalContentType,
) {
  const { data, error } = await supabase
    .from('rental_intents')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq(`${contentType}_id`, contentId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export function buildRentalIntentPayload(input: CreateRentalIntentInput) {
  const contentFields = buildRentalContentFields(input.contentId, input.contentType);

  return {
    user_id: input.userId,
    ...contentFields,
    price: input.price,
    payment_method: input.paymentMethod,
    status: input.status ?? 'pending',
    provider_reference: input.providerReference ?? null,
    paystack_reference: input.paystackReference ?? null,
    referral_code: input.referralCode ?? null,
    discount_amount: input.discountAmount ?? 0,
    expires_at: input.expiresAt ?? null,
    paid_at: input.paidAt ?? null,
    failed_at: input.failedAt ?? null,
    metadata: input.metadata ?? {},
  };
}
