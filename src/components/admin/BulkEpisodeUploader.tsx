import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  FolderOpen
} from 'lucide-react';

interface EpisodeFile {
  file: File;
  title: string;
  episode_number: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  filePath?: string;
}

interface BulkEpisodeUploaderProps {
  seasonId: string;
  onBulkUploadComplete: (episodes: any[]) => void;
  maxFileSize?: number;
}

export const BulkEpisodeUploader = ({
  seasonId,
  onBulkUploadComplete,
  maxFileSize = 2 * 1024 * 1024 * 1024 // 2GB default
}: BulkEpisodeUploaderProps) => {
  const [episodes, setEpisodes] = useState<EpisodeFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const extractEpisodeNumber = (filename: string): number => {
    // Try to extract episode number from filename
    const match = filename.match(/(?:episode|ep|e)[\s._-]*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  };

  const generateEpisodeTitle = (filename: string): string => {
    // Remove file extension and clean up filename
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const cleaned = nameWithoutExt.replace(/[._-]/g, ' ').trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxFileSize)})`;
    }

    // Check file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
    const allowedExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    
    const fileExtension = '.' + file.name.toLowerCase().split('.').pop();
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);

    if (!isValidType) {
      return `File type not supported. Supported formats: MP4, WebM, MOV, AVI, MKV`;
    }

    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newEpisodes: EpisodeFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file, index) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      const episodeNumber = extractEpisodeNumber(file.name) || episodes.length + index + 1;
      const title = generateEpisodeTitle(file.name);

      newEpisodes.push({
        file,
        title,
        episode_number: episodeNumber,
        status: 'pending',
        progress: 0
      });
    });

    if (errors.length > 0) {
      toast({
        title: 'Some Files Invalid',
        description: errors.join('\n'),
        variant: 'destructive'
      });
    }

    setEpisodes(prev => [...prev, ...newEpisodes]);
  };

  const updateEpisode = (index: number, field: keyof EpisodeFile, value: any) => {
    setEpisodes(prev => prev.map((episode, i) => 
      i === index ? { ...episode, [field]: value } : episode
    ));
  };

  const removeEpisode = (index: number) => {
    setEpisodes(prev => prev.filter((_, i) => i !== index));
  };

  const uploadSingleEpisode = async (episode: EpisodeFile, index: number): Promise<void> => {
    updateEpisode(index, 'status', 'uploading');
    updateEpisode(index, 'progress', 10);

    try {
      // Get upload info
      const { data: uploadInfo, error: uploadInfoError } = await supabase.functions.invoke('tv-show-upload', {
        body: {
          action: 'get_upload_info',
          fileName: episode.file.name,
          fileSize: episode.file.size,
          fileType: episode.file.type,
          contentType: 'episode'
        }
      });

      if (uploadInfoError || !uploadInfo?.uploadUrl) {
        throw new Error(uploadInfo?.error || 'Failed to get upload URL');
      }

      updateEpisode(index, 'progress', 30);

      // Upload file with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 60) + 30; // 30-90%
            updateEpisode(index, 'progress', progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.open('PUT', uploadInfo.uploadUrl);
        xhr.setRequestHeader('Content-Type', episode.file.type);
        xhr.send(episode.file);
      });

      updateEpisode(index, 'progress', 90);

      // Confirm upload
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke('tv-show-upload', {
        body: {
          action: 'confirm_upload',
          filePath: uploadInfo.filePath,
          bucket: uploadInfo.bucket
        }
      });

      if (confirmError || !confirmData?.publicUrl) {
        throw new Error(confirmData?.error || 'Failed to confirm upload');
      }

      updateEpisode(index, 'filePath', confirmData.filePath);
      updateEpisode(index, 'progress', 100);
      updateEpisode(index, 'status', 'completed');

    } catch (error) {
      console.error('Episode upload error:', error);
      updateEpisode(index, 'status', 'error');
      updateEpisode(index, 'error', error instanceof Error ? error.message : 'Upload failed');
      updateEpisode(index, 'progress', 0);
    }
  };

  const uploadAllEpisodes = async () => {
    if (episodes.length === 0) return;

    setIsUploading(true);
    setOverallProgress(0);

    try {
      // Upload files concurrently (limit to 3 at a time to avoid overwhelming the server)
      const chunkSize = 3;
      const chunks = [];
      for (let i = 0; i < episodes.length; i += chunkSize) {
        chunks.push(episodes.slice(i, i + chunkSize));
      }

      let completedCount = 0;
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (episode, chunkIndex) => {
          const globalIndex = chunks.findIndex(c => c.includes(episode)) * chunkSize + chunkIndex;
          await uploadSingleEpisode(episode, globalIndex);
          completedCount++;
          setOverallProgress((completedCount / episodes.length) * 100);
        }));
      }

      // Create episodes in database
      const episodesToCreate = episodes
        .filter(ep => ep.status === 'completed' && ep.filePath)
        .map(ep => ({
          season_id: seasonId,
          title: ep.title,
          episode_number: ep.episode_number,
          video_url: ep.filePath,
          price: 0,
          rental_expiry_duration: 48,
          status: 'pending' as const
        }));

      if (episodesToCreate.length > 0) {
        const { data: createdEpisodes, error: dbError } = await supabase
          .from('episodes')
          .insert(episodesToCreate)
          .select();

        if (dbError) {
          throw new Error(`Failed to save episodes: ${dbError.message}`);
        }

        onBulkUploadComplete(createdEpisodes);
      }

      const successful = episodes.filter(ep => ep.status === 'completed').length;
      const failed = episodes.filter(ep => ep.status === 'error').length;

      toast({
        title: 'Bulk Upload Complete',
        description: `${successful} episodes uploaded successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        variant: successful > 0 ? 'default' : 'destructive'
      });

    } catch (error) {
      console.error('Bulk upload error:', error);
      toast({
        title: 'Bulk Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearAll = () => {
    setEpisodes([]);
    setOverallProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Bulk Episode Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          {episodes.length === 0 ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <div className="mx-auto mb-4 text-muted-foreground">
                <Upload className="h-12 w-12" />
              </div>
              <h4 className="mb-2 text-lg font-medium">Upload Episode Videos</h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Select multiple video files to upload episodes in bulk. Supports MP4, WebM, MOV, AVI, MKV.
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Select Episode Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span>{Math.round(overallProgress)}%</span>
                  </div>
                  <Progress value={overallProgress} />
                </div>
              )}

              {/* Episodes List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {episodes.map((episode, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {episode.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                        {episode.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                        {episode.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                        {episode.status === 'pending' && <File className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Episode Title</Label>
                            <Input
                              value={episode.title}
                              onChange={(e) => updateEpisode(index, 'title', e.target.value)}
                              disabled={episode.status === 'uploading'}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Episode Number</Label>
                            <Input
                              type="number"
                              min={1}
                              value={episode.episode_number}
                              onChange={(e) => updateEpisode(index, 'episode_number', parseInt(e.target.value) || 1)}
                              disabled={episode.status === 'uploading'}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">File Size</Label>
                            <div className="text-xs text-muted-foreground py-2">
                              {formatFileSize(episode.file.size)}
                            </div>
                          </div>
                        </div>
                        
                        {episode.status === 'uploading' && (
                          <Progress value={episode.progress} className="h-2" />
                        )}
                        
                        {episode.error && (
                          <p className="text-xs text-destructive">{episode.error}</p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEpisode(index)}
                        disabled={episode.status === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add More Files
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearAll}
                    disabled={isUploading}
                  >
                    Clear All
                  </Button>
                </div>
                
                <Button
                  onClick={uploadAllEpisodes}
                  disabled={isUploading || episodes.length === 0}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload All Episodes
                    </>
                  )}
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};