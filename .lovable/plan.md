
# RBAC + ABAC + Audit Overlay — Signature TV

Goal: evolve from "role → page" to "permission → action + owner-scoped data + audit trail" while keeping the existing `app_role` enum, every current admin route, and all live RLS policies intact. Ship before June 14.

## Guiding rules
- Keep the `app_role` enum and `user_roles` table as-is. New `role_permissions` maps enum values → permissions. `is_staff()` / `has_role()` keep working.
- All new RLS uses `has_permission()` **in addition to** existing policies (additive overlay). No existing policy is dropped in this pass.
- ABAC scope = content ownership only (`uploaded_by` on movies, producer link on tv_shows/seasons/episodes). Region/assignment scopes deferred.
- Audit logs: schema + automatic write-side triggers only. The viewer UI ships in a follow-up.
- Sidebar/buttons read from a single `can(permission)` helper. `useRole` is kept as a thin compatibility shim.

---

## 1. Permission catalog (seed data)

Resource.action format, grouped:

- users: `user.view`, `user.create`, `user.edit`, `user.delete`, `user.suspend`
- content: `content.movie.create|edit|delete`, `content.tv.create|edit|delete`, `content.publish`, `content.unpublish`
- homepage: `homepage.section.manage`, `homepage.hero.manage`, `homepage.banner.manage`
- finance: `wallet.view`, `wallet.adjust`, `wallet.audit`, `rental.manage`, `referral.manage`
- support: `support.ticket.view`, `support.ticket.respond`
- careers: `careers.job.manage`, `careers.application.view`
- notifications: `notification.send`
- settings/admin: `settings.manage`, `role.manage`, `permission.manage`, `audit.view`

Default role → permission mapping (seeded, editable later):
- `super_admin` → all
- `admin` → all except `role.manage`, `permission.manage`, `audit.view`
- `accounting` → `wallet.*`, `rental.manage`, `referral.manage`, `user.view`
- `sales` → `homepage.*`, `referral.manage`, `user.view`, `rental.manage`
- `support` → `support.*`, `user.view`, `careers.*`
- `user` → none

---

## 2. Database additions (additive, zero destructive change)

New migration (no edits to existing tables):

```text
permissions(id, key UNIQUE, description, module)
role_permissions(role app_role, permission_id) PK(role, permission_id)
audit_logs(
  id, actor_id, action, resource_type, resource_id,
  metadata jsonb, ip, user_agent, created_at DEFAULT now()
)  -- append-only
```

Append-only enforcement on `audit_logs`:
- `REVOKE UPDATE, DELETE` from authenticated/anon/service_role
- BEFORE UPDATE/DELETE trigger that RAISEs
- RLS: `audit.view` permission required for SELECT; INSERT allowed via SECURITY DEFINER function only

ABAC support column (already present): `movies.uploaded_by`. We add `tv_shows.uploaded_by` and `seasons.uploaded_by` nullable columns (NULL = legacy, treated as staff-owned). No backfill required.

GRANTs included for every new public table per project rules.

### New SQL helpers (SECURITY DEFINER, STABLE)
- `has_permission(_user uuid, _perm text) returns boolean` — joins `user_roles` → `role_permissions` → `permissions`
- `owns_content(_user uuid, _table text, _id uuid) returns boolean` — owner check used by ABAC RLS
- `log_audit(_action, _resource_type, _resource_id, _metadata)` — append to `audit_logs` with `auth.uid()`

---

## 3. RLS — additive overlay only

For each existing staff-write policy we keep it. We add a second policy that grants the same action when `has_permission(...)` is true AND (for content) `owns_content(...)` is true. This means:

- Existing super_admin/admin flows continue to work via `is_staff()`.
- New permission grants (e.g. a producer with `content.movie.edit` on their own row) become possible.
- Anyone the old policy already allowed remains allowed → zero regression.

Example (movies.update):
```sql
create policy movies_owner_edit on public.movies
for update to authenticated
using (has_permission(auth.uid(), 'content.movie.edit') and uploaded_by = auth.uid())
with check (has_permission(auth.uid(), 'content.movie.edit') and uploaded_by = auth.uid());
```

No DROP POLICY in this migration.

---

## 4. Automatic audit triggers (write-side only)

AFTER INSERT/UPDATE/DELETE triggers on:
- `user_roles` → role changes
- `role_permissions` → permission changes
- `wallets` (UPDATE of balance) + manual `wallet.adjust` calls → wallet adjustments
- `movies`, `tv_shows`, `episodes` status change → moderation actions
- Auth events: already captured by Supabase Auth logs; we mirror sign-in success into `audit_logs` via an edge-function hook only if it's a one-liner — otherwise we defer (Supabase already keeps these).

Each trigger calls `log_audit(...)` with a typed `action` string ('role.changed', 'permission.granted', 'wallet.adjusted', 'content.published'…).

---

## 5. Frontend integration (no UI rewrite)

New files:
- `src/lib/permissions.ts` — `PermissionKey` union, derived from the seed list.
- `src/hooks/usePermissions.tsx` — fetches `role_permissions` for current role once, memoizes a `Set<PermissionKey>`, exposes `can(perm)` and `canAny(perms)`.
- `src/components/Can.tsx` — `<Can perm="wallet.adjust">…</Can>` render-prop guard.

Edits:
- `src/lib/rbac.ts` — keep `PAGE_ACCESS` but mark deprecated; `canAccessPage` now delegates to `can()` for the matching permission(s). Backward compatible.
- `src/hooks/useRole.tsx` — `canDo()` becomes a thin wrapper over `usePermissions().can()`. Existing call sites keep working.
- `src/components/RoleRoute.tsx` / `RequireRole.tsx` — accept optional `perm` prop; if provided, use permission check; otherwise fall back to current role check.
- `src/components/admin/AdminLayout.tsx` — sidebar filter swaps `canAccess(page)` for a permission map (each sidebar item gets a permission key). Visible-when logic unchanged.

Nothing about existing pages is rewritten. Sensitive buttons (Delete user, Adjust wallet, Publish content, Manage roles) are wrapped in `<Can>` so they hide when the permission is missing.

---

## 6. Phased rollout (zero downtime)

1. **Phase 1 — schema + seed (1 migration, behind the scenes).** Add tables, seed permissions + role_permissions from current enum mapping, add `has_permission()`. No RLS changes. No UI changes. Verify nothing regresses.
2. **Phase 2 — overlay RLS + frontend `can()`.** Add additive policies, ship `usePermissions` + `<Can>`, wire sidebar and sensitive buttons. Existing staff still pass via old `is_staff()` policies → safe.
3. **Phase 3 — audit triggers.** Enable triggers on role/permission/wallet/content. Append-only enforcement on. (Viewer UI deferred per your choice.)
4. **Phase 4 (post-launch).** Reports & Compliance page reading from `audit_logs`. Dynamic dashboard widgets. Then optionally retire `is_staff()` from policies module-by-module once permission coverage is verified.

Each phase is independently revertable.

---

## 7. Risk & rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| New RLS breaks an admin action | All new policies are additive; old `is_staff()` policies remain | `DROP POLICY` for the new overlay; behavior reverts |
| Permission seed wrong → admin loses access to a button | Super admin has all perms by definition; we test with a real admin account before enabling `<Can>` | Toggle the button back to a role check (one-line) |
| Audit trigger slows writes | Triggers do a single INSERT into an unindexed-for-write table | Disable trigger; data already written stays |
| Append-only blocks legitimate cleanup | Service-role SECURITY DEFINER procedure for retention pruning, gated by `permission.manage` | n/a |

---

## 8. Out of scope (this plan)
- Region/country and ticket-assignment ABAC scopes
- Reports & Compliance viewer UI + CSV export
- Replacing the enum with fully dynamic roles
- Dashboard widget refactor

## 9. Deliverables this round
1. One migration: `permissions`, `role_permissions`, `audit_logs`, helper functions, additive RLS overlay for movies/tv_shows/seasons/episodes/wallets/tickets, audit triggers, GRANTs.
2. `src/lib/permissions.ts`, `src/hooks/usePermissions.tsx`, `src/components/Can.tsx`.
3. Light edits to `src/lib/rbac.ts`, `src/hooks/useRole.tsx`, `src/components/RoleRoute.tsx`, `src/components/RequireRole.tsx`, `src/components/admin/AdminLayout.tsx` to plug `can()` in without changing layouts.
4. No edits to existing migrations, no removal of existing policies, no new pages.
