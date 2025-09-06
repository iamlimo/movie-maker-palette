import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';

export const useAuthCheck = () => {
  const { user, session } = useAuth();
  const { isSuperAdmin } = useRole();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(!!session && !!user);
  }, [session, user]);

  return {
    isAuthenticated: !!session && !!user,
    isSuperAdmin: isSuperAdmin(),
    isReady,
    canUpload: isReady && isSuperAdmin()
  };
};