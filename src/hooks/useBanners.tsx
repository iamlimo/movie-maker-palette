import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export const useBanners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('banners', {
        method: 'GET'
      });

      if (error) throw error;
      setBanners(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching banners:', err);
      setError(err.message);
      toast({
        title: "Error",
        description: "Failed to fetch banners",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createBanner = async (bannerData: Omit<Banner, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase.functions.invoke('banners', {
        method: 'POST',
        body: bannerData
      });

      if (error) throw error;
      
      setBanners(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Banner created successfully",
      });
      
      return data;
    } catch (err: any) {
      console.error('Error creating banner:', err);
      toast({
        title: "Error",
        description: "Failed to create banner",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateBanner = async (id: string, updates: Partial<Banner>) => {
    try {
      const { data, error } = await supabase.functions.invoke(`banners/${id}`, {
        method: 'PUT',
        body: updates
      });

      if (error) throw error;
      
      setBanners(prev => prev.map(banner => 
        banner.id === id ? { ...banner, ...data } : banner
      ));
      
      toast({
        title: "Success",
        description: "Banner updated successfully",
      });
      
      return data;
    } catch (err: any) {
      console.error('Error updating banner:', err);
      toast({
        title: "Error",
        description: "Failed to update banner",
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteBanner = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke(`banners/${id}`, {
        method: 'DELETE'
      });

      if (error) throw error;
      
      setBanners(prev => prev.filter(banner => banner.id !== id));
      toast({
        title: "Success",
        description: "Banner deleted successfully",
      });
    } catch (err: any) {
      console.error('Error deleting banner:', err);
      toast({
        title: "Error",
        description: "Failed to delete banner",
        variant: "destructive",
      });
      throw err;
    }
  };

  const reorderBanners = async (reorderedBanners: { id: string; display_order: number }[]) => {
    try {
      const { error } = await supabase.functions.invoke('banners/reorder', {
        method: 'PUT',
        body: { reorder: reorderedBanners }
      });

      if (error) throw error;

      // Update local state
      setBanners(prev => {
        const updated = [...prev];
        reorderedBanners.forEach(({ id, display_order }) => {
          const index = updated.findIndex(b => b.id === id);
          if (index !== -1) {
            updated[index].display_order = display_order;
          }
        });
        return updated.sort((a, b) => a.display_order - b.display_order);
      });

      toast({
        title: "Success",
        description: "Banners reordered successfully",
      });
    } catch (err: any) {
      console.error('Error reordering banners:', err);
      toast({
        title: "Error",
        description: "Failed to reorder banners",
        variant: "destructive",
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  return {
    banners,
    loading,
    error,
    createBanner,
    updateBanner,
    deleteBanner,
    reorderBanners,
    refetch: fetchBanners
  };
};