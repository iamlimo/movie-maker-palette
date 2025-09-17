import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  url: string;
  filePath: string;
  bucket: string;
}

export const useContentUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (
    file: File, 
    fileType: 'video' | 'thumbnail' | 'landscape_poster' | 'slider_cover' | 'trailer'
  ): Promise<UploadResult | null> => {
    if (!file) {
      toast({
        title: "Error",
        description: "No file selected",
        variant: "destructive"
      });
      return null;
    }

    setIsUploading(true);
    
    try {
      // For large files, use chunked upload with retry logic
      if (file.size > 50 * 1024 * 1024) { // 50MB
        return await uploadLargeFile(file, fileType);
      }

      const { data, error } = await supabase.functions.invoke(`file-upload?type=${fileType}&filename=${encodeURIComponent(file.name)}`, {
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        method: 'POST'
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      toast({
        title: "Upload Successful",
        description: `${fileType} uploaded successfully`,
      });

      return {
        url: data.url,
        filePath: data.filePath,
        bucket: data.bucket
      };

    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Fallback for free tier issues
      if (error.message?.includes('timeout') || error.message?.includes('Function timeout')) {
        toast({
          title: "Upload Taking Longer",
          description: "Large file upload in progress. Please wait...",
        });
        
        // Retry with exponential backoff
        return await retryUpload(file, fileType, 3);
      }

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive"
      });
      return null;
      
    } finally {
      setIsUploading(false);
    }
  };

  const uploadLargeFile = async (
    file: File, 
    fileType: string
  ): Promise<UploadResult | null> => {
    try {
      // Get signed upload URL first
      const { data: signedData, error: signedError } = await supabase.functions.invoke(`file-upload?action=signed-url&type=${fileType}&filename=${encodeURIComponent(file.name)}`, {
        method: 'GET'
      });

      if (signedError || !signedData.success) {
        throw new Error(signedData?.error || 'Failed to get upload URL');
      }

      // Upload directly to signed URL
      const uploadResponse = await fetch(signedData.signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to signed URL');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(signedData.bucket)
        .getPublicUrl(signedData.filePath);

      return {
        url: urlData.publicUrl,
        filePath: signedData.filePath,
        bucket: signedData.bucket
      };

    } catch (error: any) {
      console.error('Large file upload error:', error);
      throw error;
    }
  };

  const retryUpload = async (
    file: File, 
    fileType: string, 
    maxRetries: number,
    delay: number = 2000
  ): Promise<UploadResult | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        
        const { data, error } = await supabase.functions.invoke(`file-upload?type=${fileType}&filename=${encodeURIComponent(file.name)}`, {
          body: file,
          headers: {
            'Content-Type': file.type,
          },
          method: 'POST'
        });

        if (error) throw error;
        if (data.success) {
          toast({
            title: "Upload Successful",
            description: `${fileType} uploaded after ${attempt} attempt(s)`,
          });
          return data;
        }
        
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(`Upload attempt ${attempt} failed, retrying...`);
      }
    }
    
    return null;
  };

  return {
    uploadFile,
    isUploading
  };
};