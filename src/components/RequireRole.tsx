import { useRole } from '@/hooks/useRole';
import type { ActionKey, AppRole } from '@/lib/rbac';

interface RequireRoleProps {
  children: React.ReactNode;
  roles?: AppRole[];
  action?: ActionKey;
  fallback?: React.ReactNode;
}

/**
 * Inline render-prop guard for sensitive UI elements (buttons, menu items).
 * Renders `children` only if the current user satisfies the role/action check.
 */
const RequireRole: React.FC<RequireRoleProps> = ({
  children,
  roles,
  action,
  fallback = null,
}) => {
  const { hasAnyRole, canDo } = useRole();
  const allowed = action ? canDo(action) : roles ? hasAnyRole(roles) : false;
  return <>{allowed ? children : fallback}</>;
};

export default RequireRole;