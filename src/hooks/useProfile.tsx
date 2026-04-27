import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  name: string;
  email: string;
  phone_number?: string;
  country?: string;
  date_of_birth?: string;
  profile_image_url?: string;
  status: string;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  preferred_language: string;
  preferred_genres: string[];
  email_notifications: boolean;
  push_notifications: boolean;
  auto_play: boolean;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const createDefaultPreferences = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .insert([{
          user_id: user.id,
          preferred_language: 'en',
          preferred_genres: [],
          email_notifications: true,
          push_notifications: true,
          auto_play: true
        }])
        .select()
        .single();

      if (error) throw error;
      setPreferences(data);
    } catch (error) {
      console.error('Error creating default preferences:', error);
    }
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setPreferences(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setProfile(null);
      }

      // Fetch preferences
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (preferencesError) {
        console.error('Error fetching preferences:', preferencesError);
      }

      if (!preferencesData) {
        await createDefaultPreferences();
      } else {
        setPreferences(preferencesData);
      }

      // Fetch current wallet balance directly to keep profile data in sync
      let walletBalance = profileData?.wallet_balance ?? 0;
      if (profileData) {
        const { data: walletData, error: walletError } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();

        if (walletError) {
          console.error('Error fetching wallet balance:', walletError);
        }

        if (walletData) {
          walletBalance = walletData.balance;
        }
      }

      setProfile(profileData ? { ...profileData, wallet_balance: walletBalance } : null);
    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, createDefaultPreferences]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({ ...profile, ...updates });
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
      return false;
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user || !preferences) return false;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setPreferences({ ...preferences, ...updates });
      toast({
        title: "Success",
        description: "Preferences updated successfully"
      });
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
      return false;
    }
  };

  const uploadProfileImage = async (file: File) => {
    if (!user || !profile) return null;

    try {
      // Use jpg extension for consistency (images are compressed to JPEG)
      const fileExt = file.type === 'image/png' ? 'png' : 'jpg';
      const fileName = `${user.id}/profile-${Date.now()}.${fileExt}`;

      console.log('Uploading profile image:', { fileName, fileSize: file.size, fileType: file.type });

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      console.log('Profile image uploaded successfully:', publicUrl);

      await updateProfile({ profile_image_url: publicUrl });
      return publicUrl;
    } catch (error) {
      const err = error as { message?: string };
      console.error('Error uploading profile image:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to upload profile image",
        variant: "destructive"
      });
      return null;
    }
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPreferences(null);
      setLoading(false);
      return;
    }

    fetchProfile();

    const channel = supabase
      .channel('profile-wallet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setProfile((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                wallet_balance: (payload.new as { balance?: number })?.balance ?? prev.wallet_balance
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile]);

  return {
    profile,
    preferences,
    loading,
    updateProfile,
    updatePreferences,
    uploadProfileImage,
    refetch: fetchProfile
  };
};
