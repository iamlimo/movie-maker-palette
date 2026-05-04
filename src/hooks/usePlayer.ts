import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
const { ExoPlayer } = Capacitor.Plugins;
import type { Player, PlayerState } from '../types/Player';

export const usePlayer = (): Player => {
  const [state, setState] = useState<PlayerState>({
    state: 'idle',
    currentTime: 0,
    duration: 0,
    title: '',
    isBuffering: false,
  });
  const eventCallbacks = useRef<Map<string, ((data: Record<string, unknown>) => void)[]>>().current;

  // Register listeners once
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const addListener = (event: string, callback: (data: any) => void) => {
      ExoPlayer.addListener(event, callback);
      if (!eventCallbacks.has(event)) eventCallbacks.set(event, []);
      eventCallbacks.get(event)!.push(callback);
      return () => {
        const callbacks = eventCallbacks.get(event);
        if (callbacks) {
          const idx = callbacks.indexOf(callback);
          if (idx > -1) callbacks.splice(idx, 1);
        }
      };
    };

    const unsubReady = addListener('onReady', (data) => {
      setState(prev => ({ ...prev, state: 'ready', duration: data.duration || 0, title: data.title || '' }));
    });
    const unsubBuffering = addListener('onBuffering', () => setState(prev => ({ ...prev, state: 'buffering', isBuffering: true })));
    const unsubPlaying = addListener('onPlaying', () => setState(prev => ({ ...prev, state: 'playing', isBuffering: false })));
    const unsubPaused = addListener('onPaused', () => setState(prev => ({ ...prev, state: 'paused', isBuffering: false })));
    const unsubEnded = addListener('onEnded', () => setState(prev => ({ ...prev, state: 'ended' })));
    const unsubProgress = addListener('onProgress', (data) => {
      setState(prev => ({ ...prev, currentTime: data.currentTime || 0, duration: data.duration || 0, title: data.title || prev.title }));
    });
    const unsubError = addListener('onError', (data) => {
      console.error('Player error:', data);
      setState(prev => ({ ...prev, state: 'error' }));
    });

    return () => {
      [unsubReady, unsubBuffering, unsubPlaying, unsubPaused, unsubEnded, unsubProgress, unsubError].forEach(unsub => unsub?.());
      eventCallbacks.clear();
    };
  }, []);

  const play = useCallback(async () => {
    if (Capacitor.getPlatform() === 'android') await ExoPlayer.play();
    setState(prev => ({ ...prev, state: 'playing' }));
  }, []);

  const pause = useCallback(async () => {
    if (Capacitor.getPlatform() === 'android') await ExoPlayer.pause();
    setState(prev => ({ ...prev, state: 'paused' }));
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    if (Capacitor.getPlatform() === 'android') await ExoPlayer.seekTo({ position: seconds });
    setState(prev => ({ ...prev, currentTime: seconds }));
  }, []);

  const setTitle = useCallback(async (title: string) => {
    if (Capacitor.getPlatform() === 'android') await ExoPlayer.setTitle({ title });
    setState(prev => ({ ...prev, title }));
  }, []);

  const getTitle = useCallback(async (): Promise<string> => {
    if (Capacitor.getPlatform() === 'android') {
      const ret = await ExoPlayer.getTitle();
      return ret.title || '';
    }
    return state.title;
  }, [state.title]);

  const addEventListener = useCallback((event: string, callback: (data: any) => void) => {
    // For web fallback or future, store callbacks
    if (!eventCallbacks.has(event)) eventCallbacks.set(event, []);
    eventCallbacks.get(event)!.push(callback);
  }, []);

  const removeEventListener = useCallback((event: string, callback: (data: any) => void) => {
    const callbacks = eventCallbacks.get(event);
    if (callbacks) {
      const idx = callbacks.indexOf(callback);
      if (idx > -1) callbacks.splice(idx, 1);
    }
  }, []);

  return {
    play,
    pause,
    seekTo,
    setTitle,
    getTitle,
    currentTime: state.currentTime,
    duration: state.duration,
    title: state.title,
    state: state.state,
    addEventListener,
    removeEventListener,
  };
};
