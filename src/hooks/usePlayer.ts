import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Player, PlayerState } from '../types/Player';

export const usePlayer = (): Player => {
  const nativePlayerEnabled = false;
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
    if (!nativePlayerEnabled || Capacitor.getPlatform() !== 'android') return;

    // ExoPlayer is intentionally disabled. Capgo VideoPlayer owns native playback.
  }, [nativePlayerEnabled]);

  const play = useCallback(async () => {
    if (!nativePlayerEnabled) {
      setState(prev => ({ ...prev, state: 'playing' }));
      return;
    }
    setState(prev => ({ ...prev, state: 'playing' }));
  }, [nativePlayerEnabled]);

  const pause = useCallback(async () => {
    if (!nativePlayerEnabled) {
      setState(prev => ({ ...prev, state: 'paused' }));
      return;
    }
    setState(prev => ({ ...prev, state: 'paused' }));
  }, [nativePlayerEnabled]);

  const seekTo = useCallback(async (seconds: number) => {
    if (!nativePlayerEnabled) {
      setState(prev => ({ ...prev, currentTime: seconds }));
      return;
    }
    setState(prev => ({ ...prev, currentTime: seconds }));
  }, [nativePlayerEnabled]);

  const setTitle = useCallback(async (title: string) => {
    if (!nativePlayerEnabled) {
      setState(prev => ({ ...prev, title }));
      return;
    }
    setState(prev => ({ ...prev, title }));
  }, [nativePlayerEnabled]);

  const getTitle = useCallback(async (): Promise<string> => {
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
