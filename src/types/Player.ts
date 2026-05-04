export interface PlayerState {
  state:
    | "idle"
    | "loading"
    | "buffering"
    | "playing"
    | "paused"
    | "ended"
    | "ready"
    | "error";
  currentTime: number;
  duration: number;
  title: string;
  isBuffering: boolean;
}

export interface Player {
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  setTitle(title: string): Promise<void>;
  getTitle(): Promise<string>;
  currentTime: number;
  duration: number;
  title: string;
  state: PlayerState["state"];
  addEventListener(
    event:
      | "ready"
      | "buffering"
      | "playing"
      | "paused"
      | "ended"
      | "progress"
      | "error",
    callback: (data: any) => void,
  ): void;
  removeEventListener(event: string, callback: (data: any) => void): void;
}
