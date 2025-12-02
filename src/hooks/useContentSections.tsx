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
      // OPTIMIZED: Single query for all sections
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .eq('is_visible', true)
        .order('display_order');

      if (sectionsError) throw sectionsError;
      if (!sections?.length) return [];

      const sectionIds = sections.map(s => s.id);

      // OPTIMIZED: Single query for all content sections across all sections
      const { data: allContentSections, error: csError } = await supabase
        .from('content_sections')
        .select('*')
        .in('section_id', sectionIds)
        .order('display_order');

      if (csError) throw csError;
      if (!allContentSections?.length) return sections.map(s => ({ ...s, content: [] }));

      // Get unique content IDs by type
      const movieIds = [...new Set(allContentSections.filter(cs => cs.content_type === 'movie').map(cs => cs.content_id))];
      const tvShowIds = [...new Set(allContentSections.filter(cs => cs.content_type === 'tv_show').map(cs => cs.content_id))];

      // OPTIMIZED: Parallel queries for all movies and TV shows at once
      const [moviesResult, tvShowsResult] = await Promise.all([
        movieIds.length > 0 
          ? supabase.from('movies').select('id, title, description, thumbnail_url, price, rating, release_date, duration, genre:genres(name)').in('id', movieIds).eq('status', 'approved')
          : Promise.resolve({ data: [] }),
        tvShowIds.length > 0
          ? supabase.from('tv_shows').select('id, title, description, thumbnail_url, price, rating, release_date, genre:genres(name)').in('id', tvShowIds).eq('status', 'approved')
          : Promise.resolve({ data: [] })
      ]);

      // Create lookup maps for O(1) access
      const moviesMap = new Map((moviesResult.data || []).map(m => [m.id, m]));
      const tvShowsMap = new Map((tvShowsResult.data || []).map(t => [t.id, t]));

      // Build final result efficiently
      return sections.map(section => ({
        ...section,
        content: allContentSections
          .filter(cs => cs.section_id === section.id)
          .map(cs => {
            const item = cs.content_type === 'movie' 
              ? moviesMap.get(cs.content_id)
              : tvShowsMap.get(cs.content_id);
            if (!item) return null;
            return {
              ...item,
              content_type: cs.content_type,
              display_order: cs.display_order,
              genre: item.genre?.name
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.display_order - b.display_order)
      }));
    }
  });

  return {
    sectionsWithContent,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  };
};