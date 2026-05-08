## Goal

Introduce a 5-role RBAC system (`super_admin`, `admin`, `support`, `sales`, `accounting`) on top of the existing `user_roles` / `app_role` enum, and apply those roles consistently across the admin dashboard, route guards, RLS policies, and edge functions — without breaking existing super-admin behavior.

## Current state (verified)

- `app_role` enum currently: `user | admin | super_admin`. Stored in `public.user_roles` (correct pattern, no recursion).
- Access checks: `useRole.tsx` (hierarchy 3/2/1), `SuperAdminRoute.tsx` guards every `/admin/*` route, RLS uses `has_role(uid, 'super_admin')` heavily, edge functions (e.g. `admin-wallet-adjustment`) gate on `super_admin` only.
- 30 admin pages exist; today only super_admin can reach any of them.

## Proposed role model

```text
super_admin → full control, role assignment, settings, destructive actions
admin       → content + homepage + most operations (no role mgmt, no destructive finance)
support     → tickets, users (read + limited update), rentals (read), wallets (read)
sales       → referral codes, banners/CTAs, slider, sections, rental + finance read
accounting  → finance (full read + payouts/reconciliation), wallets read, rentals read, audit logs
```

Page-by-page access matrix (S=super_admin, A=admin, Su=support, Sa=sales, Ac=accounting):

```text
Page                          S  A  Su Sa Ac
Dashboard                     ✓  ✓  ✓  ✓  ✓
Movies / TV Shows / Episodes  ✓  ✓  -  -  -
Sections / HeroSlider/Banners ✓  ✓  -  ✓  -
Users (list)                  ✓  ✓  ✓  -  ro
Users (delete / role change)  ✓  -  -  -  -
Producers / Submissions       ✓  ✓  -  -  -
Finance (overview + tx)       ✓  ro -  ro ✓
Finance (payouts/reconcile)   ✓  -  -  -  ✓
Rentals tracking              ✓  ✓  ro ro ✓
Wallets                       ✓  ro ro -  ro
Wallet adjustment             ✓  -  -  -  ✓
Referral codes                ✓  ✓  -  ✓  -
Tickets list / details        ✓  ✓  ✓  -  -
Create ticket                 ✓  ✓  ✓  -  -
Job listings / applications   ✓  ✓  ✓  -  -
Settings                      ✓  -  -  -  -
```

## Implementation plan

### 1. Database migration (additive, backwards-compatible)

- `ALTER TYPE app_role ADD VALUE 'support'; ADD VALUE 'sales'; ADD VALUE 'accounting';`
- Add helper SECURITY DEFINER functions (avoid duplicating `has_role` calls in policies):
  - `public.is_staff(uid)` → true for any of the 5 staff roles.
  - `public.has_any_role(uid, app_role[])` → array membership check.
- Update RLS policies that currently say `has_role(uid,'super_admin')` to use the new helpers where read access should be broadened. Examples:
  - `payments`, `rental_payments`, `rental_intents`, `rental_access`, `finance_audit_logs`, `wallet_transactions`: SELECT → `has_any_role(uid, ARRAY['super_admin','accounting','admin'])` (and add `sales`/`support` where matrix says read-only).
  - `referral_codes`, `banners`, `slider_items`, `sections`: ALL → keep super_admin; add separate ALL/UPDATE policy for `sales` (and `admin` for content sections).
  - `movies`, `tv_shows`, `seasons`, `episodes`, `cast_crew`, `genres`, `submissions`, `producers`: ALL → super_admin + admin.
  - `tickets`, `ticket_comments`, `email_logs`, `job_listings`, `job_applications`: ALL → super_admin + admin + support.
  - `user_roles` mutations: keep super_admin only.
- Keep all existing super_admin policies intact (super_admin remains top of hierarchy).

### 2. Frontend role hook + guards

- Extend `app_role` union in `src/hooks/useRole.tsx` and `AuthContext.tsx` to the 5 roles. New hierarchy:
  ```text
  super_admin 100
  admin        80
  accounting   60
  sales        60
  support      60
  user          1
  ```
- Add helpers: `isSupport()`, `isSales()`, `isAccounting()`, `isStaff()`, `hasAnyRole([...])`, `canAccess(pageKey)`.
- Centralize the page→roles matrix in `src/lib/rbac.ts` (single source of truth used by sidebar + route guards + per-action checks).

### 3. Route guarding

- Replace single `SuperAdminRoute` wrapper around `/admin/*` with a generic `StaffRoute` that allows any staff role, then add per-route `RoleRoute roles={[...]}` for sensitive pages (Settings, Users delete, Wallet adjustments, Payouts).
- Keep `SuperAdminRoute` exported for the few super-admin-only routes (Settings, role management).

### 4. Admin sidebar

- `AdminLayout.tsx`: filter `sidebarItems` by `canAccess(item.key)` so each role only sees what they can use. Add a small role badge near the user name.

### 5. Per-action gating inside pages

- Wrap destructive/mutating buttons with `<RequireRole roles={[...]}>` (a tiny render-prop component) so e.g. accounting can view Finance but only super_admin sees "Refund / Override".
- Wallet adjustment modal: gate on `super_admin` or `accounting`.
- Users page: hide delete + role change for non-super_admin; allow `support` to view + reset password trigger only.

### 6. Edge functions

- Add `requireRoles(req, ['super_admin','accounting'])` helper in `supabase/functions/_shared/auth.ts` (uses existing `has_role` RPC, calls it once per allowed role or via new `has_any_role` RPC).
- Update gating in:
  - `admin-wallet-adjustment` → super_admin OR accounting.
  - Any finance/refund/payout function → super_admin OR accounting.
  - Ticket admin functions → super_admin OR admin OR support.
  - Content moderation functions → super_admin OR admin.
- Leave user-facing functions (`process-rental`, `wallet-payment`, `verify-payment`, `paystack-webhook`, `get-video-url`, `rental-access`) untouched.

### 7. Role management UI (super_admin only)

- Extend `src/pages/admin/Users.tsx` role dropdown to include the 3 new roles.
- `update_user_role` RPC already accepts any `app_role`, so it picks up the new enum values automatically.

### 8. Verification

- Manual: log in as each role (seed via SQL), confirm sidebar entries, route access (direct URL), and that mutating buttons are hidden.
- Automated: add a small Vitest covering `useRole.hasAnyRole` + `canAccess` matrix.
- Edge: run Supabase linter after migration; confirm no policies reference the now-broadened tables incorrectly.

## Out of scope (call out, don't build)

- Granular per-resource permissions (CASL-style). The matrix above is role-based; if needed later we can layer a `permissions` table (already exists but unused) on top.
- Audit logging of every staff action beyond what `finance_audit_logs` already records.

## Open questions

1. Should `admin` be allowed to **create** other admins/support/sales/accounting, or is role assignment strictly super_admin? (Plan assumes strictly super_admin.)  
My response: Yes role assignment  is strictly super_admin?
2. Should `sales` see customer PII (emails, phone) on Users page, or only aggregate/marketing data? (Plan assumes no Users page access.)  
My response: Yes `sales` shouldsee customer PII (emails, phone) on Users page.
3. Should `support` be able to **issue refunds** or only escalate? (Plan assumes escalate-only; refunds = accounting/super_admin.)