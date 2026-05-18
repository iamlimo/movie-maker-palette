import { Entitlement, RentalContentType, RentalState } from './rentalStates';

/**
 * Derive the canonical RentalState from a v_user_entitlements-backed entitlement.
 *
 * Phase 3.1 goal: single mapping function so UI/components don't duplicate logic.
 */
export function deriveRentalState(entitlement: Partial<Entitlement> | null | undefined): RentalState {
  if (!entitlement?.state) return 'NOT_RENTED';

  // Entitlement.state already matches the canonical union.
  return entitlement.state as RentalState;
}

/**
 * Convenience wrapper when contentType/contentId is all you have.
 * Not used in current audit gaps, but keeps API stable.
 */
export function deriveRentalStateFromSnapshot(snapshot: {
  state?: RentalState | string | null;
}): RentalState {
  if (!snapshot?.state) return 'NOT_RENTED';
  return snapshot.state as RentalState;
}

export type RentalStateMachine = {
  deriveRentalState: typeof deriveRentalState;
};

