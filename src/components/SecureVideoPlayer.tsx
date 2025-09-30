import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SecureVideoPlayerProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  posterUrl?: string;
  onError?: (error: string) => void;
}

const SecureVideoPlayer = ({ 
  contentId, 
  contentType, 
  posterUrl,
  onError 
}: SecureVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const { toast } = useToast();
  const refreshTimerRef = useRef<number | null>(null);

  const fetchSignedUrl = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/generate-b2-signed-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
          },
          body: JSON.stringify({
            contentId,
            contentType
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get video URL');
      }

      const data = await response.json();
      setSignedUrl(data.signedUrl);
      setExpiresAt(data.expiresAt);
      setLoading(false);

      // Set up auto-refresh 5 minutes before expiry
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const expiryTime = new Date(data.expiresAt).getTime();
      const now = Date.now();
      const refreshTime = expiryTime - now - (5 * 60 * 1000); // 5 minutes before expiry

      if (refreshTime > 0) {
        refreshTimerRef.current = window.setTimeout(() => {
          handleRefreshUrl();
        }, refreshTime);
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load video';
      setError(errorMessage);
      setLoading(false);
      onError?.(errorMessage);
    }
  };

  const handleRefreshUrl = async () => {
    const currentTime = videoRef.current?.currentTime || 0;
    await fetchSignedUrl();
    
    // Restore playback position
    if (videoRef.current && signedUrl) {
      videoRef.current.currentTime = currentTime;
      videoRef.current.play();
    }

    toast({
      title: "Video URL refreshed",
      description: "Playback will continue seamlessly"
    });
  };

  useEffect(() => {
    fetchSignedUrl();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [contentId, contentType]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  if (loading) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading secure video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSignedUrl}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative">
      <div 
        className="aspect-video bg-black rounded-lg overflow-hidden"
        onContextMenu={handleContextMenu}
      >
        {signedUrl && (
          <video
            ref={videoRef}
            src={signedUrl}
            poster={posterUrl}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onContextMenu={handleContextMenu}
            className="w-full h-full"
            style={{ pointerEvents: 'auto' }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {/* Watermark overlay for additional protection */}
      <div 
        className="absolute top-4 right-4 text-white/30 text-xs font-mono select-none pointer-events-none"
        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
      >
        Protected Content
      </div>
    </div>
  );
};

export default SecureVideoPlayer;
