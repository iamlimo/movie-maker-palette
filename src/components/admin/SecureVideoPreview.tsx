import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

interface SecureVideoPreviewProps {
  url: string;
}

const SecureVideoPreview = ({ url }: SecureVideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{ duration?: number; width?: number; height?: number }>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [url]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setMetadata({
        duration: videoRef.current.duration,
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
      setLoading(false);
    }
  };

  const handleError = () => {
    setError('Failed to load video. Please check the URL and ensure the video is accessible.');
    setLoading(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        <video
          ref={videoRef}
          src={url}
          controls
          controlsList="nodownload"
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full"
          preload="metadata"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && metadata.duration && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Duration: {formatDuration(metadata.duration)}</p>
          {metadata.width && metadata.height && (
            <p>Resolution: {metadata.width} × {metadata.height}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SecureVideoPreview;
