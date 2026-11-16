import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSound } from "../audio/SoundContext";
import type { MoodName } from "../audio/musicTheory";
import { useApi, type Track } from "../services/api";
import { createHtmlAudioEngine, type PlaybackEngine } from "./engine";
import { loadPrefs, savePrefs } from "./prefs";

const noTracks: Track[] = [];

/** A random song from a list, or nothing if the list is empty. */
const randomOf = (list: Track[]): Track | undefined => list[Math.floor(Math.random() * list.length)];

type MusicApi = {
  /** Every active track, in the order set in the admin. */
  tracks: Track[];
  mood: MoodName;
  /** The active tracks of the current mood. */
  moodTracks: Track[];
  track: Track | undefined;
  playing: boolean;
  /** The browser refused to start the music on its own; one click will. */
  blocked: boolean;
  failed: boolean;
  volume: number;
  muted: boolean;
  /** Called from the entry screen's button, so playback starts inside the visitor's click. */
  begin: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  selectTrack: (id: number) => void;
  /** Plays any active track, switching to its mood first when it belongs to another one. */
  playTrack: (track: Track) => void;
  selectMood: (mood: MoodName) => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
};

type MusicTime = { time: number; duration: number };

const MusicContext = createContext<MusicApi | null>(null);
// The playback position changes several times a second, so it lives apart and
// only the progress bar listens to it.
const TimeContext = createContext<MusicTime>({ time: 0, duration: 0 });

// eslint-disable-next-line react-refresh/only-export-components
export function useMusic(): MusicApi {
  const value = useContext(MusicContext);
  if (!value) throw new Error("useMusic must be used inside MusicProvider");
  return value;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMusicTime = () => useContext(TimeContext);

/**
 * The site's one music player. It sits above the entry screen and the whole
 * portfolio, so the audio is created once and carries on across sections.
 * Which tracks play comes from the mood chosen on the entry screen.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const { mood, setMood } = useSound();
  const { data: tracks } = useApi<Track[]>("/music/tracks", noTracks);

  const [initial] = useState(loadPrefs);
  const [started, setStarted] = useState(false);
  const [trackId, setTrackId] = useState<number | undefined>(initial.trackId);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [volume, setVolumeState] = useState(initial.volume ?? 0.7);
  const [muted, setMuted] = useState(initial.muted ?? false);
  const [time, setTime] = useState<MusicTime>({ time: 0, duration: 0 });

  const engineRef = useRef<PlaybackEngine | null>(null);
  // Whether the visitor wants music right now. A visitor who paused last time starts quiet.
  const wantPlay = useRef(!initial.paused);
  const resumeAt = useRef(initial.position ?? 0);
  const lastSaved = useRef(0);
  // The address the engine currently holds, so the same track is never loaded twice.
  const loaded = useRef<string | undefined>(undefined);
  // Entering before the song list has arrived: choose the random song as soon as it does.
  const pendingRandom = useRef(false);

  const moodTracks = useMemo(() => tracks.filter((t) => t.mood === mood), [tracks, mood]);
  const track = moodTracks.find((t) => t.id === trackId) ?? moodTracks[0];
  const trackRef = useRef(track);
  const moodTracksRef = useRef(moodTracks);
  useEffect(() => {
    trackRef.current = track;
    moodTracksRef.current = moodTracks;
  });

  // The song list arrived after the visitor had already entered.
  useEffect(() => {
    if (!started || !pendingRandom.current || moodTracks.length === 0) return;
    pendingRandom.current = false;
    const pick = randomOf(moodTracks);
    if (!pick) return;
    savePrefs({ trackId: pick.id, paused: false, position: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrackId(pick.id);
  }, [started, moodTracks]);

  const tryPlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine
      .play()
      .then(() => setBlocked(false))
      .catch((error: unknown) => {
        // NotAllowedError is the browser's autoplay rule: wait for a click. Anything else is a real failure.
        if (error instanceof DOMException && error.name === "NotAllowedError") setBlocked(true);
        else setFailed(true);
      });
  }, []);

  const step = useCallback(
    (delta: number) => {
      const list = moodTracksRef.current;
      if (list.length === 0) return;
      const at = Math.max(0, list.findIndex((t) => t.id === trackRef.current?.id));
      const target = list[(at + delta + list.length) % list.length]!;
      wantPlay.current = true;
      savePrefs({ paused: false, trackId: target.id, position: 0 });
      resumeAt.current = 0;
      if (target.id === trackRef.current?.id) {
        engineRef.current?.seek(0);
        tryPlay();
      } else {
        setTrackId(target.id);
      }
    },
    [tryPlay]
  );

  // One engine for the life of the site; the listener is attached once.
  useEffect(() => {
    const engine = createHtmlAudioEngine();
    engineRef.current = engine;
    engine.setVolume(initial.volume ?? 0.7, initial.muted ?? false);
    const off = engine.subscribe((event) => {
      if (event.type === "playing") {
        setPlaying(true);
        setFailed(false);
      } else if (event.type === "paused") {
        setPlaying(false);
      } else if (event.type === "time") {
        setTime({ time: event.time, duration: Number.isFinite(event.duration) ? event.duration : 0 });
        // Remember the place now and then, not on every tick.
        const now = Date.now();
        if (now - lastSaved.current > 4000) {
          lastSaved.current = now;
          savePrefs({ position: event.time });
        }
      } else if (event.type === "ended") {
        step(1);
      } else if (event.type === "error") {
        setFailed(true);
        setPlaying(false);
      }
    });
    return () => {
      off();
      engine.destroy();
      engineRef.current = null;
    };
    // The engine is created once; step and the initial preferences never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load a track when the visitor has entered and the track actually changes.
  const source = started ? track?.audioUrl : undefined;
  const trackKey = track?.id;
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !source) return;
    if (loaded.current !== source) {
      loaded.current = source;
      setFailed(false);
      setTime({ time: 0, duration: 0 });
      engine.load(source, resumeAt.current);
      resumeAt.current = 0;
    }
    if (wantPlay.current) tryPlay();
  }, [source, trackKey, tryPlay]);

  useEffect(() => {
    engineRef.current?.setVolume(volume, muted);
  }, [volume, muted]);

  // Keep the phone's lock screen and media keys in step with the player.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !started) return;
    const session = navigator.mediaSession;
    if (track) {
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: mood,
        ...(track.coverUrl ? { artwork: [{ src: track.coverUrl }] } : {}),
      });
    }
    session.playbackState = playing ? "playing" : "paused";
    return () => {
      session.metadata = null;
    };
  }, [started, track, mood, playing]);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      wantPlay.current = false;
      savePrefs({ paused: true });
      engine.pause();
    } else {
      wantPlay.current = true;
      savePrefs({ paused: false });
      if (!started) setStarted(true);
      tryPlay();
    }
  }, [playing, started, tryPlay]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !started) return;
    const session = navigator.mediaSession;
    session.setActionHandler("play", toggle);
    session.setActionHandler("pause", toggle);
    session.setActionHandler("nexttrack", () => step(1));
    session.setActionHandler("previoustrack", () => step(-1));
    return () => {
      for (const action of ["play", "pause", "nexttrack", "previoustrack"] as const) {
        session.setActionHandler(action, null);
      }
    };
  }, [started, toggle, step]);

  const api = useMemo<MusicApi>(
    () => ({
      tracks,
      mood,
      moodTracks,
      track,
      playing,
      blocked,
      failed,
      volume,
      muted,
      begin: () => {
        setStarted(true);
        // Every visit opens with a different song from the chosen mood, playing from its start.
        // Pressing Enter is the visitor's own click, so the browser lets the music begin now.
        wantPlay.current = true;
        resumeAt.current = 0;
        const pick = randomOf(moodTracksRef.current);
        if (!pick) {
          pendingRandom.current = true;
          return;
        }
        savePrefs({ trackId: pick.id, paused: false, position: 0 });
        setTrackId(pick.id);
        const engine = engineRef.current;
        if (engine) {
          loaded.current = pick.audioUrl;
          engine.load(pick.audioUrl, 0);
          tryPlay();
        }
      },
      toggle,
      next: () => step(1),
      previous: () => step(-1),
      selectTrack: (id) => {
        wantPlay.current = true;
        resumeAt.current = 0;
        savePrefs({ trackId: id, paused: false, position: 0 });
        if (id === trackRef.current?.id) {
          engineRef.current?.seek(0);
          tryPlay();
        } else {
          setTrackId(id);
        }
      },
      playTrack: (target) => {
        wantPlay.current = true;
        resumeAt.current = 0;
        savePrefs({ mood: target.mood, trackId: target.id, paused: false, position: 0 });
        if (target.mood !== mood) setMood(target.mood);
        if (target.id === trackRef.current?.id && target.mood === mood) {
          engineRef.current?.seek(0);
          tryPlay();
        } else {
          setTrackId(target.id);
        }
      },
      selectMood: (next) => {
        if (next === mood) return;
        wantPlay.current = true;
        resumeAt.current = 0;
        // A different mood starts on a random song of its own.
        const pick = randomOf(tracks.filter((t) => t.mood === next));
        setTrackId(pick?.id);
        savePrefs({ mood: next, trackId: pick?.id, paused: false, position: 0 });
        setMood(next);
      },
      seek: (seconds) => {
        engineRef.current?.seek(seconds);
        setTime((t) => ({ ...t, time: seconds }));
      },
      setVolume: (next) => {
        setVolumeState(next);
        setMuted(false);
        savePrefs({ volume: next, muted: false });
      },
      toggleMute: () => {
        setMuted((m) => {
          savePrefs({ muted: !m });
          return !m;
        });
      },
    }),
    [tracks, mood, moodTracks, track, playing, blocked, failed, volume, muted, toggle, step, tryPlay, setMood]
  );

  return (
    <MusicContext.Provider value={api}>
      <TimeContext.Provider value={time}>{children}</TimeContext.Provider>
    </MusicContext.Provider>
  );
}
