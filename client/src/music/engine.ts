/**
 * What the player needs from whatever is producing the sound. Today that is a
 * single HTML audio element playing files we host. A different source (for
 * example a streaming provider's own SDK) can implement the same interface and
 * the player, the track list and the mood logic stay as they are.
 */

export type EngineEvent =
  | { type: "playing" }
  | { type: "paused" }
  | { type: "time"; time: number; duration: number }
  | { type: "ended" }
  | { type: "error" };

export interface PlaybackEngine {
  /** Points the engine at a track. Does not start it. */
  load(source: string, startAt?: number): void;
  /** Starts or resumes. Rejects if the browser blocks it. */
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number, muted: boolean): void;
  subscribe(listener: (event: EngineEvent) => void): () => void;
  destroy(): void;
}

/** The engine for audio files: one `Audio` element for the lifetime of the site. */
export function createHtmlAudioEngine(): PlaybackEngine {
  const audio = new Audio();
  audio.preload = "none";
  const listeners = new Set<(event: EngineEvent) => void>();
  const emit = (event: EngineEvent) => listeners.forEach((listener) => listener(event));

  const onTime = () => emit({ type: "time", time: audio.currentTime, duration: audio.duration });
  const onPlaying = () => emit({ type: "playing" });
  const onPause = () => emit({ type: "paused" });
  const onEnded = () => emit({ type: "ended" });
  const onError = () => emit({ type: "error" });

  audio.addEventListener("timeupdate", onTime);
  audio.addEventListener("loadedmetadata", onTime);
  audio.addEventListener("durationchange", onTime);
  audio.addEventListener("play", onPlaying);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);

  return {
    load(source, startAt = 0) {
      audio.src = source;
      // Setting the time before metadata arrives is ignored by some browsers, so wait for it.
      if (startAt > 0) {
        const apply = () => {
          audio.currentTime = startAt;
          audio.removeEventListener("loadedmetadata", apply);
        };
        audio.addEventListener("loadedmetadata", apply);
      }
    },
    play: () => audio.play(),
    pause: () => audio.pause(),
    seek(seconds) {
      audio.currentTime = seconds;
    },
    setVolume(volume, muted) {
      audio.volume = volume;
      audio.muted = muted;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("play", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      listeners.clear();
    },
  };
}
