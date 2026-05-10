## Rental System UX & Architecture Optimization

Goal: deliver a premium, deterministic, OTT-grade rental experience using the existing edge functions, hooks, and components — by consolidating duplicates, formalizing entitlement states, and making the backend the single source of truth.

---

### 1. Audit findings (current pain points)

**Duplication / drift:**
- Two parallel rental hooks: `useRentals` (reads legacy `rentals` table) and `useOptimizedRentals` (also reads `rentals`). Neither reads the canonical `rental_access` table that edge functions write to.
- Three rental UI surfaces: `RentalButton` (683 lines), `OptimizedRentalButton`, `RentalBottomSheet` + `OptimizedRentalCheckout` (862 lines). Behavior diverges (iOS gating, Paystack handling, referral codes).
- Two verification edge functions: `verify-payment` and `verify-rental-payment`. Two table families: legacy `rentals`/`rental_payments` and new `rental_intents`/`rental_access`.

**State model gaps:**
- Frontend uses booleans (`hasAccess`, `isPaid`) instead of an explicit state machine. No first-class `PAYMENT_PENDING`, `PAYMENT_VERIFICATION`, `FAILED`, `REVOKED` surfaced in UI.
- Countdown is computed from whichever table the hook happens to query; `rentals.expires_at` and `rental_access.expires_at` can diverge.

**Playback access:**
- `Watch.tsx` / `EpisodePlayer` check access via the legacy hook; `get-video-url` validates against `rental_access`. Possible mismatch where UI says "Watch" but URL signing fails (or vice versa).
- No graceful in-player expiry: timer is purely visual, no forced pause + overlay.

**Payment trust:**
- Paystack flow relies partly on frontend polling `verify-payment`; webhook is authoritative but client occasionally optimistically grants UI access before webhook lands.

---

### 2. Target architecture (reuse existing pieces)

**Single source of truth:** `rental_intents` (payment lifecycle) + `rental_access` (entitlement). Legacy `rentals` table becomes read-only / deprecated for new writes.

**Entitlement state machine** (derived on backend, surfaced as a single enum to frontend):

```text
NOT_RENTED ─► PAYMENT_PENDING ─► PAYMENT_VERIFICATION ─► ACTIVE ─► EXPIRED
                   │                      │                │
                   ▼                      ▼                ▼
                FAILED                 FAILED          REVOKED / REFUNDED
```

Mapping (no schema change required, derived from existing columns):
- `rental_intents.status = pending` + `payment_method = wallet` → `PAYMENT_PENDING` (transient, usually instant)
- `rental_intents.status = pending` + `payment_method = paystack` → `PAYMENT_VERIFICATION`
- `rental_intents.status = paid` + `rental_access.status = paid` + `expires_at > now()` → `ACTIVE`
- `rental_access.expires_at <= now()` → `EXPIRED`
- `rental_intents.status = failed` → `FAILED`
- `rental_access.revoked_at IS NOT NULL` → `REVOKED`
- `payments.status = refunded` linked via intent → `REFUNDED`

**Backend canonical access check:** keep `has_active_rental_access()` Postgres function (already exists). All hooks query it via a thin RPC wrapper instead of joining tables client-side.

---

### 3. Frontend consolidation

**Hooks (collapse 2 → 1):**
- Delete `useRentals.tsx`. Keep `useOptimizedRentals.tsx`, rewrite to:
  - Query `rental_access` (not `rentals`) joined with latest `rental_intents` per content.
  - Expose: `getEntitlement(contentId, contentType) → { state, expiresAt, intentId, secondsRemaining }` (state machine enum above).
  - Subscribe to both `rental_access` and `rental_intents` realtime channels for the user.
  - Server-time skew correction: fetch `now()` from Supabase once on mount, use `Date.now() - skew` for countdowns.
- Keep `usePaystackRentalVerification` but simplify: it only polls `verify-payment` until intent reaches a terminal state, then resolves.

**Components (collapse 4 → 2):**
- Delete `RentalButton.tsx` (legacy) and `RentalBottomSheet.tsx`.
- Keep `OptimizedRentalButton.tsx` as the single CTA — extend it to render dynamic states from the entitlement enum (`Rent Now`, `Confirming Payment…`, `Watch Now` + countdown, `Rental Expired` + `Rent Again`).
- Keep `OptimizedRentalCheckout.tsx` as the only modal/bottom-sheet. Trim it to a clean 2-step flow (Summary → Payment method) and reuse it for both web and mobile via responsive Sheet/Dialog.
- Update `MoviePreview.tsx`, `TVShowPreview.tsx`, `EpisodePlayer.tsx`, `Profile.tsx` to import only `OptimizedRentalButton` + `OptimizedRentalCheckout`.
- `ActiveRentalCard.tsx` stays (My Rentals dashboard) but reads from the new entitlement hook.

**Countdown component (new, small):** `<RentalCountdown expiresAt={...} onExpire={...} />` — single shared formatter (`2d 4h`, `18h 14m`, `42m`, `Expires soon`). Used in detail page, player overlay, and My Rentals.

**Player expiry handling:** in `VideoPlayer` / `NativeVideoPlayer`, accept an `expiresAt` prop. Internal interval (per-second near expiry, per-minute otherwise):
- T-5min: toast warning.
- T-0: pause player, dispatch `onRentalExpired` → parent shows full-screen overlay with "Rental Expired" + "Rent Again" CTA. No black screen, no reload.

---

### 4. Backend optimization (no new edge functions)

Reuse and tighten existing functions:

- **`process-rental`** (entry point): keep as-is for both wallet and Paystack initialization. Add idempotency check — if an open `rental_intents` row exists for (user, content) within last 5 min, return it instead of creating a duplicate (prevents double-tap duplicates).
- **`wallet-payment`**: already transactional via `process_wallet_rental_payment` RPC. Confirm it always returns the new `rental_access.id` so frontend transitions straight to ACTIVE without polling.
- **`paystack-webhook`**: authoritative grant. Verify HMAC (already done), idempotency on `paystack_reference` (already enforced via unique reference on intent). Ensure it calls `grant_rental_access` only after intent flips to `paid`.
- **`verify-payment`**: becomes the only client-facing verification endpoint. Returns `{ state, expiresAt, rentalAccessId }` shaped to the entitlement state machine. Mark `verify-rental-payment` as deprecated and route any remaining callers here, then delete only after no references remain.
- **`rental-access`** + **`get-video-url`**: ensure both rely on `has_active_rental_access()` so playback authorization and UI authorization can never disagree.

**Audit + anomalies:** existing `payment_anomalies` and `finance_audit_logs` tables are sufficient; ensure webhook + wallet flows write to them on every state transition (most already do — verify and patch gaps).

---

### 5. UX flow (final shape)

1. **Detail page** loads → `useOptimizedRentals().getEntitlement()` returns one of the 8 states → `OptimizedRentalButton` renders the matching CTA + countdown.
2. **Rent Now** opens `OptimizedRentalCheckout` (Summary → Payment method).
3. **Wallet path:** confirm → `process-rental` (wallet) → atomic debit + entitlement → modal shows success animation (existing `PaymentSuccessAnimation`) → auto-route to `/watch/...`.
4. **Paystack path:** confirm → redirect to Paystack → return URL hits a small handler that calls `verify-payment` polling → state transitions PAYMENT_VERIFICATION → ACTIVE → success animation → route to `/watch/...`.
5. **Playback:** `Watch.tsx` calls `get-video-url`; on 403 expired, show overlay (no crash). Player receives `expiresAt` and handles T-5min toast + T-0 pause + overlay.
6. **My Rentals (Profile):** lists ACTIVE + EXPIRED with countdown and one-click `Rent Again` (re-opens checkout pre-filled).

---

### 6. Edge cases covered

- Double-tap on Rent → idempotent intent reuse.
- Paystack webhook arrives before user returns → `verify-payment` immediately resolves ACTIVE.
- User returns but webhook delayed → polling shows PAYMENT_VERIFICATION until webhook lands or 5 min timeout → FAILED with "Try again" CTA.
- Wallet debit succeeds but entitlement insert fails → RPC is transactional, both rollback.
- Expired during playback → graceful pause + overlay.
- Re-rent of expired content → existing `grant_rental_access` already releases expired row first.
- Refund issued → `payments.status = refunded` cascades to REFUNDED state in UI.
- Clock skew on device → server-time anchor correction.

---

### 7. Deliverables (phased, credit-aware)

**Phase 1 — Backend tighten (1 migration, no new functions):**
- Add a thin Postgres view `v_user_entitlements` that returns `(user_id, content_id, content_type, state, expires_at, intent_id, access_id)` derived from `rental_intents` + `rental_access`. Hooks query this view.
- Add idempotency guard inside `process-rental` (code edit, no new function).
- Standardize `verify-payment` response shape.

**Phase 2 — Hook + countdown:**
- Rewrite `useOptimizedRentals` to use the view; delete `useRentals`.
- Add `RentalCountdown` component + shared `formatRentalRemaining` util.

**Phase 3 — UI consolidation:**
- Extend `OptimizedRentalButton` with all 8 states.
- Slim `OptimizedRentalCheckout` to 2-step flow.
- Migrate `MoviePreview`, `TVShowPreview`, `EpisodePlayer`, `Profile` to the consolidated components.
- Delete `RentalButton.tsx` and `RentalBottomSheet.tsx`.

**Phase 4 — Player expiry:**
- Add `expiresAt` prop + warning/expiry overlay to `VideoPlayer` and `NativeVideoPlayer`. Wire through `Watch.tsx` and `EpisodePlayer`.

**Phase 5 — Cleanup:**
- Delete `verify-rental-payment` once no callers remain.
- Mark legacy `rentals` table read-only via comment + remove writers.

---

### Technical details

- **No new edge functions.** All changes are: 1 migration (view + optional idempotency index), edits to `process-rental` and `verify-payment` response shape, frontend refactor.
- **State enum** lives in `src/lib/rentalStates.ts` (new ~30-line file) and is the only place the 8 states are defined.
- **Realtime:** subscribe to `rental_access` and `rental_intents` filtered by `user_id`; debounced refetch of the view.
- **Security:** view exposed via RLS (user sees own rows only); video URL signing keeps `has_active_rental_access` as the gate; webhook HMAC unchanged.

This delivers the OTT-grade flow you described while reusing every existing edge function and removing ~1,500 lines of duplicated frontend code.