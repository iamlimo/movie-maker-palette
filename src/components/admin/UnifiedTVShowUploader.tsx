import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  Image, 
  Video, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2
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

interface UnifiedTVShowUploaderProps {
  onUploadComplete?: (filePath: string, publicUrl: string) => void;
  onFileSelect?: (file: File | null) => void;
  accept: string;
  maxSize: number;
  label: string;
  description: string;
  contentType: 'poster' | 'banner' | 'trailer';
  currentUrl?: string;
  selectedFile?: File | null;
  required?: boolean;
  autoUpload?: boolean;
}

export const UnifiedTVShowUploader = ({
  onUploadComplete,
  onFileSelect,
  accept,
  maxSize,
  label,
  description,
  contentType,
  currentUrl,
  selectedFile,
  required = false,
  autoUpload = false
}: UnifiedTVShowUploaderProps) => {
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
      case 'poster':
      case 'banner': 
        return <Image className="h-8 w-8" />;
      case 'trailer': 
        return <Video className="h-8 w-8" />;
      default: 
        return <Upload className="h-8 w-8" />;
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
    console.log('[UnifiedTVShowUploader] Validating file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      contentType,
      accept,
      maxSize
    });

    // Check if file has a MIME type
    if (!file.type) {
      return `File has no MIME type. Please ensure the file is a valid ${contentType} file.`;
    }

    // Check for text/plain which often indicates detection failure
    if (file.type === 'text/plain') {
      return `File detected as text/plain. This may indicate an unsupported format. Please ensure the file is a valid ${contentType === 'poster' || contentType === 'banner' ? 'image' : 'video'} file.`;
    }

    // Define expected MIME types for each content type
    const expectedMimeTypes = {
      'poster': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      'banner': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      'trailer': ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
    };

    const validMimeTypes = expectedMimeTypes[contentType];
    if (validMimeTypes && !validMimeTypes.includes(file.type)) {
      return `MIME type '${file.type}' is not supported for ${contentType}. Expected: ${validMimeTypes.join(', ')}`;
    }

    // Check file size
    if (file.size > maxSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`;
    }

    return null;
  };

  const uploadFile = useCallback(async (file: File, retryCount = 0) => {
    console.log('[UnifiedTVShowUploader] Starting upload for:', file.name, 'MIME type:', file.type, 'Content type:', contentType);
    
    setUploadState(prev => ({ ...prev, uploading: true, progress: 10, error: null }));

    try {
      // Get user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.');
      }

      setUploadState(prev => ({ ...prev, progress: 20 }));

      // Map contentType to fileType for unified-media-upload
      const fileTypeMap: Record<string, string> = {
        'poster': 'thumbnail',
        'banner': 'thumbnail', 
        'trailer': 'trailer'
      };
      
      const fileType = fileTypeMap[contentType] || 'thumbnail';
      
      console.log('[UnifiedTVShowUploader] Getting upload URL for:', { contentType, fileType, fileName: file.name });
      
      // Get upload URL from unified-media-upload
      const uploadUrlResponse = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: file.name,
          fileType: fileType,
          contentType: file.type
        }
      });

      if (uploadUrlResponse.error) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.error.message}`);
      }

      if (!uploadUrlResponse.data?.success) {
        throw new Error(uploadUrlResponse.data?.error || 'Failed to get upload URL from server');
      }

      const { uploadUrl, filePath, publicUrl } = uploadUrlResponse.data;

      console.log('[UnifiedTVShowUploader] Got upload URL:', { uploadUrl, filePath, publicUrl });

      setUploadState(prev => ({ ...prev, progress: 50 }));

      // Upload file to signed URL
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!response.ok) {
        let errorText = `HTTP ${response.status}`;
        try {
          const errorData = await response.text();
          errorText = errorData || errorText;
        } catch {
          // Continue with status code error
        }
        console.error('[UnifiedTVShowUploader] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${errorText}`);
      }

      console.log('[UnifiedTVShowUploader] Upload completed successfully to storage');

      setUploadState(prev => ({ ...prev, progress: 90 }));

      if (!publicUrl) {
        throw new Error('Failed to get public URL after upload');
      }

      console.log('[UnifiedTVShowUploader] Upload completed successfully:', {
        filePath,
        publicUrl
      });

      setUploadState(prev => ({ 
        ...prev, 
        uploading: false,
        progress: 100,
        completed: true,
        filePath,
        publicUrl
      }));

      // Call completion callback if provided
      onUploadComplete?.(filePath, publicUrl);

      toast({
        title: "Success",
        description: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} uploaded successfully`,
      });

    } catch (error) {
      console.error('[UnifiedTVShowUploader] Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      // Retry on token expiry (up to 2 times)
      if (errorMessage.includes('expired') && retryCount < 2) {
        console.log('[UnifiedTVShowUploader] Token expired, retrying...', retryCount + 1);
        toast({
          title: "Retrying Upload",
          description: "Token expired, getting fresh upload URL...",
        });
        setTimeout(() => uploadFile(file, retryCount + 1), 1000);
        return;
      }
      
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
    if (!files || files.length === 0) {
      onFileSelect?.(null);
      return;
    }

    const file = files[0];
    console.log('[UnifiedTVShowUploader] File selected:', file.name, file.type, file.size);

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
      onFileSelect?.(null);
      return;
    }

    setUploadState(prev => ({ 
      ...prev, 
      file,
      error: null,
      completed: false,
      progress: 0
    }));

    // For file selection mode, just notify parent
    if (onFileSelect) {
      onFileSelect(file);
    }

    // Only auto-upload if explicitly enabled and callback provided
    if (autoUpload && onUploadComplete) {
      await uploadFile(file);
    }
  }, [validateFile, autoUpload, uploadFile, onFileSelect, onUploadComplete, toast]);

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
    onFileSelect?.(null);
  };

  const triggerUpload = async () => {
    if (uploadState.file) {
      await uploadFile(uploadState.file);
    } else if (selectedFile) {
      await uploadFile(selectedFile);
    }
  };

  const maxSizeInMB = Math.round(maxSize / 1024 / 1024);
  const currentFile = uploadState.file || selectedFile;

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
      {currentUrl && !currentFile && !uploadState.completed && (
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
          {!currentFile && !uploadState.completed ? (
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
                      {currentFile?.name || 'Upload completed'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currentFile ? formatFileSize(currentFile.size) : 'File uploaded successfully'}
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
              {!autoUpload && currentFile && !uploadState.completed && !uploadState.uploading && (
                <Button onClick={triggerUpload} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
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