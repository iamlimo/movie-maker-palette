/**
 * Rental entitlement state machine.
 * Single source of truth — backed by the `v_user_entitlements` Postgres view.
 */

export type RentalState =
  | 'NOT_RENTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_VERIFICATION'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'FAILED'
  | 'REVOKED'
  | 'REFUNDED';

export type RentalContentType = 'movie' | 'season' | 'episode';

export interface Entitlement {
  state: RentalState;
  contentId: string;
  contentType: RentalContentType;
  expiresAt: string | null;
  intentId: string | null;
  accessId: string | null;
  paymentMethod: string | null;
}

export const NOT_RENTED_ENTITLEMENT = (
  contentId: string,
  contentType: RentalContentType,
): Entitlement => ({
  state: 'NOT_RENTED',
  contentId,
  contentType,
  expiresAt: null,
  intentId: null,
  accessId: null,
  paymentMethod: null,
});

export const isActive = (e: Entitlement | null | undefined) =>
  !!e && e.state === 'ACTIVE';

export const isPending = (e: Entitlement | null | undefined) =>
  !!e && (e.state === 'PAYMENT_PENDING' || e.state === 'PAYMENT_VERIFICATION');

export const canRent = (e: Entitlement | null | undefined) =>
  !e ||
  e.state === 'NOT_RENTED' ||
  e.state === 'EXPIRED' ||
  e.state === 'FAILED' ||
  e.state === 'REVOKED' ||
  e.state === 'REFUNDED';

/**
 * Format a remaining-time countdown for rental UI.
 * - >= 24h → "2d 4h left"
 * - >= 1h  → "18h 14m left"
 * - >= 1m  → "42m left"
 * - <  1m  → "Expires soon"
 * - <= 0   → "Expired"
 */
export function formatRentalRemaining(
  expiresAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!expiresAt) return '';
  const end = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  const diff = end - nowMs;
  if (diff <= 0) return 'Expired';
  const totalMin = Math.floor(diff / 60000);
  if (totalMin < 1) return 'Expires soon';
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days >= 1) return `${days}d ${hours}h left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export const STATE_LABEL: Record<RentalState, string> = {
  NOT_RENTED: 'Rent Now',
  PAYMENT_PENDING: 'Confirming Payment…',
  PAYMENT_VERIFICATION: 'Verifying Payment…',
  ACTIVE: 'Watch Now',
  EXPIRED: 'Rent Again',
  FAILED: 'Payment Failed — Try Again',
  REVOKED: 'Access Revoked',
  REFUNDED: 'Rent Again',
};