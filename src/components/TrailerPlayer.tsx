import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrailerPlayerProps {
  trailerUrl: string;
  title: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

const TrailerPlayer = ({ 
  trailerUrl, 
  title, 
  className = "",
  autoPlay = false,
  muted = true,
  controls = true
}: TrailerPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [signedUrl, setSignedUrl] = useState<string>(trailerUrl);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Check if URL is a Backblaze URL
  const isBackblazeUrl = (url: string) => {
    return url.includes('backblazeb2.com') || url.includes('b2cdn.com');
  };

  // Fetch signed URL for Backblaze trailers
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!isBackblazeUrl(trailerUrl)) {
        setSignedUrl(trailerUrl);
        return;
      }

      setIsLoadingUrl(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-trailer-url', {
          body: { trailerUrl }
        });

        if (error) throw error;
        
        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      } catch (error) {
        console.error('Error fetching signed URL:', error);
        setSignedUrl(trailerUrl); // Fallback to original URL
      } finally {
        setIsLoadingUrl(false);
      }
    };

    fetchSignedUrl();
  }, [trailerUrl]);

  // Auto-play when ready (credit optimized)
  useEffect(() => {
    if (autoPlay && signedUrl) {
      const video = document.querySelector('video');
      if (video) {
        video.play().catch(err => {
          console.error('Autoplay failed:', err);
        });
      }
    }
  }, [autoPlay, signedUrl]);

  // Check if it's a YouTube URL and extract video ID
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Check if it's a Vimeo URL and extract video ID
  const getVimeoVideoId = (url: string) => {
    const regex = /(?:vimeo\.com\/)([0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const youtubeId = getYouTubeVideoId(trailerUrl);
  const vimeoId = getVimeoVideoId(trailerUrl);

  if (youtubeId) {
    return (
      <div className={`relative aspect-video bg-secondary rounded-xl overflow-hidden ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&rel=0&modestbranding=1`}
          title={`${title} - Trailer`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        
        {/* Custom Controls Overlay */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-smooth flex items-center justify-center opacity-0 hover:opacity-100">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setIsPlaying(!isPlaying)}
              className="shadow-glow"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className={`relative aspect-video bg-secondary rounded-xl overflow-hidden ${className}`}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=${isPlaying ? 1 : 0}&muted=${isMuted ? 1 : 0}&title=0&byline=0&portrait=0`}
          title={`${title} - Trailer`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // For direct video files (including Backblaze)
  return (
    <div className={`relative aspect-video bg-secondary rounded-xl overflow-hidden ${className}`}>
      {isLoadingUrl ? (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/80">
          <p className="text-muted-foreground">Loading trailer...</p>
        </div>
      ) : (
        <video
          src={signedUrl}
          poster="/placeholder.svg"
          className="w-full h-full object-cover"
          controls
          preload="metadata"
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
        >
          Your browser does not support the video tag.
        </video>
      )}
      
      {/* Fallback message if video fails to load */}
      <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 backdrop-blur">
        <div className="text-center">
          <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Trailer not available</p>
          <Button variant="outline" className="mt-4" asChild>
            <a href={trailerUrl} target="_blank" rel="noopener noreferrer">
              Watch on External Site
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrailerPlayer;