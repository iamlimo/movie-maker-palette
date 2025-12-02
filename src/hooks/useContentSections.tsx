import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ContentSection {
  id: string;
  content_id: string;
  content_type: 'movie' | 'tv_show';
  section_id: string;
  display_order: number;
  created_at: string;
}

export interface SectionWithContent {
  id: string;
  title: string;
  subtitle?: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  content: Array<{
    id: string;
    title: string;
    description?: string;
    thumbnail_url?: string;
    price: number;
    genre?: string;
    rating?: string;
    content_type: 'movie' | 'tv_show';
    display_order: number;
    release_date?: string;
    duration?: number;
  }>;
}

export const useContentSections = () => {
  const queryClient = useQueryClient();
  
  const { data: contentSections = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['contentSections'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('content-sections', {
        method: 'GET'
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch content sections",
          variant: "destructive",
        });
        throw error;
      }
      
      return data || [];
    }
  });

  const assignContentToSection = async (assignments: Array<{
    content_id: string;
    content_type: 'movie' | 'tv_show';
    section_id: string;
    display_order?: number;
  }>) => {
    try {
      const { data, error } = await supabase.functions.invoke('content-sections', {
        method: 'POST',
        body: assignments
      });

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['contentSections'] });
      toast({
        title: "Success",
        description: "Content assigned to section successfully",
      });
      
      return data;
    } catch (err: any) {
      console.error('Error assigning content to section:', err);
      toast({
        title: "Error",
        description: "Failed to assign content to section",
        variant: "destructive",
      });
      throw err;
    }
  };

  const removeContentFromSection = async (contentId: string, contentType: 'movie' | 'tv_show') => {
    try {
      const { error } = await supabase.functions.invoke('content-sections', {
        method: 'DELETE',
        body: { content_id: contentId, content_type: contentType }
      });

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['contentSections'] });
      toast({
        title: "Success",
        description: "Content removed from section successfully",
      });
    } catch (err: any) {
      console.error('Error removing content from section:', err);
      toast({
        title: "Error",
        description: "Failed to remove content from section",
        variant: "destructive",
      });
      throw err;
    }
  };

  const reorderContent = async (reorderedContent: Array<{ id: string; display_order: number }>) => {
    try {
      const { error } = await supabase.functions.invoke('content-sections', {
        method: 'PUT',
        body: { reorder: reorderedContent }
      });

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['contentSections'] });
      toast({
        title: "Success",
        description: "Content reordered successfully",
      });
    } catch (err: any) {
      console.error('Error reordering content:', err);
      toast({
        title: "Error",
        description: "Failed to reorder content",
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    contentSections,
    loading,
    error: error ? (error as Error).message : null,
    assignContentToSection,
    removeContentFromSection,
    reorderContent,
    refetch
  };
};

export const useSectionsWithContent = () => {
  const { data: sectionsWithContent = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['sectionsWithContent'],
    queryFn: async () => {
      // First get all visible sections
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .eq('is_visible', true)
        .order('display_order');

      if (sectionsError) throw sectionsError;

      const sectionsWithContent: SectionWithContent[] = [];

      // For each section, get its content
      for (const section of sections || []) {
        // Get movies for this section
        const { data: movieSections, error: movieError } = await supabase
          .from('content_sections')
          .select(`
            id,
            content_id,
            content_type,
            display_order
          `)
          .eq('section_id', section.id)
          .eq('content_type', 'movie')
          .order('display_order');

        // Get TV shows for this section
        const { data: tvShowSections, error: tvError } = await supabase
          .from('content_sections')
          .select(`
            id,
            content_id,
            content_type,
            display_order
          `)
          .eq('section_id', section.id)
          .eq('content_type', 'tv_show')
          .order('display_order');

        if (movieError || tvError) {
          console.error('Error fetching content for section:', section.id, { movieError, tvError });
          continue;
        }

        const content = [];

        // Fetch movie details
        if (movieSections && movieSections.length > 0) {
          const movieIds = movieSections.map(ms => ms.content_id);
          const { data: movies } = await supabase
            .from('movies')
            .select(`
              id,
              title,
              description,
              thumbnail_url,
              price,
              rating,
              release_date,
              duration,
              genre:genres(name)
            `)
            .in('id', movieIds)
            .eq('status', 'approved');

          if (movies) {
            movies.forEach(movie => {
              const movieSection = movieSections.find(ms => ms.content_id === movie.id);
              if (movieSection) {
                content.push({
                  ...movie,
                  content_type: 'movie' as const,
                  display_order: movieSection.display_order,
                  genre: movie.genre?.name,
                  release_date: movie.release_date,
                  duration: movie.duration
                });
              }
            });
          }
        }

        // Fetch TV show details
        if (tvShowSections && tvShowSections.length > 0) {
          const tvShowIds = tvShowSections.map(ts => ts.content_id);
          const { data: tvShows } = await supabase
            .from('tv_shows')
            .select(`
              id,
              title,
              description,
              thumbnail_url,
              price,
              rating,
              release_date,
              genre:genres(name)
            `)
            .in('id', tvShowIds)
            .eq('status', 'approved');

          if (tvShows) {
            tvShows.forEach(show => {
              const showSection = tvShowSections.find(ts => ts.content_id === show.id);
              if (showSection) {
                content.push({
                  ...show,
                  content_type: 'tv_show' as const,
                  display_order: showSection.display_order,
                  genre: show.genre?.name,
                  release_date: show.release_date,
                  duration: undefined // TV shows don't have duration at show level
                });
              }
            });
          }
        }

        // Sort content by display order
        content.sort((a, b) => a.display_order - b.display_order);

        sectionsWithContent.push({
          ...section,
          content
        });
      }

      return sectionsWithContent;
    }
  });

  return {
    sectionsWithContent,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  };
};