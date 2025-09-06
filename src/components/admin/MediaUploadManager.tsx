import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Video, Image, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MediaUploadManagerProps {
  onUploadComplete: (url: string, filePath: string) => void;
  accept: string;
  maxSize: number;
  label: string;
  description: string;
  fileType: 'video' | 'thumbnail' | 'trailer';
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

export const MediaUploadManager = ({
  onUploadComplete,
  accept,
  maxSize,
  label,
  description,
  fileType,
  currentUrl,
  required = false,
  autoUpload = false
}: MediaUploadManagerProps) => {
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

  const getFileIcon = () => {
    switch (fileType) {
      case 'video':
        return Video;
      case 'thumbnail':
        return Image;
      case 'trailer':
        return Video;
      default:
        return FileText;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File) => {
    const allowedTypes = accept.split(',').map(type => type.trim());
    const isValidType = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });

    if (!isValidType) {
      return `File type ${file.type} is not supported. Allowed types: ${accept}`;
    }

    if (file.size > maxSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    console.log(`[MediaUploadManager] Starting ${fileType} upload:`, {
      name: file.name,
      size: file.size,
      type: file.type
    });

    try {
      setUploadState(prev => ({ ...prev, uploading: true, progress: 0, error: null }));

      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to upload files');
      }

      console.log(`[MediaUploadManager] User authenticated, checking role...`);

      // Check user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleError || !roleData || roleData.role !== 'super_admin') {
        throw new Error('You need super admin privileges to upload files');
      }

      console.log(`[MediaUploadManager] User has super admin role, proceeding with upload...`);

      // Get upload info from edge function
      const { data: uploadInfo, error: infoError } = await supabase.functions.invoke('upload-video', {
        body: {
          action: 'get_upload_info',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        }
      });

      console.log(`[MediaUploadManager] Upload info response:`, { uploadInfo, infoError });

      if (infoError) {
        console.error(`[MediaUploadManager] Function invoke error:`, infoError);
        throw new Error(`Failed to get upload info: ${infoError.message || 'Unknown error'}`);
      }

      if (!uploadInfo) {
        console.error(`[MediaUploadManager] No upload info received`);
        throw new Error('No response from upload server');
      }

      if (!uploadInfo.success) {
        console.error(`[MediaUploadManager] Upload info failed:`, uploadInfo);
        throw new Error(uploadInfo.error || 'Failed to get upload info from server');
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

      console.log(`[MediaUploadManager] File uploaded successfully, confirming...`);

      // Confirm upload
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke('upload-video', {
        body: {
          action: 'confirm_upload',
          filePath: uploadInfo.filePath,
          bucket: uploadInfo.bucket
        }
      });

      console.log(`[MediaUploadManager] Confirm response:`, { confirmData, confirmError });

      if (confirmError) {
        throw new Error(`Failed to confirm upload: ${confirmError.message}`);
      }

      if (!confirmData?.success) {
        throw new Error(confirmData?.error || 'Failed to confirm upload');
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
        description: `${label} uploaded successfully`,
      });

      onUploadComplete(confirmData.publicUrl || '', uploadInfo.filePath);
      
    } catch (error) {
      console.error(`[MediaUploadManager] Upload failed:`, error);
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
  }, [accept, maxSize, toast, autoUpload]);

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

  const IconComponent = getFileIcon();

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
            Max: {formatFileSize(maxSize)}
          </div>
        </div>
      </div>

      {/* Current file preview */}
      {currentUrl && !uploadState.file && !uploadState.completed && (
        <Card className="p-4 gradient-card border-border">
          <div className="flex items-center gap-3">
            <IconComponent className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Current {fileType}</p>
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
            ? 'border-primary bg-primary/5 shadow-glow' 
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
            accept={accept}
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
                  Drop your {fileType} here
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse files
                </p>
                <Button variant="outline" type="button" className="transition-smooth">
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: {accept}
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
                    <span className="text-foreground">Uploading...</span>
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
                  <p className="text-sm text-green-600">Upload completed successfully!</p>
                </div>
              )}

              {/* Actions */}
              {uploadState.file && !uploadState.uploading && !uploadState.completed && (
                <div className="flex gap-2">
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      uploadFile(uploadState.file!);
                    }}
                    className="flex-1 gradient-accent text-primary-foreground"
                    disabled={!!uploadState.error}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {fileType}
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