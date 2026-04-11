import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  SkipBack,
  SkipForward,
  RotateCcw,
  Tv,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

interface VideoPlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  hasNextEpisode?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onMute: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
  onFullscreen: () => void;
  onSkipIntro?: () => void;
  onNextEpisode?: () => void;
  onReplay10s?: () => void;
  onCastToTV?: () => void;
  onQualityChange?: (quality: string) => void;
  onSubtitlesChange?: (subtitle: string | null) => void;
  availableQualities?: string[];
  availableSubtitles?: { code: string; label: string }[];
  currentQuality?: string;
  currentSubtitle?: string | null;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  isFullscreen,
  hasNextEpisode,
  onPlay,
  onPause,
  onMute,
  onVolumeChange,
  onSeek,
  onFullscreen,
  onSkipIntro,
  onNextEpisode,
  onReplay10s,
  onCastToTV,
  onQualityChange,
  onSubtitlesChange,
  availableQualities = ['Auto', '1080p', '720p', '480p', '240p'],
  availableSubtitles = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
  ],
  currentQuality = 'Auto',
  currentSubtitle = null,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12
                    opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      {/* Progress Bar with Preview */}
      <div className="mb-3">
        <div
          className="w-full h-1 bg-gray-600 rounded-full cursor-pointer group/progress hover:h-2 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            onSeek(percent * duration);
          }}
        >
          <div
            className="h-full bg-red-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-300 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Left Controls */}
        <div className="flex items-center gap-1">
          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            className="text-white hover:bg-white/20 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </Button>

          {/* Volume Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMute}
            className="text-white hover:bg-white/20 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </Button>

          <div className="w-20 px-2">
            <Slider
              value={[volume]}
              onValueChange={(val) => onVolumeChange(val[0])}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Skip Intro (if available) */}
          {onSkipIntro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkipIntro}
              className="text-white hover:bg-white/20 transition-colors text-xs hidden sm:flex"
              title="Skip Intro"
            >
              <SkipForward size={18} className="mr-1" />
              <span className="hidden md:inline">Intro</span>
            </Button>
          )}

          {/* Replay 10s */}
          {onReplay10s && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReplay10s}
              className="text-white hover:bg-white/20 transition-colors text-xs hidden sm:flex"
              title="Replay Last 10 Seconds"
            >
              <RotateCcw size={18} className="mr-1" />
              <span className="hidden md:inline">10s</span>
            </Button>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1">
          {/* Cast to TV */}
          {onCastToTV && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCastToTV}
              className="text-white hover:bg-white/20 transition-colors hidden sm:flex"
              title="Cast to TV (Chromecast/AirPlay)"
            >
              <Tv size={18} />
            </Button>
          )}

          {/* Next Episode */}
          {hasNextEpisode && onNextEpisode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextEpisode}
              className="text-white hover:bg-white/20 transition-colors text-xs hidden sm:flex"
              title="Next Episode"
            >
              <SkipForward size={18} className="mr-1" />
              <span className="hidden md:inline">Next</span>
            </Button>
          )}

          {/* Settings Menu */}
          <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white hover:bg-white/20 transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </Button>
            <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-700">
              {/* Quality Settings */}
              <DropdownMenuLabel className="text-white">Quality</DropdownMenuLabel>
              {availableQualities.map((quality) => (
                <DropdownMenuCheckboxItem
                  key={quality}
                  checked={currentQuality === quality}
                  onCheckedChange={() => {
                    onQualityChange?.(quality);
                  }}
                  className="cursor-pointer text-gray-200 focus:bg-gray-800"
                >
                  {quality}
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator className="bg-gray-700" />

              {/* Subtitles Settings */}
              <DropdownMenuLabel className="text-white">Subtitles</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={currentSubtitle === null}
                onCheckedChange={() => {
                  onSubtitlesChange?.(null);
                }}
                className="cursor-pointer text-gray-200 focus:bg-gray-800"
              >
                Off
              </DropdownMenuCheckboxItem>
              {availableSubtitles.map((subtitle) => (
                <DropdownMenuCheckboxItem
                  key={subtitle.code}
                  checked={currentSubtitle === subtitle.code}
                  onCheckedChange={() => {
                    onSubtitlesChange?.(subtitle.code);
                  }}
                  className="cursor-pointer text-gray-200 focus:bg-gray-800"
                >
                  {subtitle.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullscreen}
            className="text-white hover:bg-white/20 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </Button>
        </div>
      </div>
    </div>
  );
};
