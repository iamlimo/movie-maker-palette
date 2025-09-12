import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ContentType = 'movie' | 'tv_show';

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  landscape_poster_url?: string;
  slider_cover_url?: string;
  video_url?: string;
  trailer_url?: string;
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
  content_type: ContentType;
  optimization_metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface ContentFormData {
  title: string;
  description: string;
  genre_id: string;
  release_date: string;
  duration?: string;
  language: string;
  rating: string;
  price: string;
  rental_expiry_duration: string;
  thumbnail_url?: string;
  landscape_poster_url?: string;
  slider_cover_url?: string;
  video_url?: string;
  trailer_url?: string;
}

export const useContentManager = (contentType: ContentType, includeApprovedOnly = true) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const tableName = contentType === 'movie' ? 'movies' : 'tv_shows';
      
      let query = supabase
        .from(tableName)
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
      
      // Map data to include content_type
      const mappedData = (data || []).map(item => ({
        ...item,
        content_type: contentType
      }));
      
      setContent(mappedData);
      setError(null);
    } catch (err: any) {
      console.error(`Error fetching ${contentType}s:`, err);
      setError(err.message);
      toast({
        title: "Error",
        description: `Failed to fetch ${contentType}s`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createContent = async (formData: ContentFormData): Promise<ContentItem | null> => {
    try {
      const tableName = contentType === 'movie' ? 'movies' : 'tv_shows';
      
      const contentData = {
        title: formData.title,
        description: formData.description || null,
        genre_id: formData.genre_id || null,
        release_date: formData.release_date || null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        language: formData.language || null,
        rating: formData.rating || null,
        price: parseFloat(formData.price),
        thumbnail_url: formData.thumbnail_url || null,
        landscape_poster_url: formData.landscape_poster_url || null,
        slider_cover_url: formData.slider_cover_url || null,
        video_url: formData.video_url || null,
        trailer_url: formData.trailer_url || null,
        status: 'approved' as const,
        rental_expiry_duration: parseInt(formData.rental_expiry_duration),
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        optimization_metadata: {
          created_with: 'unified_content_uploader',
          timestamp: new Date().toISOString()
        }
      };

      // Remove movie-specific fields for TV shows
      if (contentType === 'tv_show') {
        delete (contentData as any).duration;
        delete (contentData as any).rental_expiry_duration;
      }

      const { data: insertedContent, error } = await supabase
        .from(tableName)
        .insert([contentData])
        .select(`
          *,
          genre:genres(id, name)
        `)
        .single();

      if (error) throw error;

      const newContent = {
        ...insertedContent,
        content_type: contentType
      };

      setContent(prev => [newContent, ...prev]);
      
      toast({
        title: "Success",
        description: `${contentType === 'movie' ? 'Movie' : 'TV Show'} created successfully`,
      });

      return newContent;
    } catch (error: any) {
      console.error(`Error creating ${contentType}:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to create ${contentType}`,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateContent = async (id: string, updates: Partial<ContentFormData>): Promise<boolean> => {
    try {
      const tableName = contentType === 'movie' ? 'movies' : 'tv_shows';
      
      const updateData = {
        ...updates,
        price: updates.price ? parseFloat(updates.price) : undefined,
        duration: updates.duration ? parseInt(updates.duration) : undefined,
        rental_expiry_duration: updates.rental_expiry_duration ? parseInt(updates.rental_expiry_duration) : undefined,
        updated_at: new Date().toISOString()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setContent(prev => prev.map(item => 
        item.id === id ? { ...item, ...updateData } : item
      ));

      toast({
        title: "Success",
        description: `${contentType === 'movie' ? 'Movie' : 'TV Show'} updated successfully`,
      });

      return true;
    } catch (error: any) {
      console.error(`Error updating ${contentType}:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to update ${contentType}`,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteContent = async (id: string): Promise<boolean> => {
    try {
      const tableName = contentType === 'movie' ? 'movies' : 'tv_shows';
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setContent(prev => prev.filter(item => item.id !== id));

      toast({
        title: "Success",
        description: `${contentType === 'movie' ? 'Movie' : 'TV Show'} deleted successfully`,
      });

      return true;
    } catch (error: any) {
      console.error(`Error deleting ${contentType}:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to delete ${contentType}`,
        variant: "destructive",
      });
      return false;
    }
  };

  const approveContent = async (id: string): Promise<boolean> => {
    return updateContent(id, { status: 'approved' } as any);
  };

  const rejectContent = async (id: string): Promise<boolean> => {
    return updateContent(id, { status: 'rejected' } as any);
  };

  useEffect(() => {
    fetchContent();
  }, [contentType, includeApprovedOnly]);

  return {
    content,
    loading,
    error,
    fetchContent,
    createContent,
    updateContent,
    deleteContent,
    approveContent,
    rejectContent
  };
};

// Hook for unified content management across both movies and TV shows
export const useUnifiedContentManager = (includeApprovedOnly = true) => {
  const { content: movies, loading: moviesLoading, ...movieActions } = useContentManager('movie', includeApprovedOnly);
  const { content: tvShows, loading: tvShowsLoading, ...tvShowActions } = useContentManager('tv_show', includeApprovedOnly);

  const allContent: ContentItem[] = [
    ...movies,
    ...tvShows
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const loading = moviesLoading || tvShowsLoading;

  return {
    allContent,
    movies,
    tvShows,
    loading,
    movieActions,
    tvShowActions
  };
};