import { useState, useRef } from "react";
import { Upload, X, Film, Image, PlayCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChunkedUploadProps {
  accept: string;
  onUploadComplete: (url: string, filePath: string) => void;
  label: string;
  description?: string;
  currentUrl?: string;
  fileType: "video" | "thumbnail" | "trailer";
  maxSize?: number; // in MB
  episodeUpload?: boolean; // For episode-specific routing
}

const ChunkedUpload: React.FC<ChunkedUploadProps> = ({
  accept,
  onUploadComplete,
  label,
  description,
  currentUrl,
  fileType,
  maxSize = 1024, // Default 1GB for videos
  episodeUpload = false
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileIcon = () => {
    switch (fileType) {
      case "video":
      case "trailer":
        return <Film className="h-8 w-8" />;
      case "thumbnail":
        return <Image className="h-8 w-8" />;
      default:
        return <Upload className="h-8 w-8" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const validateFile = (file: File) => {
    const maxSizeBytes = maxSize * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxSize}MB`,
        variant: "destructive",
      });
      return false;
    }

    // Check file type
    const validTypes = accept.split(',').map(type => type.trim());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;

    const isValidType = validTypes.some(type => 
      type === mimeType || type === fileExtension || file.name.toLowerCase().endsWith(type)
    );

    if (!isValidType) {
      toast({
        title: "Invalid file type",
        description: `Please select a valid ${fileType} file`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!validateFile(selectedFile)) {
      return;
    }
    setFile(selectedFile);
  };

  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      console.log(`[${fileType}] Starting upload for:`, file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Get upload info from edge function
      const uploadInfoResponse = await supabase.functions.invoke('upload-video', {
        body: {
          action: 'get_upload_info',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          episodeUpload: episodeUpload
        }
      });

      console.log(`[${fileType}] Upload info response:`, uploadInfoResponse);

      if (uploadInfoResponse.error) {
        console.error(`[${fileType}] Edge function error:`, uploadInfoResponse.error);
        throw new Error(`Upload service error: ${uploadInfoResponse.error.message || 'Unknown error'}`);
      }

      if (!uploadInfoResponse.data?.success) {
        console.error(`[${fileType}] Upload info failed:`, uploadInfoResponse.data);
        throw new Error(uploadInfoResponse.data?.error || 'Failed to get upload info');
      }

      const { uploadUrl: signedUrl, filePath, bucket } = uploadInfoResponse.data;
      
      if (!signedUrl) {
        console.error(`[${fileType}] No upload URL received:`, uploadInfoResponse.data);
        throw new Error('No upload URL received from server');
      }

      console.log(`[${fileType}] Upload info received successfully, bucket:`, bucket, 'path:', filePath);

      // Upload the file with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 90); // Reserve 10% for confirmation
          setProgress(percentComplete);
        }
      };

      xhr.onload = async () => {
        console.log(`[${fileType}] Upload completed with status:`, xhr.status);
        
        if (xhr.status === 200) {
          setProgress(95);
          
          // Confirm upload
          try {
            console.log(`[${fileType}] Confirming upload for path:`, filePath, 'bucket:', bucket);
            
            const confirmResponse = await supabase.functions.invoke('upload-video', {
              body: {
                action: 'confirm_upload',
                filePath,
                bucket
              }
            });

            console.log(`[${fileType}] Confirm response:`, confirmResponse);

            if (confirmResponse.error) {
              console.error(`[${fileType}] Confirmation edge function error:`, confirmResponse.error);
              throw new Error(`Confirmation error: ${confirmResponse.error.message}`);
            }

            if (confirmResponse.data?.success) {
              setProgress(100);
              console.log(`[${fileType}] Upload successful, calling onUploadComplete with:`, confirmResponse.data.publicUrl);
              onUploadComplete(confirmResponse.data.publicUrl, filePath);
              toast({
                title: "Upload successful",
                description: `${fileType} uploaded successfully`,
              });
              setFile(null);
            } else {
              console.error(`[${fileType}] Upload confirmation failed:`, confirmResponse.data);
              throw new Error(confirmResponse.data?.error || 'Failed to confirm upload');
            }
          } catch (confirmError) {
            console.error(`[${fileType}] Confirmation error:`, confirmError);
            throw new Error('Upload completed but confirmation failed: ' + (confirmError instanceof Error ? confirmError.message : 'Unknown error'));
          }
        } else {
          const responseText = await xhr.responseText;
          console.error(`[${fileType}] Upload failed with status ${xhr.status}:`, responseText);
          throw new Error(`Upload failed with status ${xhr.status}: ${responseText}`);
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        console.error(`[${fileType}] Network error during upload`);
        setUploading(false);
        throw new Error('Upload failed due to network error');
      };

      console.log(`[${fileType}] Starting file upload to:`, signedUrl);
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

    } catch (error) {
      console.error(`[${fileType}] Upload error:`, error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const clearFile = () => {
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <Card
        className={`border-dashed border-2 transition-all duration-200 cursor-pointer ${
          dragOver 
            ? 'border-primary bg-primary/10 shadow-lg scale-[1.02]' 
            : currentUrl && !file
            ? 'border-green-300 bg-green-50/50'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        } ${uploading ? 'pointer-events-none opacity-75' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && !file && fileInputRef.current?.click()}
      >
        <CardContent className="p-6">
          {/* Current file preview */}
          {currentUrl && !file && !uploading && (
            <div className="flex items-center gap-4 mb-4 p-3 bg-background rounded-lg border">
              {fileType === "thumbnail" ? (
                <img src={currentUrl} alt="Current thumbnail" className="w-12 h-12 object-cover rounded border" />
              ) : (
                <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center">
                  <PlayCircle className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">Current {fileType}</p>
                <p className="text-xs text-muted-foreground">Click to replace or drag new file</p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Uploaded
              </Badge>
            </div>
          )}

          {!file ? (
            <div className="text-center space-y-4">
              <div className={`flex justify-center transition-colors ${dragOver ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`p-4 rounded-full transition-all ${dragOver ? 'bg-primary/20 scale-110' : 'bg-muted/50'}`}>
                  {getFileIcon()}
                </div>
              </div>
              <div>
                <p className={`font-medium transition-colors ${dragOver ? 'text-primary' : 'text-foreground'}`}>
                  {dragOver ? `Drop ${fileType} here` : `Drag & drop ${fileType} here`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="w-full sm:w-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Browse Files
                </Button>
                <Badge variant="outline" className="text-xs">
                  Max {maxSize}MB
                </Badge>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    handleFileSelect(selectedFile);
                  }
                }}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="text-primary">
                  {getFileIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {uploading && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      Uploading {fileType}...
                    </span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Please don't close this page while uploading
                  </p>
                </div>
              )}
              
              {!uploading && (
                <Button onClick={uploadFile} className="w-full" size="lg">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {fileType}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChunkedUpload;