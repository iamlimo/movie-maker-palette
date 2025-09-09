import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Movie {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
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
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovies = async () => {
    try {
      setLoading(true);
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

      if (error) throw error;
      setMovies(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching movies:', err);
      setError(err.message);
      toast({
        title: "Error",
        description: "Failed to fetch movies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, [includeApprovedOnly]);

  return {
    movies,
    loading,
    error,
    refetch: fetchMovies
  };
};

export const useTVShows = (includeApprovedOnly = true) => {
  const [tvShows, setTVShows] = useState<TVShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTVShows = async () => {
    try {
      setLoading(true);
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

      if (error) throw error;
      setTVShows(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching TV shows:', err);
      setError(err.message);
      toast({
        title: "Error",
        description: "Failed to fetch TV shows",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTVShows();
  }, [includeApprovedOnly]);

  return {
    tvShows,
    loading,
    error,
    refetch: fetchTVShows
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