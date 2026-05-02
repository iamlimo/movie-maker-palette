import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { ExoPlayer, type ExoPlayerLoadOptions, type ExoPlayerRect } from '@/plugins/exo-player';

export type ExoPlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export interface UseExoPlayerResult {
  isAvailable: boolean;
  state: ExoPlayerState;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  loadVideo: (options: ExoPlayerLoadOptions) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  stop: () => Promise<void>;
  release: () => Promise<void>;
  setRect: (rect: ExoPlayerRect) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
}

/**
 * React hook for the native Android ExoPlayer Capacitor plugin.
 * On non-Android platforms, isAvailable is false and methods are no-ops.
 */
export function useExoPlayer(options?: { onProgress?: (currentTime: number, duration: number) => void; onEnded?: () => void; }): UseExoPlayerResult {
  const isAvailable = Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ExoPlayer');

  const [state, setState] = useState<ExoPlayerState>('idle');
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handlesRef = useRef<PluginListenerHandle[]>([]);
  const onProgressRef = useRef(options?.onProgress);
  const onEndedRef = useRef(options?.onEnded);
  onProgressRef.current = options?.onProgress;
  onEndedRef.current = options?.onEnded;

  useEffect(() => {
    if (!isAvailable) return;
    let cancelled = false;

    (async () => {
      try {
        await ExoPlayer.initPlayer();
        const handles = await Promise.all([
          ExoPlayer.addListener('onReady', (e) => {
            setState('ready');
            setDuration(e.duration || 0);
            setError(null);
          }),
          ExoPlayer.addListener('onBuffering', () => { setIsBuffering(true); setState('buffering'); }),
          ExoPlayer.addListener('onPlaying', () => { setIsBuffering(false); setState('playing'); }),
          ExoPlayer.addListener('onPaused', () => { setState((s) => (s === 'ended' ? s : 'paused')); }),
          ExoPlayer.addListener('onEnded', () => { setState('ended'); onEndedRef.current?.(); }),
          ExoPlayer.addListener('onError', (e) => { setError(e.message); setState('error'); }),
          ExoPlayer.addListener('onProgress', (e) => {
            setCurrentTime(e.currentTime);
            if (e.duration) setDuration(e.duration);
            onProgressRef.current?.(e.currentTime, e.duration);
          }),
        ]);
        if (cancelled) {
          handles.forEach((h) => h.remove());
        } else {
          handlesRef.current = handles;
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to init ExoPlayer');
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      handlesRef.current.forEach((h) => { try { h.remove(); } catch {} });
      handlesRef.current = [];
      // Release native player on unmount.
      ExoPlayer.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable]);

  const loadVideo = useCallback(async (opts: ExoPlayerLoadOptions) => {
    if (!isAvailable) return;
    setState('loading');
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    await ExoPlayer.load(opts);
  }, [isAvailable]);

  const play = useCallback(() => isAvailable ? ExoPlayer.play() : Promise.resolve(), [isAvailable]);
  const pause = useCallback(() => isAvailable ? ExoPlayer.pause() : Promise.resolve(), [isAvailable]);
  const seekTo = useCallback((seconds: number) => isAvailable ? ExoPlayer.seekTo({ position: seconds }) : Promise.resolve(), [isAvailable]);
  const stop = useCallback(() => isAvailable ? ExoPlayer.stop() : Promise.resolve(), [isAvailable]);
  const release = useCallback(() => isAvailable ? ExoPlayer.release() : Promise.resolve(), [isAvailable]);
  const setRect = useCallback((rect: ExoPlayerRect) => isAvailable ? ExoPlayer.setRect(rect) : Promise.resolve(), [isAvailable]);
  const setPlaybackRate = useCallback((rate: number) => isAvailable ? ExoPlayer.setPlaybackRate({ rate }) : Promise.resolve(), [isAvailable]);

  return { isAvailable, state, isBuffering, currentTime, duration, error, loadVideo, play, pause, seekTo, stop, release, setRect, setPlaybackRate };
}

export default useExoPlayer;