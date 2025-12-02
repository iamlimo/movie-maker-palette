import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FavoriteItem {
  id: string;
  user_id: string;
  content_type: 'movie' | 'episode' | 'season' | 'tv_show';
  content_id: string;
  added_at: string;
  // Joined data from content tables
  title?: string;
  thumbnail_url?: string;
  duration?: number;
  price?: number;
  genre?: string;
  description?: string;
}

export const useFavorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) throw error;
      if (!data?.length) return [];

      // OPTIMIZED: Group by content type for batched queries
      const movieIds = data.filter(f => f.content_type === 'movie').map(f => f.content_id);
      const tvShowIds = data.filter(f => f.content_type === 'tv_show').map(f => f.content_id);
      const seasonIds = data.filter(f => f.content_type === 'season').map(f => f.content_id);
      const episodeIds = data.filter(f => f.content_type === 'episode').map(f => f.content_id);

      // OPTIMIZED: Parallel batched queries instead of N individual queries
      const [movies, tvShows, seasons, episodes] = await Promise.all([
        movieIds.length ? supabase.from('movies').select('id, title, thumbnail_url, duration, price, description, genres(name)').in('id', movieIds) : { data: [] },
        tvShowIds.length ? supabase.from('tv_shows').select('id, title, thumbnail_url, price, description, genres(name)').in('id', tvShowIds) : { data: [] },
        seasonIds.length ? supabase.from('seasons').select('id, season_number, description, price, tv_shows(title, thumbnail_url, genres(name))').in('id', seasonIds) : { data: [] },
        episodeIds.length ? supabase.from('episodes').select('id, title, duration, price, thumbnail_url, seasons(season_number, tv_shows(title, thumbnail_url, genres(name)))').in('id', episodeIds) : { data: [] }
      ]);

      // Create lookup maps for O(1) access
      const contentMaps = {
        movie: new Map((movies.data || []).map(m => [m.id, { title: m.title, thumbnail_url: m.thumbnail_url, duration: m.duration, price: m.price, description: m.description, genre: m.genres?.name }])),
        tv_show: new Map((tvShows.data || []).map(t => [t.id, { title: t.title, thumbnail_url: t.thumbnail_url, price: t.price, description: t.description, genre: t.genres?.name }])),
        season: new Map((seasons.data || []).map(s => [s.id, { title: `${s.tv_shows.title} - Season ${s.season_number}`, thumbnail_url: s.tv_shows.thumbnail_url, price: s.price, description: s.description, genre: s.tv_shows.genres?.name }])),
        episode: new Map((episodes.data || []).map(e => [e.id, { title: `${e.seasons.tv_shows.title} S${e.seasons.season_number} - ${e.title}`, thumbnail_url: e.thumbnail_url || e.seasons.tv_shows.thumbnail_url, duration: e.duration, price: e.price, genre: e.seasons.tv_shows.genres?.name }]))
      };

      return data.map(item => ({
        ...item,
        ...(contentMaps[item.content_type]?.get(item.content_id) || {})
      })) as FavoriteItem[];
    },
    enabled: !!user,
  });

  const addToFavorites = async (
    contentType: 'movie' | 'episode' | 'season' | 'tv_show',
    contentId: string
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          content_type: contentType,
          content_id: contentId
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already in favorites",
            description: "This item is already in your favorites"
          });
          return false;
        }
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      toast({
        title: "Added to favorites",
        description: "Item added to your favorites successfully"
      });
      return true;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      toast({
        title: "Error",
        description: "Failed to add item to favorites",
        variant: "destructive"
      });
      return false;
    }
  };

  const removeFromFavorites = async (favoriteId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      toast({
        title: "Removed from favorites",
        description: "Item removed from favorites successfully"
      });
      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from favorites",
        variant: "destructive"
      });
      return false;
    }
  };

  const removeFromFavoritesByContent = async (
    contentType: 'movie' | 'episode' | 'season' | 'tv_show',
    contentId: string
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      toast({
        title: "Removed from favorites",
        description: "Item removed from favorites successfully"
      });
      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from favorites",
        variant: "destructive"
      });
      return false;
    }
  };

  const isFavorite = (contentType: 'movie' | 'episode' | 'season' | 'tv_show', contentId: string) => {
    return favorites.some(
      favorite => favorite.content_type === contentType && favorite.content_id === contentId
    );
  };

  const toggleFavorite = async (
    contentType: 'movie' | 'episode' | 'season' | 'tv_show',
    contentId: string
  ) => {
    if (isFavorite(contentType, contentId)) {
      return await removeFromFavoritesByContent(contentType, contentId);
    } else {
      return await addToFavorites(contentType, contentId);
    }
  };

  const clearFavorites = async () => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
      toast({
        title: "Favorites cleared",
        description: "All favorites have been removed"
      });
      return true;
    } catch (error) {
      console.error('Error clearing favorites:', error);
      toast({
        title: "Error",
        description: "Failed to clear favorites",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    favorites,
    loading,
    addToFavorites,
    removeFromFavorites,
    removeFromFavoritesByContent,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    refetch
  };
};