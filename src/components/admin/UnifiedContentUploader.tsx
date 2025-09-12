import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Video, Image, FileText, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export type MediaType = 'thumbnail' | 'landscape_poster' | 'slider_cover' | 'video' | 'trailer';

interface UnifiedContentUploaderProps {
  onUploadComplete: (url: string, filePath: string) => void;
  mediaType: MediaType;
  label: string;
  description: string;
  currentUrl?: string;
  required?: boolean;
  autoUpload?: boolean;
}

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  error: string | null;
  completed: boolean;
}

export const UnifiedContentUploader = ({
  onUploadComplete,
  mediaType,
  label,
  description,
  currentUrl,
  required = false,
  autoUpload = true
}: UnifiedContentUploaderProps) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    uploading: false,
    progress: 0,
    error: null,
    completed: false
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Media type configuration
  const getMediaConfig = () => {
    switch (mediaType) {
      case 'thumbnail':
        return {
          accept: 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
          maxSize: 10 * 1024 * 1024, // 10MB
          icon: Image,
          supportedFormats: 'JPEG, PNG, WebP, GIF'
        };
      case 'landscape_poster':
        return {
          accept: 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
          maxSize: 10 * 1024 * 1024, // 10MB
          icon: Monitor,
          supportedFormats: 'JPEG, PNG, WebP, GIF'
        };
      case 'slider_cover':
        return {
          accept: 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
          maxSize: 10 * 1024 * 1024, // 10MB
          icon: Image,
          supportedFormats: 'JPEG, PNG, WebP, GIF'
        };
      case 'video':
        return {
          accept: 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/mpeg,video/3gpp,video/mov',
          maxSize: 2 * 1024 * 1024 * 1024, // 2GB
          icon: Video,
          supportedFormats: 'MP4, WebM, OGG, MOV, AVI'
        };
      case 'trailer':
        return {
          accept: 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/mpeg,video/3gpp,video/mov',
          maxSize: 500 * 1024 * 1024, // 500MB
          icon: Video,
          supportedFormats: 'MP4, WebM, OGG, MOV, AVI'
        };
      default:
        return {
          accept: '*/*',
          maxSize: 10 * 1024 * 1024,
          icon: FileText,
          supportedFormats: 'All files'
        };
    }
  };

  const config = getMediaConfig();
  const IconComponent = config.icon;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File) => {
    const allowedTypes = config.accept.split(',').map(type => type.trim());
    const isValidType = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return `File type ${file.type} is not supported. Supported formats: ${config.supportedFormats}`;
    }

    if (file.size > config.maxSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(config.maxSize)})`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    console.log(`[UnifiedContentUploader] Starting ${mediaType} upload:`, {
      name: file.name,
      size: file.size,
      type: file.type
    });

    try {
      setUploadState(prev => ({ ...prev, uploading: true, progress: 0, error: null }));

      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to upload files');
      }

      console.log(`[UnifiedContentUploader] User authenticated, proceeding with upload...`);

      // Get upload info from unified edge function
      const { data: uploadInfo, error: infoError } = await supabase.functions.invoke('content-upload', {
        body: {
          action: 'get_upload_info',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          mediaType: mediaType
        }
      });

      console.log(`[UnifiedContentUploader] Upload info response:`, { uploadInfo, infoError });

      if (infoError) {
        console.error(`[UnifiedContentUploader] Function invoke error:`, infoError);
        throw new Error(`Failed to get upload info: ${infoError.message || 'Unknown error'}`);
      }

      if (!uploadInfo?.uploadUrl) {
        console.error(`[UnifiedContentUploader] Invalid upload info structure:`, uploadInfo);
        throw new Error(uploadInfo?.error || 'Failed to get upload URL from server');
      }

      setUploadState(prev => ({ ...prev, progress: 25 }));

      // Upload file using signed URL with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 75) + 25; // 25-100%
          setUploadState(prev => ({ ...prev, progress }));
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed due to network error'));
      });

      xhr.open('PUT', uploadInfo.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

      await uploadPromise;

      console.log(`[UnifiedContentUploader] File uploaded successfully, confirming...`);

      // Confirm upload
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke('content-upload', {
        body: {
          action: 'confirm_upload',
          filePath: uploadInfo.filePath,
          bucket: uploadInfo.bucket
        }
      });

      console.log(`[UnifiedContentUploader] Confirm response:`, { confirmData, confirmError });

      if (confirmError) {
        throw new Error(`Failed to confirm upload: ${confirmError.message}`);
      }

      if (!confirmData?.publicUrl) {
        throw new Error(confirmData?.error || 'Failed to get public URL from server');
      }

      setUploadState(prev => ({ 
        ...prev, 
        uploading: false, 
        progress: 100, 
        completed: true,
        error: null 
      }));

      toast({
        title: "Upload Successful",
        description: `${label} uploaded and optimized successfully`,
      });

      onUploadComplete(confirmData.publicUrl || '', uploadInfo.filePath);
      
    } catch (error) {
      console.error(`[UnifiedContentUploader] Upload failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setUploadState(prev => ({ 
        ...prev, 
        uploading: false, 
        error: errorMessage,
        progress: 0 
      }));

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    if (validation) {
      setUploadState(prev => ({ ...prev, error: validation }));
      toast({
        title: "Invalid File",
        description: validation,
        variant: "destructive",
      });
      return;
    }

    setUploadState(prev => ({ 
      ...prev, 
      file, 
      error: null, 
      completed: false,
      progress: 0 
    }));

    // Auto-upload if enabled
    if (autoUpload) {
      uploadFile(file);
    }
  }, [mediaType, toast, autoUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const clearFile = () => {
    setUploadState({
      file: null,
      uploading: false,
      progress: 0,
      error: null,
      completed: false
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {required && (
            <span className="px-2 py-1 rounded-full bg-destructive/10 text-xs text-destructive border border-destructive/20">
              Required
            </span>
          )}
          <div className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
            Max: {formatFileSize(config.maxSize)}
          </div>
        </div>
      </div>

      {/* Current file preview */}
      {currentUrl && !uploadState.file && !uploadState.completed && (
        <Card className="p-4 border-border bg-card">
          <div className="flex items-center gap-3">
            <IconComponent className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Current {mediaType.replace('_', ' ')}</p>
              <p className="text-xs text-muted-foreground">File already uploaded</p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
        </Card>
      )}

      {/* Upload area */}
      <Card 
        className={`
          transition-all duration-300 cursor-pointer border-2 border-dashed
          ${dragOver 
            ? 'border-primary bg-primary/5' 
            : uploadState.error 
              ? 'border-destructive bg-destructive/5'
              : 'border-border hover:border-primary/50 hover:bg-card/50'
          }
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploadState.uploading && fileInputRef.current?.click()}
      >
        <div className="p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept={config.accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
            disabled={uploadState.uploading}
          />

          {!uploadState.file ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <IconComponent className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-foreground mb-2">
                  Drop your {mediaType.replace('_', ' ')} here
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse files
                </p>
                <Button variant="outline" type="button">
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: {config.supportedFormats}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File info */}
              <div className="flex items-center gap-3">
                <IconComponent className="h-10 w-10 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {uploadState.file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(uploadState.file.size)}
                  </p>
                </div>
                {!uploadState.uploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Progress */}
              {uploadState.uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">Uploading and optimizing...</span>
                    <span className="text-muted-foreground">{uploadState.progress}%</span>
                  </div>
                  <Progress value={uploadState.progress} className="h-2" />
                </div>
              )}

              {/* Error */}
              {uploadState.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{uploadState.error}</p>
                </div>
              )}

              {/* Success */}
              {uploadState.completed && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-600">Upload completed and optimized successfully!</p>
                </div>
              )}

              {/* Actions */}
              {uploadState.file && !uploadState.uploading && !uploadState.completed && !autoUpload && (
                <div className="flex gap-2">
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      uploadFile(uploadState.file!);
                    }}
                    className="flex-1"
                    disabled={!!uploadState.error}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {mediaType.replace('_', ' ')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};