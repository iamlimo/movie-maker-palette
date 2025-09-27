import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadFile {
  file: File;
  fileType: 'video' | 'thumbnail' | 'trailer';
  id: string;
}

interface UploadProgress {
  id: string;
  fileName: string;
  fileType: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
  filePath?: string;
}

interface UploadResult {
  url: string;
  filePath: string;
  fileType: string;
}

export const useDeferredUpload = () => {
  const [stagedFiles, setStagedFiles] = useState<UploadFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const stageFile = useCallback((file: File, fileType: 'video' | 'thumbnail' | 'trailer') => {
    const id = `${fileType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const uploadFile: UploadFile = { file, fileType, id };
    
    setStagedFiles(prev => {
      // Remove any existing file of the same type
      const filtered = prev.filter(f => f.fileType !== fileType);
      return [...filtered, uploadFile];
    });

    setUploadProgress(prev => {
      const filtered = prev.filter(p => p.fileType !== fileType);
      return [...filtered, {
        id,
        fileName: file.name,
        fileType,
        progress: 0,
        status: 'pending'
      }];
    });

    toast({
      title: "File Staged",
      description: `${fileType} "${file.name}" ready for upload`,
    });

    return id;
  }, [toast]);

  const removeFile = useCallback((fileType: string) => {
    setStagedFiles(prev => prev.filter(f => f.fileType !== fileType));
    setUploadProgress(prev => prev.filter(p => p.fileType !== fileType));
  }, []);

  const uploadSingleFile = async (uploadFile: UploadFile): Promise<UploadResult> => {
    const { file, fileType, id } = uploadFile;
    
    console.log(`[DeferredUpload] Starting upload for ${fileType}:`, {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Update progress to uploading
    setUploadProgress(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'uploading', progress: 10 } : p
    ));

    try {
      // Get upload info from unified media upload function
      const { data: uploadInfo, error: infoError } = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: file.name,
          fileType: fileType,
          contentType: file.type
        }
      });

      if (infoError) {
        console.error(`[DeferredUpload] Function invocation error:`, infoError);
        throw new Error(`Failed to get upload info: ${infoError.message}`);
      }

      if (!uploadInfo) {
        console.error(`[DeferredUpload] No response from function`);
        throw new Error('No response from upload function');
      }

      if (!uploadInfo.success || !uploadInfo.uploadUrl) {
        console.error(`[DeferredUpload] Invalid response:`, uploadInfo);
        throw new Error(`Failed to get upload URL: ${uploadInfo.error || 'Unknown error'}`);
      }

      // Update progress
      setUploadProgress(prev => prev.map(p => 
        p.id === id ? { ...p, progress: 25 } : p
      ));

      // Upload file with progress tracking
      const uploadPromise = new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 65) + 25; // 25-90%
            setUploadProgress(prev => prev.map(p => 
              p.id === id ? { ...p, progress } : p
            ));
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed due to network error'));
        
        xhr.open('PUT', uploadInfo.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await uploadPromise;

      // Update progress
      setUploadProgress(prev => prev.map(p => 
        p.id === id ? { ...p, progress: 90 } : p
      ));

      // File uploaded successfully, get public URL
      const publicUrl = uploadInfo.publicUrl;

      // Mark as completed
      setUploadProgress(prev => prev.map(p => 
        p.id === id ? { 
          ...p, 
          progress: 100, 
          status: 'completed',
          url: publicUrl,
          filePath: uploadInfo.filePath
        } : p
      ));

      console.log(`[DeferredUpload] ${fileType} upload completed successfully`);

      return {
        url: publicUrl,
        filePath: uploadInfo.filePath,
        fileType
      };

    } catch (error) {
      console.error(`[DeferredUpload] Upload failed for ${fileType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setUploadProgress(prev => prev.map(p => 
        p.id === id ? { 
          ...p, 
          status: 'error', 
          error: errorMessage,
          progress: 0
        } : p
      ));

      throw error;
    }
  };

  const uploadAllFiles = useCallback(async (): Promise<UploadResult[]> => {
    if (stagedFiles.length === 0) {
      return [];
    }

    setIsUploading(true);
    const results: UploadResult[] = [];
    
    try {
      console.log(`[DeferredUpload] Starting batch upload of ${stagedFiles.length} files`);

      // Upload files sequentially to avoid overwhelming the server
      for (const uploadFile of stagedFiles) {
        try {
          const result = await uploadSingleFile(uploadFile);
          results.push(result);
        } catch (error) {
          // Continue with other uploads even if one fails
          console.error(`[DeferredUpload] Failed to upload ${uploadFile.fileType}:`, error);
        }
      }

      const successCount = results.length;
      const failureCount = stagedFiles.length - successCount;

      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${successCount} file(s) uploaded successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        });
      }

      if (failureCount > 0 && successCount === 0) {
        toast({
          title: "Upload Failed",
          description: "All uploads failed. Please check your files and try again.",
          variant: "destructive",
        });
      }

      return results;

    } catch (error) {
      console.error('[DeferredUpload] Batch upload failed:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
      return results;
    } finally {
      setIsUploading(false);
    }
  }, [stagedFiles, toast]);

  const retryFailedUploads = useCallback(async () => {
    const failedFiles = stagedFiles.filter(f => {
      const progress = uploadProgress.find(p => p.id === f.id);
      return progress?.status === 'error';
    });

    if (failedFiles.length === 0) return [];

    // Reset failed files to pending
    setUploadProgress(prev => prev.map(p => 
      p.status === 'error' ? { ...p, status: 'pending', progress: 0, error: undefined } : p
    ));

    // Try uploading failed files
    const results: UploadResult[] = [];
    for (const file of failedFiles) {
      try {
        const result = await uploadSingleFile(file);
        results.push(result);
      } catch (error) {
        console.error(`[DeferredUpload] Retry failed for ${file.fileType}:`, error);
      }
    }

    return results;
  }, [stagedFiles, uploadProgress]);

  const clearAllFiles = useCallback(() => {
    setStagedFiles([]);
    setUploadProgress([]);
  }, []);

  const getFileByType = useCallback((fileType: string) => {
    return stagedFiles.find(f => f.fileType === fileType);
  }, [stagedFiles]);

  const getProgressByType = useCallback((fileType: string) => {
    return uploadProgress.find(p => p.fileType === fileType);
  }, [uploadProgress]);

  return {
    stagedFiles,
    uploadProgress,
    isUploading,
    stageFile,
    removeFile,
    uploadAllFiles,
    retryFailedUploads,
    clearAllFiles,
    getFileByType,
    getProgressByType
  };
};