import { useAuth } from '@/contexts/AuthContext';
import { ActionKey, canDoAction } from '@/lib/rbac';

export const useAuthCheck = () => {
  const { user, session, userRole, loading } = useAuth();
  const isReady = !loading && !!session && !!user;

  const appRole = userRole?.role || 'user';

  const isSuperAdmin = appRole === 'super_admin';
  const isSupport = appRole === 'support';
  const isProducer = appRole === 'admin'; // Mapping producer logic cleanly to your setup

  /**
   * Universal Overlay Capability Checker
   * Usage: can('content.movie.edit')
   */
  const can = (permission: ActionKey): boolean => {
    if (!isReady || !userRole) return false;
    
    // Super admins always bypass restrictions
    if (isSuperAdmin) return true;

    // Use our standardized matrix mapping engine from rbac.ts
    return canDoAction(appRole, permission);
  };

  return {
    isAuthenticated: !!session && !!user,
    isSuperAdmin,
    isSupport,
    isProducer,
    appRole,
    isReady,
    can,
    canUpload: can('content.movie.create')
  };
};


// import { useEffect, useState } from 'react';
// import { useAuth } from '@/contexts/AuthContext';
// import { useRole } from '@/hooks/useRole';

// export const useAuthCheck = () => {
//   const { user, session } = useAuth();
//   const { isSuperAdmin } = useRole();
//   const [isReady, setIsReady] = useState(false);

//   useEffect(() => {
//     setIsReady(!!session && !!user);
//   }, [session, user]);

//   return {
//     isAuthenticated: !!session && !!user,
//     isSuperAdmin: isSuperAdmin(),
//     isReady,
//     canUpload: isReady && isSuperAdmin()
//   };
// };

