import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MovieInfoOverlayProps {
  isVisible: boolean;
  title?: string;
  subtitle?: string;
  cast?: string[];
  director?: string;
  description?: string;
  posterUrl?: string;
  episodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  onClose: () => void;
}

export const MovieInfoOverlay: React.FC<MovieInfoOverlayProps> = ({
  isVisible,
  title,
  subtitle,
  cast,
  director,
  description,
  posterUrl,
  episodeTitle,
  seasonNumber,
  episodeNumber,
  onClose,
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-gradient-to-b from-gray-900 to-black border border-gray-700 rounded-lg overflow-hidden
                      max-h-[80vh] overflow-y-auto">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-40 text-white hover:bg-white/20 transition-colors"
          title="Close"
        >
          <X size={24} />
        </Button>

        {/* Poster Image */}
        {posterUrl && (
          <div className="relative w-full h-64 overflow-hidden">
            <img
              src={posterUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-900" />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Episode Info */}
          {episodeTitle && (
            <div className="text-sm text-gray-400 mb-2">
              {seasonNumber && episodeNumber && (
                <span>Season {seasonNumber} • Episode {episodeNumber}</span>
              )}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>

          {/* Subtitle/Episode Title */}
          {subtitle || episodeTitle ? (
            <p className="text-lg text-gray-300 mb-4">{subtitle || episodeTitle}</p>
          ) : null}

          {/* Director */}
          {director && (
            <div className="mb-4">
              <p className="text-sm text-gray-400">
                <span className="font-semibold">Director:</span> {director}
              </p>
            </div>
          )}

          {/* Cast */}
          {cast && cast.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-300 mb-2">Cast:</p>
              <div className="flex flex-wrap gap-2">
                {cast.map((member, index) => (
                  <span
                    key={index}
                    className="inline-block px-3 py-1 bg-gray-800 text-gray-200 text-sm rounded-full hover:bg-gray-700 transition-colors"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="mt-6">
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">
                {description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
