import { useState, useEffect } from 'react';
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
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) throw error;

      // Enrich with content details
      const enrichedFavorites = await Promise.all(
        (data || []).map(async (item) => {
          let contentDetails = {};
          
          if (item.content_type === 'movie') {
            const { data: movieData } = await supabase
              .from('movies')
              .select('title, thumbnail_url, duration, price, description, genre_id, genres(name)')
              .eq('id', item.content_id)
              .single();
            
            if (movieData) {
              contentDetails = {
                title: movieData.title,
                thumbnail_url: movieData.thumbnail_url,
                duration: movieData.duration,
                price: movieData.price,
                description: movieData.description,
                genre: movieData.genres?.name
              };
            }
          } else if (item.content_type === 'tv_show') {
            const { data: showData } = await supabase
              .from('tv_shows')
              .select('title, thumbnail_url, price, description, genre_id, genres(name)')
              .eq('id', item.content_id)
              .single();
            
            if (showData) {
              contentDetails = {
                title: showData.title,
                thumbnail_url: showData.thumbnail_url,
                price: showData.price,
                description: showData.description,
                genre: showData.genres?.name
              };
            }
          } else if (item.content_type === 'season') {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select(`
                season_number,
                description,
                price,
                tv_shows!inner(
                  title,
                  thumbnail_url,
                  genre_id,
                  genres(name)
                )
              `)
              .eq('id', item.content_id)
              .single();
            
            if (seasonData) {
              contentDetails = {
                title: `${seasonData.tv_shows.title} - Season ${seasonData.season_number}`,
                thumbnail_url: seasonData.tv_shows.thumbnail_url,
                price: seasonData.price,
                description: seasonData.description,
                genre: seasonData.tv_shows.genres?.name
              };
            }
          } else if (item.content_type === 'episode') {
            const { data: episodeData } = await supabase
              .from('episodes')
              .select(`
                title, 
                duration, 
                price,
                seasons!inner(
                  season_number,
                  tv_shows!inner(
                    title,
                    thumbnail_url,
                    genre_id,
                    genres(name)
                  )
                )
              `)
              .eq('id', item.content_id)
              .single();
            
            if (episodeData) {
              contentDetails = {
                title: `${episodeData.seasons.tv_shows.title} S${episodeData.seasons.season_number} - ${episodeData.title}`,
                thumbnail_url: episodeData.seasons.tv_shows.thumbnail_url,
                duration: episodeData.duration,
                price: episodeData.price,
                genre: episodeData.seasons.tv_shows.genres?.name
              };
            }
          }

          return { ...item, ...contentDetails };
        })
      );

      const typedFavorites = enrichedFavorites as FavoriteItem[];
      setFavorites(typedFavorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast({
        title: "Error",
        description: "Failed to load favorites",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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

      await fetchFavorites();
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

      await fetchFavorites();
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

      await fetchFavorites();
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

      await fetchFavorites();
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

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  // Set up real-time subscription for favorites updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('favorites_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    favorites,
    loading,
    addToFavorites,
    removeFromFavorites,
    removeFromFavoritesByContent,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    refetch: fetchFavorites
  };
};