import { useAuth } from '@/contexts/AuthContext';
import {
  ROLE_HIERARCHY,
  STAFF_ROLES,
  canAccessPage,
  canDoAction,
  type ActionKey,
  type AppRole,
  type PageKey,
} from '@/lib/rbac';

export const useRole = () => {
  const { userRole } = useAuth();
  const role = (userRole?.role as AppRole | undefined) ?? null;

  /**
   * hasRole keeps backwards-compatible "minimum tier" semantics: returns true
   * when the current role is at or above the requested role in the hierarchy.
   * For exact-match or multi-role checks prefer hasAnyRole / canAccess / canDo.
   */
  const hasRole = (target: AppRole) => {
    if (!role) return false;
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[target];
  };

  const hasAnyRole = (roles: AppRole[]) =>
    !!role && roles.includes(role);

  const isSuperAdmin = () => role === 'super_admin';
  const isAdmin = () => role === 'admin' || role === 'super_admin';
  const isSupport = () => role === 'support';
  const isSales = () => role === 'sales';
  const isAccounting = () => role === 'accounting';
  const isStaff = () => !!role && STAFF_ROLES.includes(role);
  const isUser = () => !!role;

  const canAccess = (page: PageKey) => canAccessPage(role, page);
  const canDo = (action: ActionKey) => canDoAction(role, action);

  return {
    userRole: role,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    isAdmin,
    isSupport,
    isSales,
    isAccounting,
    isStaff,
    isUser,
    canAccess,
    canDo,
  };
};