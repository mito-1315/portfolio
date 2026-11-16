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
import type { Filter, Reverb, Sampler } from "tone";
import { emitPianoNote } from "./pianoBus";
import { SAMPLE_BASE_URL, SAMPLE_URLS } from "./pianoSamples";
import {
  INSTRUMENTS,
  defaultMood,
  noteToMidi,
  scaleFor,
  snapToScale,
  type InstrumentName,
  type MoodName,
} from "./musicTheory";

/**
 * Tone.js is large, and nothing needs it until a visitor turns sound on, so it
 * is loaded on demand rather than shipped with the first page.
 */
type ToneModule = typeof import("tone");
const loadTone = () => import("tone");

type SoundApi = {
  enabled: boolean;
  /** True once the piano samples have finished loading. */
  ready: boolean;
  instrument: InstrumentName;
  /** The mood chosen on the entry screen; sets the key of every interface note. */
  mood: MoodName;
  toggle: () => void;
  /** Starts fetching the audio code early, e.g. when the visitor hovers a sound control. */
  preload: () => void;
  /** Sets the mood whose scale interface notes are snapped to. */
  setMood: (mood: MoodName) => void;
  setInstrument: (name: InstrumentName) => void;
  /** Plays one short interface note, snapped to the mood's scale. */
  play: (note: string) => void;
  /** Plays a short phrase (scale-snapped), notes spaced ~0.16s apart. */
  playMotif: (notes: string[]) => void;
  /** Plays a note exactly as given, e.g. for the virtual piano. */
  playExact: (note: string, velocity?: number) => void;
  /** Starts a note and holds it until `noteOff`. Returns false if nothing sounded. */
  noteOn: (note: string, velocity?: number) => boolean;
  noteOff: (note: string) => void;
};

const STORAGE_KEY = "portfolio-sound";
const SoundContext = createContext<SoundApi | null>(null);

/** Sound is off until the visitor turns it on; the choice lasts for the session. */
function readStoredPreference(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/** Tells the particle piano (and anyone else listening) which key sounded. */
function announce(note: string, velocity: number) {
  const midi = noteToMidi(note);
  if (midi !== null) emitPianoNote(midi, velocity);
}

/** Slight, natural variation so repeated notes don't sound mechanical. */
const humanVelocity = () => 0.5 + Math.random() * 0.25;

type Engine = {
  sampler: Sampler;
  filter: Filter;
  reverb: Reverb;
};

/**
 * The single audio engine for the site: a sampled grand piano. Nothing is
 * downloaded or heard until the visitor turns sound on.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(readStoredPreference);
  const [ready, setReady] = useState(false);
  const [instrument, setInstrumentState] = useState<InstrumentName>("grand");
  const [mood, setMoodState] = useState<MoodName>(defaultMood);

  const enabledRef = useRef(enabled);
  const toneRef = useRef<ToneModule | null>(null);
  const loadingRef = useRef(false);
  const engineRef = useRef<Engine | null>(null);
  const readyRef = useRef(false);
  const unmountedRef = useRef(false);
  const instrumentRef = useRef<InstrumentName>("grand");
  const pitchClasses = useRef(scaleFor(defaultMood).pitchClasses);
  const lastPlayed = useRef(0);

  const applyInstrument = useCallback((name: InstrumentName) => {
    const engine = engineRef.current;
    if (!engine) return;
    const spec = INSTRUMENTS[name];
    engine.filter.frequency.rampTo(spec.cutoff, 0.15);
    engine.reverb.wet.rampTo(spec.reverb, 0.15);
    engine.sampler.volume.rampTo(spec.volume, 0.15);
  }, []);

  const preload = useCallback(() => {
    // Ignore failures here: the real load happens when sound is turned on.
    void loadTone().catch(() => {});
  }, []);

  /** Loads the audio code, starts the audio context and loads the samples, once. */
  const ensureEngine = useCallback(() => {
    // Already loaded: just make sure the context is running (browsers suspend it).
    if (toneRef.current) {
      toneRef.current.start().catch(() => {});
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;

    loadTone()
      .then((Tone) => {
        if (unmountedRef.current) return;
        toneRef.current = Tone;
        // Still inside the click that asked for sound, which the browser requires.
        Tone.start().catch(() => {});

        const reverb = new Tone.Reverb({ decay: 2.4, wet: INSTRUMENTS.grand.reverb });
        const filter = new Tone.Filter({ type: "lowpass", frequency: INSTRUMENTS.grand.cutoff });
        const sampler = new Tone.Sampler({
          urls: SAMPLE_URLS,
          baseUrl: SAMPLE_BASE_URL,
          release: 1.2,
          onload: () => {
            readyRef.current = true;
            setReady(true);
          },
          onerror: () => {
            // Visuals must work without audio.
            readyRef.current = false;
          },
        });
        sampler.volume.value = INSTRUMENTS.grand.volume;
        sampler.chain(filter, reverb, Tone.getDestination());
        engineRef.current = { sampler, filter, reverb };
        applyInstrument(instrumentRef.current);
      })
      .catch(() => {
        // Offline, or the chunk failed: the site stays silent and everything else works.
        loadingRef.current = false;
      });
  }, [applyInstrument]);

  useEffect(() => {
    unmountedRef.current = false;
    // A remembered "on" has no click behind it yet: wait for the first gesture.
    const unlock = () => {
      if (enabledRef.current) ensureEngine();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      unmountedRef.current = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      const engine = engineRef.current;
      if (engine) {
        engine.sampler.dispose();
        engine.filter.dispose();
        engine.reverb.dispose();
      }
      engineRef.current = null;
      readyRef.current = false;
    };
  }, [ensureEngine]);

  const canPlay = useCallback(
    () =>
      enabledRef.current &&
      readyRef.current &&
      engineRef.current !== null &&
      toneRef.current !== null &&
      toneRef.current.getContext().state === "running",
    []
  );

  const trigger = useCallback((note: string, velocity: number, when?: number) => {
    try {
      engineRef.current?.sampler.triggerAttackRelease(note, "4n", when, velocity);
      announce(note, velocity);
    } catch {
      // ignore: the note was out of the sampler's range
    }
  }, []);

  const playExact = useCallback(
    (note: string, velocity = humanVelocity()) => {
      if (!canPlay()) return;
      trigger(note, velocity);
    },
    [canPlay, trigger]
  );

  const noteOn = useCallback(
    (note: string, velocity = humanVelocity()) => {
      if (!canPlay()) return false;
      try {
        engineRef.current?.sampler.triggerAttack(note, undefined, velocity);
        announce(note, velocity);
        return true;
      } catch {
        return false;
      }
    },
    [canPlay]
  );

  const noteOff = useCallback((note: string) => {
    try {
      engineRef.current?.sampler.triggerRelease(note);
    } catch {
      // ignore
    }
  }, []);

  const play = useCallback(
    (note: string) => {
      if (!canPlay()) return;
      const now = Date.now();
      if (now - lastPlayed.current < 100) return;
      lastPlayed.current = now;
      trigger(snapToScale(note, pitchClasses.current), humanVelocity());
    },
    [canPlay, trigger]
  );

  const playMotif = useCallback(
    (notes: string[]) => {
      const Tone = toneRef.current;
      if (!Tone || !canPlay()) return;
      const now = Date.now();
      if (now - lastPlayed.current < 900) return;
      lastPlayed.current = now;
      const start = Tone.now() + 0.05;
      notes.forEach((note, i) =>
        trigger(snapToScale(note, pitchClasses.current), humanVelocity(), start + i * 0.16)
      );
    },
    [canPlay, trigger]
  );

  const setMood = useCallback((next: MoodName) => {
    pitchClasses.current = scaleFor(next).pitchClasses;
    setMoodState(next);
  }, []);

  const setInstrument = useCallback(
    (name: InstrumentName) => {
      instrumentRef.current = name;
      setInstrumentState(name);
      applyInstrument(name);
    },
    [applyInstrument]
  );

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // ignore
    }
    // The click that toggles sound is the gesture the browser requires.
    if (next) ensureEngine();
  }, [ensureEngine]);

  const api = useMemo(
    () => ({
      enabled,
      ready,
      instrument,
      mood,
      toggle,
      preload,
      setMood,
      setInstrument,
      play,
      playMotif,
      playExact,
      noteOn,
      noteOff,
    }),
    [enabled, ready, instrument, mood, toggle, preload, setMood, setInstrument, play, playMotif, playExact, noteOn, noteOff]
  );

  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSound(): SoundApi {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used inside SoundProvider");
  return ctx;
}
