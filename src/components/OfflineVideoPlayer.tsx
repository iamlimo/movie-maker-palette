import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useOfflineVideo } from '@/hooks/useOfflineVideo';
import { useToast } from '@/hooks/use-toast';

interface OfflineVideoPlayerProps {
  contentId: string;
  contentType: 'movie' | 'episode';
  rentalExpiresAt?: string;
  rentalId?: string;
  onlineVideoUrl?: string;
  posterUrl?: string;
  className?: string;
}

export const OfflineVideoPlayer = ({
  contentId,
  contentType,
  rentalExpiresAt,
  rentalId,
  onlineVideoUrl,
  posterUrl,
  className = ''
}: OfflineVideoPlayerProps) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([100]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const {
    isDownloading,
    downloadProgress,
    isCached,
    checkIfCached,
    getCachedVideoUrl,
    downloadForOffline,
    removeFromOffline
  } = useOfflineVideo({ contentId, contentType, rentalId });

  useEffect(() => {
    loadVideo();
    return () => {
      // Cleanup blob URL
      if (videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [contentId]);

  const loadVideo = async () => {
    setLoading(true);
    
    // Check if video is cached
    await checkIfCached();
    const cachedUrl = await getCachedVideoUrl();
    
    if (cachedUrl) {
      setVideoUrl(cachedUrl);
    } else if (onlineVideoUrl) {
      setVideoUrl(onlineVideoUrl);
    }
    
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!rentalExpiresAt) {
      toast({
        title: "Cannot download",
        description: "No active rental found",
        variant: "destructive"
      });
      return;
    }

    const expiresAt = new Date(rentalExpiresAt).getTime();
    await downloadForOffline(expiresAt);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = value[0];
    videoRef.current.volume = newVolume / 100;
    setVolume(value);
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    const newTime = (value[0] / 100) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent right-click download
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className={`bg-background rounded-lg overflow-hidden ${className}`}>
        <Skeleton className="w-full aspect-video rounded-none" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Download controls */}
      {rentalExpiresAt && (
        <div className="mb-2 flex items-center gap-2">
          {isDownloading ? (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Downloading...</span>
                <span className="text-sm font-medium">{Math.round(downloadProgress)}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          ) : isCached ? (
            <Button
              variant="outline"
              size="sm"
              onClick={removeFromOffline}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remove from offline
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download for offline
            </Button>
          )}
          {isCached && (
            <span className="text-xs text-primary">✓ Available offline</span>
          )}
        </div>
      )}

      <div 
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden group"
        onContextMenu={handleContextMenu}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          preload="metadata"
          controlsList="nodownload"
          disablePictureInPicture
        />
        
        {/* Video Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="mb-4">
            <Slider
              value={[duration ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-white mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </Button>
              
              <div className="w-24">
                <Slider
                  value={volume}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </Button>
          </div>
        </div>
        
        {/* Click to Play */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="lg"
              onClick={togglePlay}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full p-4"
            >
              <Play size={48} />
            </Button>
          </div>
        )}

        {/* Protected watermark */}
        <div className="absolute top-4 right-4 text-white/30 text-xs pointer-events-none">
          Protected Content
        </div>
      </div>
    </div>
  );
};
