import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, Upload } from 'lucide-react';
import { DeferredMediaUpload } from './DeferredMediaUpload';

interface OptimizedContentUploaderProps {
  stagedFiles: Array<{ file: File; fileType: string; id: string }>;
  uploadProgress: Array<{
    id: string;
    fileName: string;
    fileType: string;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
  }>;
  isUploading: boolean;
  onFileStaged: (file: File, fileType: 'video' | 'thumbnail' | 'trailer') => string;
  onFileRemoved: (fileType: string) => void;
  onRetryFailedUploads: () => Promise<any>;
  getFileByType: (fileType: string) => any;
  getProgressByType: (fileType: string) => any;
}

export const OptimizedContentUploader: React.FC<OptimizedContentUploaderProps> = ({
  stagedFiles,
  uploadProgress,
  isUploading,
  onFileStaged,
  onFileRemoved,
  onRetryFailedUploads,
  getFileByType,
  getProgressByType
}) => {
  const getOverallProgress = () => {
    if (uploadProgress.length === 0) return 0;
    const totalProgress = uploadProgress.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(totalProgress / uploadProgress.length);
  };

  const hasFailedUploads = uploadProgress.some(p => p.status === 'error');
  const hasCompletedUploads = uploadProgress.some(p => p.status === 'completed');

  return (
    <Card className="gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          Media Files
          {stagedFiles.length === 0 && (
            <Badge variant="destructive" className="text-xs">
              No files staged
            </Badge>
          )}
          {stagedFiles.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stagedFiles.length} file(s) staged
            </Badge>
          )}
          {isUploading && (
            <Badge variant="default" className="text-xs animate-pulse">
              Uploading...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Upload Progress
              </span>
              <span className="text-xs text-muted-foreground">
                {getOverallProgress()}%
              </span>
            </div>
            <Progress value={getOverallProgress()} className="h-2" />
            
            {/* Status indicators */}
            <div className="flex items-center gap-4 text-xs">
              {isUploading && (
                <div className="flex items-center gap-1 text-primary">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Uploading files...</span>
                </div>
              )}
              
              {hasCompletedUploads && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span>Some uploads complete</span>
                </div>
              )}
              
              {hasFailedUploads && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>Some uploads failed</span>
                </div>
              )}
            </div>

            {/* Retry failed uploads */}
            {hasFailedUploads && !isUploading && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetryFailedUploads}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry Failed Uploads
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Upload Components */}
        <div className="space-y-6">
          {/* Movie Thumbnail */}
          <DeferredMediaUpload
            onFileStaged={onFileStaged}
            onFileRemoved={onFileRemoved}
            accept="image/*"
            maxSize={10 * 1024 * 1024} // 10MB
            label="Movie Thumbnail"
            description="Upload the main thumbnail image for the movie"
            fileType="thumbnail"
            required
            stagedFile={getFileByType('thumbnail')}
            progress={getProgressByType('thumbnail')}
          />

          {/* Movie Video */}
          <DeferredMediaUpload
            onFileStaged={onFileStaged}
            onFileRemoved={onFileRemoved}
            accept="video/*"
            maxSize={2 * 1024 * 1024 * 1024} // 2GB
            label="Movie Video"
            description="Upload the main movie video file"
            fileType="video"
            required
            stagedFile={getFileByType('video')}
            progress={getProgressByType('video')}
          />

          {/* Movie Trailer (Optional) */}
          <DeferredMediaUpload
            onFileStaged={onFileStaged}
            onFileRemoved={onFileRemoved}
            accept="video/*"
            maxSize={500 * 1024 * 1024} // 500MB
            label="Movie Trailer"
            description="Upload a trailer video (optional)"
            fileType="trailer"
            stagedFile={getFileByType('trailer')}
            progress={getProgressByType('trailer')}
          />
        </div>

        {/* Upload Status Summary */}
        {uploadProgress.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Upload Status</h4>
            <div className="space-y-2">
              {uploadProgress.map((progress) => (
                <div key={progress.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground capitalize">
                    {progress.fileType}: {progress.fileName}
                  </span>
                  <div className="flex items-center gap-2">
                    {progress.status === 'completed' && (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    )}
                    {progress.status === 'error' && (
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    )}
                    {progress.status === 'uploading' && (
                      <RefreshCw className="h-3 w-3 text-primary animate-spin" />
                    )}
                    {progress.status === 'pending' && (
                      <Upload className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="w-10 text-right">
                      {progress.progress}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};