import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Download, Play, Square, Trash2 } from "lucide-react";
import { INSTRUMENTS, midiToNote, type InstrumentName } from "../../audio/musicTheory";
import { isKeyboardForced } from "../../audio/pianoBus";
import { useSound } from "../../audio/SoundContext";
import { downloadMidi, type RecordedEvent } from "./midi";
import "./VirtualPiano.css";

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const BASE_OCTAVES = [2, 3, 4, 5] as const;
const MAX_RECORDING_MS = 120_000;

type ScaleChoice = { id: string; label: string; pitchClasses: number[] | null };

const SCALES: ScaleChoice[] = [
  { id: "chromatic", label: "All notes", pitchClasses: null },
  { id: "c-major", label: "C major", pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
  { id: "g-major", label: "G major", pitchClasses: [7, 9, 11, 0, 2, 4, 6] },
  { id: "a-minor", label: "A minor", pitchClasses: [9, 11, 0, 2, 4, 5, 7] },
];

/** Computer-keyboard layout: white keys on the home row, black keys above. */
const WHITE_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEYS: Record<string, number> = { w: 0, e: 1, t: 3, y: 4, u: 5, o: 7, p: 8 };

const whiteSemitone = (index: number) =>
  12 * Math.floor(index / 7) + (WHITE_OFFSETS[index % 7] as number);

/** Is the user typing into a form field? Then piano shortcuts must stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

type Status = "idle" | "recording" | "playing";

/** On narrow screens the keyboard spans one octave, so each key is big enough for a finger. */
function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const onChange = () => setCompact(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return compact;
}

function VirtualPiano() {
  const compact = useCompact();
  const span = compact ? 12 : 24;
  const { enabled, ready, toggle, instrument, setInstrument, noteOn, noteOff } = useSound();

  const [baseOctave, setBaseOctave] = useState<number>(3);
  const [scaleId, setScaleId] = useState("chromatic");
  const [locked, setLocked] = useState(false);
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [eventCount, setEventCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inViewRef = useRef(false);
  const pressedRef = useRef(new Set<number>());
  const pointerNotes = useRef(new Map<number, number>());
  const keyboardNotes = useRef(new Map<string, number>());
  const events = useRef<RecordedEvent[]>([]);
  const recordStart = useRef(0);
  const statusRef = useRef<Status>("idle");
  const timers = useRef<number[]>([]);
  const baseRef = useRef(baseOctave);

  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0]!;
  const scaleRef = useRef(scale);
  const lockedRef = useRef(locked);

  useEffect(() => {
    baseRef.current = baseOctave;
    scaleRef.current = scale;
    lockedRef.current = locked;
    statusRef.current = status;
  }, [baseOctave, scale, locked, status]);

  /* ---------- Layout: two octaves and the top C ---------- */

  const keys = useMemo(() => {
    const first = 12 * (baseOctave + 1);
    const whites: number[] = [];
    const blacks: { midi: number; after: number }[] = [];
    for (let midi = first; midi <= first + span; midi++) {
      if (BLACK_PITCH_CLASSES.has(midi % 12)) blacks.push({ midi, after: whites.length - 1 });
      else whites.push(midi);
    }
    return { first, whites, blacks };
  }, [baseOctave, span]);

  const inScale = useCallback(
    (midi: number) => scale.pitchClasses === null || scale.pitchClasses.includes(midi % 12),
    [scale]
  );

  /* ---------- Sounding and showing notes ---------- */

  const markPressed = useCallback((midi: number, down: boolean) => {
    if (down) pressedRef.current.add(midi);
    else pressedRef.current.delete(midi);
    setPressed(new Set(pressedRef.current));
  }, []);

  const record = useCallback((midi: number, on: boolean, velocity: number) => {
    if (statusRef.current !== "recording") return;
    const now = performance.now();
    if (events.current.length === 0) recordStart.current = now;
    events.current.push({ time: now - recordStart.current, midi, on, velocity });
    setEventCount(events.current.length);
    if (on) setNoteCount((count) => count + 1);
  }, []);

  const startNote = useCallback(
    (midi: number, velocity: number) => {
      if (pressedRef.current.has(midi)) return;
      const pcs = scaleRef.current.pitchClasses;
      if (lockedRef.current && pcs && !pcs.includes(midi % 12)) return;
      noteOn(midiToNote(midi), velocity);
      markPressed(midi, true);
      record(midi, true, velocity);
    },
    [noteOn, markPressed, record]
  );

  const stopNote = useCallback(
    (midi: number) => {
      if (!pressedRef.current.has(midi)) return;
      noteOff(midiToNote(midi));
      markPressed(midi, false);
      record(midi, false, 0);
    },
    [noteOff, markPressed, record]
  );

  const releaseAll = useCallback(() => {
    [...pressedRef.current].forEach((midi) => {
      noteOff(midiToNote(midi));
    });
    pressedRef.current.clear();
    pointerNotes.current.clear();
    keyboardNotes.current.clear();
    setPressed(new Set());
  }, [noteOff]);

  /* ---------- Mouse and touch ---------- */

  const keyUnder = (x: number, y: number): { midi: number; velocity: number } | null => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-midi]");
    if (!element || !rootRef.current?.contains(element)) return null;
    const rect = element.getBoundingClientRect();
    const depth = Math.min(1, Math.max(0, (y - rect.top) / rect.height));
    return { midi: Number(element.dataset.midi), velocity: 0.4 + depth * 0.55 };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const hit = keyUnder(event.clientX, event.clientY);
    if (!hit) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not an active pointer; the key still plays.
    }
    pointerNotes.current.set(event.pointerId, hit.midi);
    startNote(hit.midi, hit.velocity);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = pointerNotes.current.get(event.pointerId);
    if (held === undefined) return;
    const hit = keyUnder(event.clientX, event.clientY);
    if (hit && hit.midi !== held) {
      // Sliding across the keys plays a glissando.
      stopNote(held);
      pointerNotes.current.set(event.pointerId, hit.midi);
      startNote(hit.midi, hit.velocity);
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = pointerNotes.current.get(event.pointerId);
    if (held === undefined) return;
    pointerNotes.current.delete(event.pointerId);
    stopNote(held);
  };

  /* ---------- Computer keyboard ---------- */

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = Boolean(entry?.isIntersecting);
        if (!entry?.isIntersecting) releaseAll();
      },
      { threshold: 0.2 }
    );
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [releaseAll]);

  useEffect(() => {
    const midiFor = (key: string): number | null => {
      const first = 12 * (baseRef.current + 1);
      const whiteIndex = WHITE_KEYS.indexOf(key);
      if (whiteIndex >= 0) return first + whiteSemitone(whiteIndex);
      const blackAfter = BLACK_KEYS[key];
      if (blackAfter !== undefined) return first + whiteSemitone(blackAfter) + 1;
      return null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((!inViewRef.current && !isKeyboardForced()) || isTyping(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === "z" || key === "x") {
        if (event.repeat) return;
        const next = baseRef.current + (key === "x" ? 1 : -1);
        if (next >= BASE_OCTAVES[0] && next <= BASE_OCTAVES[BASE_OCTAVES.length - 1]!) {
          releaseAll();
          setBaseOctave(next);
        }
        return;
      }

      const midi = midiFor(key);
      if (midi === null) return;
      event.preventDefault();
      if (event.repeat || keyboardNotes.current.has(key)) return;
      keyboardNotes.current.set(key, midi);
      startNote(midi, 0.6 + Math.random() * 0.15);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const midi = keyboardNotes.current.get(key);
      if (midi === undefined) return;
      keyboardNotes.current.delete(key);
      stopNote(midi);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startNote, stopNote, releaseAll]);

  /* ---------- Record, play, clear, export ---------- */

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const stopPlayback = useCallback(() => {
    clearTimers();
    releaseAll();
    setStatus("idle");
  }, [releaseAll]);

  const toggleRecording = () => {
    if (status === "recording") {
      clearTimers();
      setStatus("idle");
      return;
    }
    if (status === "playing") stopPlayback();
    events.current = [];
    setEventCount(0);
    setNoteCount(0);
    setStatus("recording");
    // A recording never runs forever.
    timers.current.push(
      window.setTimeout(() => {
        setStatus((s) => (s === "recording" ? "idle" : s));
      }, MAX_RECORDING_MS)
    );
  };

  const playBack = () => {
    if (events.current.length === 0) return;
    if (status === "recording") {
      clearTimers();
    }
    releaseAll();
    setStatus("playing");

    const sequence = [...events.current];
    const lastTime = sequence[sequence.length - 1]?.time ?? 0;

    sequence.forEach((event) => {
      timers.current.push(
        window.setTimeout(() => {
          if (event.on) {
            noteOn(midiToNote(event.midi), event.velocity);
            markPressed(event.midi, true);
          } else {
            noteOff(midiToNote(event.midi));
            markPressed(event.midi, false);
          }
        }, event.time)
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        releaseAll();
        setStatus("idle");
      }, lastTime + 400)
    );
  };

  const clearRecording = () => {
    stopPlayback();
    events.current = [];
    setEventCount(0);
    setNoteCount(0);
  };

  // Stop everything when the piano leaves the page.
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    },
    []
  );

  /* ---------- Render ---------- */

  const whiteWidth = 100 / keys.whites.length;
  const rangeLabel = `${midiToNote(keys.first)} – ${midiToNote(keys.first + span)}`;

  return (
    <div className="vp" ref={rootRef}>
      <div className="vp-toolbar">
        <div className="vp-group" role="group" aria-label="Octave">
          <span className="vp-label">OCTAVE</span>
          {BASE_OCTAVES.map((octave) => (
            <button
              key={octave}
              type="button"
              className={baseOctave === octave ? "on" : ""}
              aria-pressed={baseOctave === octave}
              onClick={() => {
                releaseAll();
                setBaseOctave(octave);
              }}
            >
              C{octave}
            </button>
          ))}
        </div>

        <div className="vp-group" role="group" aria-label="Scale">
          <span className="vp-label">SCALE</span>
          {SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={scaleId === s.id ? "on" : ""}
              aria-pressed={scaleId === s.id}
              onClick={() => setScaleId(s.id)}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className={locked ? "on" : ""}
            aria-pressed={locked}
            disabled={scale.pitchClasses === null}
            onClick={() => setLocked((v) => !v)}
            title="Only the notes of the scale can be played"
          >
            Lock
          </button>
        </div>

        <div className="vp-group" role="group" aria-label="Instrument">
          <span className="vp-label">SOUND</span>
          {(Object.keys(INSTRUMENTS) as InstrumentName[]).map((name) => (
            <button
              key={name}
              type="button"
              className={instrument === name ? "on" : ""}
              aria-pressed={instrument === name}
              onClick={() => setInstrument(name)}
            >
              {INSTRUMENTS[name].label}
            </button>
          ))}
        </div>
      </div>

      {!enabled ? (
        <p className="vp-notice" role="status">
          Sound is off.{" "}
          <button type="button" onClick={toggle}>
            Turn the piano on
          </button>
        </p>
      ) : !ready ? (
        <p className="vp-notice" role="status">
          Loading the piano…
        </p>
      ) : null}

      <div
        className="vp-keys"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        role="group"
        aria-label={`Piano keyboard, ${rangeLabel}`}
      >
        {keys.whites.map((midi, i) => (
          <button
            key={midi}
            type="button"
            data-midi={midi}
            className={`vp-white ${pressed.has(midi) ? "down" : ""} ${
              !inScale(midi) && locked ? "muted" : ""
            }`}
            style={{ left: `${i * whiteWidth}%`, width: `${whiteWidth}%` }}
            aria-label={midiToNote(midi)}
            aria-pressed={pressed.has(midi)}
            tabIndex={-1}
          >
            {scale.pitchClasses !== null && inScale(midi) && <i className="vp-dot" />}
            {midi % 12 === 0 && <span className="vp-name">{midiToNote(midi)}</span>}
          </button>
        ))}
        {keys.blacks.map(({ midi, after }) => (
          <button
            key={midi}
            type="button"
            data-midi={midi}
            className={`vp-black ${pressed.has(midi) ? "down" : ""} ${
              !inScale(midi) && locked ? "muted" : ""
            }`}
            style={{
              left: `${(after + 1) * whiteWidth - whiteWidth * 0.3}%`,
              width: `${whiteWidth * 0.6}%`,
            }}
            aria-label={midiToNote(midi)}
            aria-pressed={pressed.has(midi)}
            tabIndex={-1}
          >
            {scale.pitchClasses !== null && inScale(midi) && <i className="vp-dot" />}
          </button>
        ))}
      </div>

      <div className="vp-footer">
        <p className="vp-help">
          Click, drag or tap the keys. On a keyboard: <kbd>A</kbd>–<kbd>&apos;</kbd> for white
          keys, <kbd>W</kbd>–<kbd>P</kbd> for black, <kbd>Z</kbd> / <kbd>X</kbd> for octaves.
        </p>

        <div className="vp-recorder" role="group" aria-label="Recorder">
          <button
            type="button"
            className={status === "recording" ? "rec" : ""}
            onClick={toggleRecording}
            aria-pressed={status === "recording"}
          >
            {status === "recording" ? <Square size={13} /> : <Circle size={13} />}
            {status === "recording" ? "Stop" : "Record"}
          </button>
          <button
            type="button"
            onClick={status === "playing" ? stopPlayback : playBack}
            disabled={eventCount === 0 || status === "recording"}
          >
            {status === "playing" ? <Square size={13} /> : <Play size={13} />}
            {status === "playing" ? "Stop" : "Play"}
          </button>
          <button type="button" onClick={clearRecording} disabled={eventCount === 0}>
            <Trash2 size={13} />
            Clear
          </button>
          <button
            type="button"
            onClick={() => downloadMidi(events.current)}
            disabled={eventCount === 0 || status === "recording"}
          >
            <Download size={13} />
            MIDI
          </button>
          <span className="vp-count" aria-live="polite">
            {status === "recording"
              ? "RECORDING…"
              : eventCount > 0
              ? `${noteCount} NOTES`
              : "NOTHING RECORDED"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default VirtualPiano;
