import { useState, useEffect } from 'react';
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

export interface ContentSection {
  id: string;
  content_id: string;
  content_type: 'movie' | 'tv_show';
  section_id: string;
  display_order: number;
  created_at: string;
}

export const useSections = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('sections', {
        method: 'GET'
      });

      if (error) throw error;
      setSections(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching sections:', err);
      setError(err.message);
      toast({
        title: "Error",
        description: "Failed to fetch sections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSection = async (sectionData: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase.functions.invoke('sections', {
        method: 'POST',
        body: sectionData
      });

      if (error) throw error;
      
      setSections(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Section created successfully",
      });
      
      return data;
    } catch (err: any) {
      console.error('Error creating section:', err);
      toast({
        title: "Error",
        description: "Failed to create section",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateSection = async (id: string, updates: Partial<Section>) => {
    try {
      const { data, error } = await supabase.functions.invoke(`sections/${id}`, {
        method: 'PUT',
        body: updates
      });

      if (error) throw error;
      
      setSections(prev => prev.map(section => 
        section.id === id ? { ...section, ...data } : section
      ));
      
      toast({
        title: "Success",
        description: "Section updated successfully",
      });
      
      return data;
    } catch (err: any) {
      console.error('Error updating section:', err);
      toast({
        title: "Error",
        description: "Failed to update section",
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteSection = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke(`sections/${id}`, {
        method: 'DELETE'
      });

      if (error) throw error;
      
      setSections(prev => prev.filter(section => section.id !== id));
      toast({
        title: "Success",
        description: "Section deleted successfully",
      });
    } catch (err: any) {
      console.error('Error deleting section:', err);
      toast({
        title: "Error",
        description: "Failed to delete section",
        variant: "destructive",
      });
      throw err;
    }
  };

  const reorderSections = async (reorderedSections: { id: string; display_order: number }[]) => {
    try {
      const updates = reorderedSections.map(section => 
        supabase
          .from('sections')
          .update({ display_order: section.display_order })
          .eq('id', section.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(result => result.error);
      
      if (errors.length > 0) {
        throw new Error('Failed to reorder sections');
      }

      // Update local state
      setSections(prev => {
        const updated = [...prev];
        reorderedSections.forEach(({ id, display_order }) => {
          const index = updated.findIndex(s => s.id === id);
          if (index !== -1) {
            updated[index].display_order = display_order;
          }
        });
        return updated.sort((a, b) => a.display_order - b.display_order);
      });

      toast({
        title: "Success",
        description: "Sections reordered successfully",
      });
    } catch (err: any) {
      console.error('Error reordering sections:', err);
      toast({
        title: "Error",
        description: "Failed to reorder sections",
        variant: "destructive",
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  return {
    sections,
    loading,
    error,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    refetch: fetchSections
  };
};