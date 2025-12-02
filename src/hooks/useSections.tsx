import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Section {
  id: string;
  title: string;
  subtitle?: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export const useSections = () => {
  const queryClient = useQueryClient();
  
  const { data: sections = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .order('display_order');

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch sections",
          variant: "destructive",
        });
        throw error;
      }
      
      return data || [];
    }
  });

  const createSection = async (section: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('sections')
        .insert(section);

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast({
        title: "Success",
        description: "Section created successfully",
      });
    } catch (error) {
      console.error('Error creating section:', error);
      toast({
        title: "Error",
        description: "Failed to create section",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateSection = async (id: string, updates: Partial<Section>) => {
    try {
      const { error } = await supabase
        .from('sections')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast({
        title: "Success",
        description: "Section updated successfully",
      });
    } catch (error) {
      console.error('Error updating section:', error);
      toast({
        title: "Error",
        description: "Failed to update section",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteSection = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast({
        title: "Success",
        description: "Section deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting section:', error);
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    sections,
    loading,
    createSection,
    updateSection,
    deleteSection,
    refetch
  };
};
