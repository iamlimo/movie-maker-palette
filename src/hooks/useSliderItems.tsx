import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SliderItem {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  content_type: 'movie' | 'tv_show';
  content_id: string;
  genre: string | null;
  rating: string | null;
  price: number;
  is_featured: boolean;
  is_rentable: boolean;
  sort_order: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  promotion_type: 'standard' | 'promoted' | 'coming_soon';
  release_date: string | null;
  promotion_badge_text: string | null;
  promotion_priority: number;
  promotion_starts_at: string | null;
  promotion_ends_at: string | null;
}

export const useSliderItems = () => {
  const { data: sliderItems = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['sliderItems'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('slider-items', {
        method: 'GET'
      });

      if (error) {
        console.error('Error fetching slider items:', error);
        throw error;
      }

      return data || [];
    }
  });

  return {
    sliderItems,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  };
};