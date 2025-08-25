import { useAuth } from '@/contexts/AuthContext';

export const useRole = () => {
  const { userRole } = useAuth();
  
  const hasRole = (role: 'user' | 'admin' | 'super_admin') => {
    if (!userRole) return false;
    
    const roleHierarchy = {
      'super_admin': 3,
      'admin': 2,
      'user': 1
    };
    
    return roleHierarchy[userRole.role] >= roleHierarchy[role];
  };
  
  const isSuperAdmin = () => hasRole('super_admin');
  const isAdmin = () => hasRole('admin');
  const isUser = () => hasRole('user');
  
  return {
    userRole: userRole?.role || null,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isUser
  };
};