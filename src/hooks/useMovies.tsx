import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Movie {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  landscape_poster_url?: string;
  slider_cover_url?: string;
  trailer_url?: string;
  video_url?: string;
  price: number;
  genre_id?: string;
  genre?: {
    id: string;
    name: string;
  };
  rating?: string;
  language?: string;
  duration?: number;
  release_date?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface TVShow {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  landscape_poster_url?: string;
  slider_cover_url?: string;
  price: number;
  genre_id?: string;
  genre?: {
    id: string;
    name: string;
  };
  rating?: string;
  language?: string;
  release_date?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export type Content = (Movie | TVShow) & {
  content_type: 'movie' | 'tv_show';
};

export const useMovies = (includeApprovedOnly = true) => {
  const { data: movies = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['movies', includeApprovedOnly],
    queryFn: async () => {
      let query = supabase
        .from('movies')
        .select(`
          *,
          genre:genres(id, name)
        `)
        .order('created_at', { ascending: false });

      if (includeApprovedOnly) {
        query = query.eq('status', 'approved');
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch movies",
          variant: "destructive",
        });
        throw error;
      }
      
      // Ensure data consistency with proper mapping
      return (data || []).map(movie => ({
        ...movie,
        genre: movie.genre ? {
          id: movie.genre.id,
          name: movie.genre.name
        } : undefined
      }));
    }
  });

  return {
    movies,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  };
};

export const useTVShows = (includeApprovedOnly = true) => {
  const { data: tvShows = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['tvShows', includeApprovedOnly],
    queryFn: async () => {
      let query = supabase
        .from('tv_shows')
        .select(`
          *,
          genre:genres(id, name)
        `)
        .order('created_at', { ascending: false });

      if (includeApprovedOnly) {
        query = query.eq('status', 'approved');
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch TV shows",
          variant: "destructive",
        });
        throw error;
      }
      
      return data || [];
    }
  });

  return {
    tvShows,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  };
};

export const useAllContent = (includeApprovedOnly = true) => {
  const { movies, loading: moviesLoading } = useMovies(includeApprovedOnly);
  const { tvShows, loading: tvShowsLoading } = useTVShows(includeApprovedOnly);

  const content: Content[] = [
    ...movies.map(movie => ({ ...movie, content_type: 'movie' as const })),
    ...tvShows.map(show => ({ ...show, content_type: 'tv_show' as const }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    content,
    loading: moviesLoading || tvShowsLoading,
    movies,
    tvShows
  };
};