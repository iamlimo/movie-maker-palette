import { Capacitor } from '@capacitor/core';
import { useToast } from './use-toast';
import { useEffect, useState } from 'react';

export const useNativeVideoOptimization = () => {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  const [supportsNativePlayer, setSupportsNativePlayer] = useState(false);

  useEffect(() => {
    const setup = async () => {
      const isNative = Capacitor.isNativePlatform();
      if (!isNative) {
        setPlatform('web');
        setSupportsNativePlayer(false);
        return;
      }

      const currentPlatform = Capacitor.getPlatform();
      setPlatform(currentPlatform as any);

      // Native player availability:
      // - Android: custom ExoPlayer Capacitor plugin (registered as "ExoPlayer")
      // - iOS: legacy capacitor-community/video-player if installed (best-effort)
      if (currentPlatform === 'android') {
        setSupportsNativePlayer(Capacitor.isPluginAvailable('ExoPlayer'));
      } else if (currentPlatform === 'ios') {
        setSupportsNativePlayer(Capacitor.isPluginAvailable('VideoPlayer'));
      } else {
        setSupportsNativePlayer(false);
      }
    };

    setup();
  }, []);

  // Optimize video URL for native playback
  const optimizeVideoUrl = (url: string): string => {
    if (platform === 'ios' || platform === 'android') {
      // Ensure URL supports range requests (needed for seeking)
      // Add CORS headers if needed
      return url;
    }
    return url;
  };

  // Get optimal buffer size for platform
  const getBufferConfig = () => {
    switch (platform) {
      case 'ios':
        return {
          minBuffer: 1024 * 1024, // 1MB
          maxBuffer: 5 * 1024 * 1024, // 5MB
          playbackRate: [0.75, 1.0, 1.25, 1.5],
          enableAirPlay: true,
        };
      case 'android':
        return {
          minBuffer: 512 * 1024, // 512KB
          maxBuffer: 3 * 1024 * 1024, // 3MB
          playbackRate: [1.0, 1.25, 1.5, 2.0],
          enableAirPlay: false,
        };
      default:
        return {
          minBuffer: 2 * 1024 * 1024, // 2MB
          maxBuffer: 10 * 1024 * 1024, // 10MB
          playbackRate: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
          enableAirPlay: false,
        };
    }
  };

  // Platform-specific fullscreen handling
  const requestFullscreen = async (element: HTMLVideoElement | null) => {
    if (!element) return;

    try {
      if (platform === 'ios') {
        // iOS uses native fullscreen
        const anyEl = element as any;
        if (typeof anyEl.webkitEnterFullscreen === 'function') {
          anyEl.webkitEnterFullscreen();
        }
      } else if (platform === 'android') {
        // Android uses standard fullscreen API
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        }
      } else {
        // Web
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          (element as any).webkitRequestFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  // Exit fullscreen
  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        (document as any).webkitExitFullscreen?.();
      }
    } catch (err) {
      console.error('Exit fullscreen failed:', err);
    }
  };

  // Handle subtitle loading for platform
  const loadSubtitles = async (subtitleUrl: string): Promise<string> => {
    // On native, subtitle handling might be different
    // Return the URL as-is for now
    return subtitleUrl;
  };

  // Platform-specific video codec check
  const canPlayCodec = (codec: string): boolean => {
    const video = document.createElement('video');
    return video.canPlayType(codec) !== '';
  };

  return {
    platform,
    supportsNativePlayer,
    optimizeVideoUrl,
    getBufferConfig,
    requestFullscreen,
    exitFullscreen,
    loadSubtitles,
    canPlayCodec,
  };
};

export default useNativeVideoOptimization;
