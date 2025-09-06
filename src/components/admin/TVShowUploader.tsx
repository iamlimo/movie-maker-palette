import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  Image, 
  Video, 
  Film, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Play
} from 'lucide-react';

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  error: string | null;
  completed: boolean;
  filePath?: string;
  publicUrl?: string;
}

interface TVShowUploaderProps {
  onUploadComplete: (filePath: string, publicUrl: string) => void;
  accept: string;
  maxSize: number;
  label: string;
  description: string;
  contentType: 'poster' | 'trailer' | 'episode';
  currentUrl?: string;
  required?: boolean;
  autoUpload?: boolean;
}

export const TVShowUploader = ({
  onUploadComplete,
  accept,
  maxSize,
  label,
  description,
  contentType,
  currentUrl,
  required = false,
  autoUpload = true
}: TVShowUploaderProps) => {
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

  const getContentIcon = () => {
    switch (contentType) {
      case 'poster': return <Image className="h-8 w-8" />;
      case 'trailer': return <Video className="h-8 w-8" />;
      case 'episode': return <Film className="h-8 w-8" />;
      default: return <Upload className="h-8 w-8" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    console.log('[TVShowUploader] Validating file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      contentType,
      accept,
      maxSize
    });

    // Check file size
    if (file.size > maxSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`;
    }

    // Check file type
    const acceptedTypes = accept.split(',').map(type => type.trim());
    const fileExtension = '.' + file.name.toLowerCase().split('.').pop();
    
    const isValidType = acceptedTypes.some(acceptType => {
      if (acceptType.includes('*')) {
        const baseType = acceptType.split('/')[0];
        return file.type.startsWith(baseType + '/');
      }
      return acceptType === file.type || acceptType === fileExtension;
    });

    if (!isValidType) {
      return `File type not supported. Accepted types: ${accept}`;
    }

    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    console.log('[TVShowUploader] Starting upload for:', file.name, 'Content type:', contentType);
    
    setUploadState(prev => ({ ...prev, uploading: true, progress: 10, error: null }));

    try {
      // Get user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.');
      }

      setUploadState(prev => ({ ...prev, progress: 20 }));

      // Get upload info from TV show upload function
      console.log('[TVShowUploader] Getting upload info from tv-show-upload function...');
      const { data: uploadInfo, error: uploadInfoError } = await supabase.functions.invoke('tv-show-upload', {
        body: {
          action: 'get_upload_info',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          contentType: contentType
        }
      });

      if (uploadInfoError) {
        console.error('[TVShowUploader] Upload info error:', uploadInfoError);
        throw new Error(`Failed to get upload info: ${uploadInfoError.message}`);
      }

      if (!uploadInfo?.uploadUrl) {
        console.error('[TVShowUploader] Invalid upload info:', uploadInfo);
        throw new Error(uploadInfo?.error || 'Failed to get upload URL from server');
      }

      console.log('[TVShowUploader] Upload info received:', {
        hasUploadUrl: !!uploadInfo.uploadUrl,
        filePath: uploadInfo.filePath,
        bucket: uploadInfo.bucket,
        contentType: uploadInfo.contentType
      });

      setUploadState(prev => ({ ...prev, progress: 30 }));

      // Upload file to the signed URL with progress tracking
      console.log('[TVShowUploader] Starting file upload to signed URL...');
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 70 + 30; // 30-100%
            setUploadState(prev => ({ ...prev, progress: Math.round(percentComplete) }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            console.log('[TVShowUploader] File upload completed successfully');
            resolve();
          } else {
            console.error('[TVShowUploader] Upload failed with status:', xhr.status, xhr.statusText);
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('[TVShowUploader] Upload error event');
          reject(new Error('Upload failed due to network error'));
        });

        xhr.open('PUT', uploadInfo.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setUploadState(prev => ({ ...prev, progress: 90 }));

      // Confirm upload
      console.log('[TVShowUploader] Confirming upload...');
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke('tv-show-upload', {
        body: {
          action: 'confirm_upload',
          filePath: uploadInfo.filePath,
          bucket: uploadInfo.bucket
        }
      });

      if (confirmError) {
        console.error('[TVShowUploader] Confirm error:', confirmError);
        throw new Error(`Failed to confirm upload: ${confirmError.message}`);
      }

      if (!confirmData?.publicUrl) {
        console.error('[TVShowUploader] Invalid confirm data:', confirmData);
        throw new Error(confirmData?.error || 'Failed to get public URL from server');
      }

      console.log('[TVShowUploader] Upload confirmed successfully:', {
        filePath: confirmData.filePath,
        hasPublicUrl: !!confirmData.publicUrl
      });

      setUploadState(prev => ({ 
        ...prev, 
        uploading: false,
        progress: 100,
        completed: true,
        filePath: confirmData.filePath,
        publicUrl: confirmData.publicUrl
      }));

      // Call completion callback
      onUploadComplete(confirmData.filePath, confirmData.publicUrl);

      toast({
        title: "Success",
        description: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} uploaded successfully`,
      });

    } catch (error) {
      console.error('[TVShowUploader] Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setUploadState(prev => ({ 
        ...prev, 
        uploading: false,
        progress: 0,
        error: errorMessage
      }));

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [contentType, onUploadComplete, toast]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    console.log('[TVShowUploader] File selected:', file.name, file.type, file.size);

    const validationError = validateFile(file);
    if (validationError) {
      setUploadState(prev => ({ 
        ...prev, 
        error: validationError,
        file: null
      }));
      toast({
        title: "Invalid File",
        description: validationError,
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

    if (autoUpload) {
      await uploadFile(file);
    }
  }, [validateFile, autoUpload, uploadFile, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
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

  const maxSizeInMB = Math.round(maxSize / 1024 / 1024);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          <p className="text-sm text-muted-foreground">
            {description} {required && <span className="text-destructive">*</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Supported formats: {accept} • Max size: {maxSizeInMB}MB
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          {getContentIcon()}
          {contentType}
        </Badge>
      </div>

      {/* Current URL Preview */}
      {currentUrl && !uploadState.file && !uploadState.completed && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Current file uploaded</p>
                <p className="text-xs text-muted-foreground truncate">{currentUrl}</p>
              </div>
              {contentType === 'trailer' && (
                <Button variant="outline" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-all ${
          dragOver 
            ? 'border-primary bg-primary/5' 
            : uploadState.error 
            ? 'border-destructive bg-destructive/5' 
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <CardContent 
          className="p-8"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {!uploadState.file && !uploadState.completed ? (
            <div className="text-center">
              <div className="mx-auto mb-4 text-muted-foreground">
                {getContentIcon()}
              </div>
              <h4 className="mb-2 text-sm font-medium">
                Drop your {contentType} here, or click to browse
              </h4>
              <p className="mb-4 text-xs text-muted-foreground">
                Supports {accept.split(',').join(', ')} up to {maxSizeInMB}MB
              </p>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto"
              >
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getContentIcon()}
                  <div>
                    <p className="text-sm font-medium">
                      {uploadState.file?.name || 'Upload completed'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uploadState.file ? formatFileSize(uploadState.file.size) : 'File uploaded successfully'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {uploadState.completed && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {uploadState.uploading && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {uploadState.error && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    disabled={uploadState.uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              {uploadState.uploading && (
                <div className="space-y-2">
                  <Progress value={uploadState.progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    Uploading... {uploadState.progress}%
                  </p>
                </div>
              )}

              {/* Error Message */}
              {uploadState.error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">{uploadState.error}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {uploadState.completed && (
                <div className="p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-700 dark:text-green-400">
                      {contentType.charAt(0).toUpperCase() + contentType.slice(1)} uploaded successfully!
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Upload Button */}
              {!autoUpload && uploadState.file && !uploadState.uploading && !uploadState.completed && !uploadState.error && (
                <Button 
                  onClick={() => uploadFile(uploadState.file!)}
                  className="w-full"
                >
                  Upload {contentType}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};