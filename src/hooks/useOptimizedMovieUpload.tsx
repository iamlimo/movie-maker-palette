import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDeferredUpload } from './useDeferredUpload';

export interface MovieFormData {
  title: string;
  description: string;
  genre_id: string;
  release_date: string;
  duration: string;
  language: string;
  rating: string;
  price: string;
  rental_expiry_duration: string;
}

export interface MovieCastAssignment {
  cast_crew_id: string;
  role_type: 'actor' | 'director' | 'producer' | 'writer';
  character_name?: string;
  credit_order: number;
}

export const useOptimizedMovieUpload = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const deferredUpload = useDeferredUpload();

  const validateMovieData = useCallback((formData: MovieFormData) => {
    const errors: string[] = [];
    
    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.price || parseFloat(formData.price) <= 0) errors.push("Valid price is required");
    if (!formData.description?.trim()) errors.push("Description is required");
    if (!formData.genre_id) errors.push("Genre is required");
    
    // Check required media files
    const hasVideo = deferredUpload.getFileByType('video');
    const hasThumbnail = deferredUpload.getFileByType('thumbnail');
    
    if (!hasVideo) errors.push("Video file is required");
    if (!hasThumbnail) errors.push("Thumbnail is required");
    
    return errors;
  }, [deferredUpload.getFileByType]);

  const createMovie = useCallback(async (
    formData: MovieFormData,
    castAssignments: MovieCastAssignment[] = []
  ) => {
    setIsSubmitting(true);
    
    try {
      // Validate form data
      const validationErrors = validateMovieData(formData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(", "));
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }

      console.log('[OptimizedMovieUpload] Starting upload process');

      // Upload all staged files
      const uploadResults = await deferredUpload.uploadAllFiles();
      
      // Ensure required uploads succeeded
      const videoResult = uploadResults.find(r => r.fileType === 'video');
      const thumbnailResult = uploadResults.find(r => r.fileType === 'thumbnail');
      const trailerResult = uploadResults.find(r => r.fileType === 'trailer');

      if (!videoResult) {
        throw new Error('Video upload failed - cannot create movie without video');
      }

      if (!thumbnailResult) {
        throw new Error('Thumbnail upload failed - cannot create movie without thumbnail');
      }

      // Prepare optimized movie payload
      const moviePayload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        genre_id: formData.genre_id || null,
        release_date: formData.release_date || null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        language: formData.language?.trim() || null,
        rating: formData.rating || null,
        price: parseFloat(formData.price),
        rental_expiry_duration: parseInt(formData.rental_expiry_duration),
        video_url: videoResult.filePath,
        thumbnail_url: thumbnailResult.filePath,
        trailer_url: trailerResult?.filePath || null,
        landscape_poster_url: thumbnailResult.filePath,
        slider_cover_url: thumbnailResult.filePath
      };

      console.log('[OptimizedMovieUpload] Creating movie with:', moviePayload);

      // Create movie via unified content manager
      const { data: movieResponse, error: movieError } = await supabase.functions.invoke('unified-content-manager', {
        body: moviePayload
      });

      if (movieError || !movieResponse?.success) {
        throw movieError || new Error('Failed to create movie');
      }

      const movie = movieResponse.movie;
      console.log('[OptimizedMovieUpload] Movie created:', movie.id);

      // Save cast and crew assignments if provided
      if (castAssignments.length > 0) {
        const assignmentsToInsert = castAssignments.map(assignment => ({
          movie_id: movie.id,
          cast_crew_id: assignment.cast_crew_id,
          role_type: assignment.role_type,
          character_name: assignment.character_name || null,
          credit_order: assignment.credit_order
        }));

        const { error: castError } = await supabase
          .from('movie_cast')
          .insert(assignmentsToInsert);

        if (castError) {
          console.error('[OptimizedMovieUpload] Cast assignment error:', castError);
          // Don't fail the whole operation for cast errors
          toast({
            title: "Warning",
            description: "Movie created but some cast assignments failed",
            variant: "destructive",
          });
        }
      }

      // Clear uploaded files after successful creation
      deferredUpload.clearAllFiles();

      toast({
        title: "Success",
        description: "Movie created successfully with all media files",
      });

      return movie;

    } catch (error) {
      console.error('[OptimizedMovieUpload] Error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create movie";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [validateMovieData, deferredUpload, toast]);

  return {
    ...deferredUpload,
    isSubmitting,
    isUploading: deferredUpload.isUploading,
    createMovie,
    validateMovieData
  };
};