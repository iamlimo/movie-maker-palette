import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone_number?: string;
  country?: string;
  date_of_birth?: string;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  role: 'user' | 'admin' | 'super_admin';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userRole: UserRole | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigationCallback, setNavigationCallback] = useState<(() => void) | null>(null);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        // Don't throw error, just log it - profile might not exist yet
      }
      
      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Role fetch error:', roleError);
        // Don't throw error, just log it - role might not exist yet
      }

      if (profileData) {
        console.log('Profile fetched successfully:', profileData.name);
        setProfile(profileData);
      }
      
      if (roleData) {
        console.log('Role fetched successfully:', roleData.role);
        setUserRole(roleData);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Don't throw error to prevent blocking authentication
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('Refreshing profile for user:', user.id);
      await fetchUserProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST - NEVER use async functions directly in callbacks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls outside the callback to prevent deadlocks
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name || ''
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // State will be cleared by the auth state change listener
      // Set navigation callback to navigate after state is cleared
      setNavigationCallback(() => () => {
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      });
    } catch (error) {
      console.error('Sign out error:', error);
      setLoading(false);
    }
  };

  // Execute navigation callback after state updates
  useEffect(() => {
    if (navigationCallback && !loading) {
      navigationCallback();
      setNavigationCallback(null);
    }
  }, [navigationCallback, loading]);

  const value = {
    user,
    session,
    profile,
    userRole,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};