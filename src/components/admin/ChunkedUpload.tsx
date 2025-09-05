import { useState, useRef } from "react";
import { Upload, X, Film, Image, PlayCircle } from "lucide-react";
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
}

const ChunkedUpload: React.FC<ChunkedUploadProps> = ({
  accept,
  onUploadComplete,
  label,
  description,
  currentUrl,
  fileType,
  maxSize = 1024 // Default 1GB for videos
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
          fileType: file.type
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <Badge variant="outline">
          Max {maxSize}MB
        </Badge>
      </div>

      {/* Current file preview */}
      {currentUrl && !file && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {fileType === "thumbnail" ? (
                <img src={currentUrl} alt="Current thumbnail" className="w-16 h-16 object-cover rounded" />
              ) : (
                <div className="w-16 h-16 bg-secondary rounded flex items-center justify-center">
                  <PlayCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">Current {fileType}</p>
                <p className="text-sm text-muted-foreground">Click to replace</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload area */}
      <Card
        className={`border-dashed border-2 transition-colors ${
          dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-8">
          {!file ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center text-muted-foreground">
                {getFileIcon()}
              </div>
              <div>
                <p className="text-lg font-medium">
                  Drag & drop {fileType} here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse files
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Select {fileType}
              </Button>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getFileIcon()}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              {!uploading && (
                <Button onClick={uploadFile} className="w-full">
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