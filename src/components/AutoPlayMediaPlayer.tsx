import { useState, useEffect } from "react";
import TrailerPlayer from "./TrailerPlayer";
import { Play } from "lucide-react";
import { Button } from "./ui/button";

interface AutoPlayMediaPlayerProps {
  trailerUrl?: string;
  posterUrl: string;
  title: string;
  contentId: string;
  contentType: 'movie' | 'tv_show';
}

const AutoPlayMediaPlayer = ({
  trailerUrl,
  posterUrl,
  title,
  contentId,
  contentType
}: AutoPlayMediaPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Auto-start trailer when component mounts if available
    if (trailerUrl) {
      setIsPlaying(true);
    }
  }, [trailerUrl]);

  if (!trailerUrl) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Preview</h2>
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black shadow-2xl">
          {isPlaying ? (
            <TrailerPlayer
              trailerUrl={trailerUrl}
              title={title}
              autoPlay={true}
              muted={false}
              controls={true}
              poster={posterUrl}
              className="w-full h-full"
            />
          ) : (
            <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsPlaying(true)}>
              <img 
                src={posterUrl} 
                alt={title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                <Button 
                  size="lg" 
                  className="rounded-full h-16 w-16 p-0"
                >
                  <Play className="h-8 w-8 ml-1" fill="currentColor" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoPlayMediaPlayer;
