import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Video, Image, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface DeferredMediaUploadProps {
  onFileStaged: (file: File, fileType: 'video' | 'thumbnail' | 'trailer') => string;
  onFileRemoved: (fileType: string) => void;
  accept: string;
  maxSize: number;
  label: string;
  description: string;
  fileType: 'video' | 'thumbnail' | 'trailer';
  required?: boolean;
  stagedFile?: { file: File; id: string } | null;
  progress?: {
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
  };
}

export const DeferredMediaUpload = ({
  onFileStaged,
  onFileRemoved,
  accept,
  maxSize,
  label,
  description,
  fileType,
  required = false,
  stagedFile,
  progress
}: DeferredMediaUploadProps) => {
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

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    if (validation) {
      toast({
        title: "Invalid File",
        description: validation,
        variant: "destructive",
      });
      return;
    }

    onFileStaged(file, fileType);
  }, [accept, maxSize, fileType, onFileStaged, toast]);

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

  const getStatusColor = () => {
    if (!progress) return 'border-border';
    
    switch (progress.status) {
      case 'completed':
        return 'border-green-500';
      case 'error':
        return 'border-destructive';
      case 'uploading':
        return 'border-primary';
      default:
        return 'border-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    if (!progress) return null;
    
    switch (progress.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'uploading':
        return <RefreshCw className="h-5 w-5 text-primary animate-spin" />;
      case 'pending':
        return <Upload className="h-5 w-5 text-muted-foreground" />;
      default:
        return null;
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

      {/* Upload area */}
      <Card 
        className={`
          transition-all duration-300 cursor-pointer border-2 border-dashed
          ${dragOver 
            ? 'border-primary bg-primary/5 shadow-glow' 
            : `${getStatusColor()} hover:border-primary/50 hover:bg-card/50`
          }
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !progress?.status.includes('uploading') && fileInputRef.current?.click()}
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
            disabled={progress?.status === 'uploading'}
          />

          {!stagedFile ? (
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
                    {stagedFile.file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(stagedFile.file.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  {progress?.status !== 'uploading' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileRemoved(fileType);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress */}
              {progress?.status === 'uploading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">Uploading...</span>
                    <span className="text-muted-foreground">{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} className="h-2" />
                </div>
              )}

              {/* Status messages */}
              {progress?.status === 'error' && progress.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{progress.error}</p>
                </div>
              )}

              {progress?.status === 'completed' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-600">Upload completed successfully!</p>
                </div>
              )}

              {progress?.status === 'pending' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-muted">
                  <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Ready for upload</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};