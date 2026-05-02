import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type ExoPlayerSourceType = 'hls' | 'progressive';

export interface ExoPlayerLoadOptions {
  url: string;
  type?: ExoPlayerSourceType;
  startPositionMs?: number;
  subtitleUrl?: string;
  subtitleLanguage?: string;
}

export interface ExoPlayerRect {
  /** CSS pixels */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExoPlayerProgressEvent {
  currentTime: number; // seconds
  duration: number;    // seconds
}

export interface ExoPlayerErrorEvent {
  code: string;
  message: string;
}

export interface ExoPlayerReadyEvent {
  duration: number;
}

export interface ExoPlayerPlugin {
  initPlayer(): Promise<void>;
  load(options: ExoPlayerLoadOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(options: { position: number }): Promise<void>;
  stop(): Promise<void>;
  release(): Promise<void>;
  setRect(options: ExoPlayerRect): Promise<void>;
  getDuration(): Promise<{ duration: number }>;
  getCurrentTime(): Promise<{ currentTime: number }>;
  setPlaybackRate(options: { rate: number }): Promise<void>;

  addListener(eventName: 'onReady', cb: (e: ExoPlayerReadyEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onBuffering', cb: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onPlaying', cb: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onPaused', cb: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onEnded', cb: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onError', cb: (e: ExoPlayerErrorEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onProgress', cb: (e: ExoPlayerProgressEvent) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const ExoPlayer = registerPlugin<ExoPlayerPlugin>('ExoPlayer');