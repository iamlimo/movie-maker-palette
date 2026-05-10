import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppRole, PageKey } from '@/lib/rbac';

interface RoleRouteProps {
  children: React.ReactNode;
  /** Explicit list of roles allowed to access this route. */
  roles?: AppRole[];
  /** Or refer to a centralized page key from rbac.ts. */
  page?: PageKey;
  /** Where to send users who fail the check. */
  redirectTo?: string;
}

const LoadingShell = () => (
  <div className="min-h-screen p-8">
    <div className="container mx-auto space-y-8">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  </div>
);

/**
 * Generic role-aware guard. Use `page` for sidebar entries (matrix-driven),
 * or `roles` for ad-hoc allow-lists (e.g. settings page).
 */
const RoleRoute: React.FC<RoleRouteProps> = ({
  children,
  roles,
  page,
  redirectTo = '/admin',
}) => {
  const { user, loading } = useAuth();
  const { hasAnyRole, canAccess } = useRole();

  if (loading) return <LoadingShell />;
  if (!user) return <Navigate to="/auth" replace />;

  const allowed = page ? canAccess(page) : roles ? hasAnyRole(roles) : false;
  if (!allowed) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};

export default RoleRoute;