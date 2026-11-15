import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ear, Play, RotateCcw, Square } from "lucide-react";
import { onPianoNote, setKeyboardForced } from "../../../audio/pianoBus";
import { useSound } from "../../../audio/SoundContext";
import { noteToMidi } from "../../../audio/musicTheory";
import { useApi } from "../../../services/api";
import Notation from "./Notation";
import {
  BUILT_IN_MELODIES,
  parseNotes,
  pitchClassOf,
  soundingNotes,
  transpose,
  type Melody,
  type PhraseNote,
} from "./melodies";
import "./GuessSong.css";

type Level = 1 | 2 | 3;
type Phase = "menu" | "asking" | "revealed" | "summary";

type LevelSpec = {
  label: string;
  blurb: string;
  /** How many notes of the tune are played as the clue. */
  clueNotes: number;
  options: number;
  base: number;
  showNotes: boolean;
  maxPlays: number;
  transposed: boolean;
  /** Seconds per beat. */
  tempo: number;
};

const LEVELS: Record<Level, LevelSpec> = {
  1: { label: "Easy", blurb: "Notes on the staff · 3 choices", clueNotes: 8, options: 3, base: 100, showNotes: true, maxPlays: 4, transposed: false, tempo: 0.46 },
  2: { label: "Medium", blurb: "Listen only · 4 choices", clueNotes: 6, options: 4, base: 200, showNotes: false, maxPlays: 3, transposed: true, tempo: 0.4 },
  3: { label: "Hard", blurb: "A short clue, in another key · 5 choices", clueNotes: 4, options: 5, base: 300, showNotes: false, maxPlays: 2, transposed: true, tempo: 0.34 },
};

const ROUND_LENGTH = 6;
const BONUS_STREAK = 3;
const BEST_KEY = "portfolio-guess-best";

type Question = {
  melody: Melody;
  options: Melody[];
  /** Semitones the clue is moved by, so the tune isn't recognised from its key. */
  shift: number;
  bonus: boolean;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function buildQuestion(pool: Melody[], level: Level, used: Set<string>, bonus: boolean): Question {
  const eligible = pool.filter((m) => m.difficulty <= level);
  let fresh = eligible.filter((m) => !used.has(m.id));
  if (fresh.length === 0) {
    used.clear();
    fresh = eligible;
  }
  const melody = shuffle(fresh)[0]!;
  used.add(melody.id);

  const optionCount = Math.min(LEVELS[level].options, pool.length);
  const distractors = shuffle(pool.filter((m) => m.id !== melody.id)).slice(0, optionCount - 1);

  let shift = 0;
  if (LEVELS[level].transposed) {
    const choices = shuffle([-3, -2, -1, 1, 2, 3, 4]);
    shift =
      choices.find((s) =>
        soundingNotes(melody.notes).every((n) => {
          const midi = noteToMidi(n.note);
          return midi !== null && midi + s >= 48 && midi + s <= 92;
        })
      ) ?? 0;
  }
  return { melody, options: shuffle([melody, ...distractors]), shift, bonus };
}

/** The notes played as the clue: a few from the start, backwards for the bonus round. */
function cluePhrase(question: Question, level: Level): PhraseNote[] {
  const count = question.bonus ? 6 : LEVELS[level].clueNotes;
  let phrase = soundingNotes(question.melody.notes).slice(0, count);
  if (question.bonus) phrase = [...phrase].reverse();
  return transpose(phrase, question.shift);
}

type ApiMelody = { id: number; title: string; composer: string; difficulty: number; notes: string };
const noApiMelodies: ApiMelody[] = [];

function GuessSong() {
  const { enabled, ready, toggle, noteOn, noteOff } = useSound();
  const { data: apiMelodies } = useApi<ApiMelody[]>("/melodies", noApiMelodies);

  const pool = useMemo<Melody[]>(() => {
    const extra = apiMelodies
      .map((m): Melody => ({
        id: `api-${m.id}`,
        title: m.title,
        composer: m.composer,
        difficulty: (m.difficulty >= 3 ? 3 : m.difficulty <= 1 ? 1 : 2) as 1 | 2 | 3,
        notes: parseNotes(m.notes),
      }))
      .filter((m) => soundingNotes(m.notes).length >= 4);
    return [...BUILT_IN_MELODIES, ...extra];
  }, [apiMelodies]);

  const [phase, setPhase] = useState<Phase>("menu");
  const [level, setLevel] = useState<Level>(1);
  const [question, setQuestion] = useState<Question | null>(null);
  const [asked, setAsked] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(readBest);
  const [plays, setPlays] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [earned, setEarned] = useState(0);
  const [bonusReady, setBonusReady] = useState(false);
  const [bonusDone, setBonusDone] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState<number | null>(null);

  const [trying, setTrying] = useState(false);
  const [tryProgress, setTryProgress] = useState(0);
  const [triedOk, setTriedOk] = useState(false);

  const used = useRef(new Set<string>());
  const timers = useRef<number[]>([]);
  const sounding = useRef(new Set<string>());
  const tryRef = useRef(0);
  /** True while the game itself is playing notes, so they are not mistaken for the visitor's. */
  const busy = useRef(false);

  const spec = LEVELS[level];
  const canHear = enabled && ready;

  /* ---------- Playing phrases ---------- */

  const stopPlayback = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    sounding.current.forEach((note) => noteOff(note));
    sounding.current.clear();
    busy.current = false;
    setPlaying(false);
    setPlayIndex(null);
  }, [noteOff]);

  const playPhrase = useCallback(
    (phrase: PhraseNote[], secondsPerBeat: number) => {
      stopPlayback();
      busy.current = true;
      setPlaying(true);
      let t = 0;
      let soundingIndex = 0;
      phrase.forEach((item) => {
        const length = item.beats * secondsPerBeat;
        if (item.note !== "R") {
          const index = soundingIndex++;
          timers.current.push(
            window.setTimeout(() => {
              if (noteOn(item.note, 0.62)) sounding.current.add(item.note);
              setPlayIndex(index);
            }, t * 1000),
            window.setTimeout(() => {
              noteOff(item.note);
              sounding.current.delete(item.note);
            }, (t + length * 0.92) * 1000)
          );
        }
        t += length;
      });
      timers.current.push(
        window.setTimeout(() => {
          busy.current = false;
          setPlaying(false);
          setPlayIndex(null);
        }, t * 1000 + 250)
      );
    },
    [noteOn, noteOff, stopPlayback]
  );

  // Silence everything if the game leaves the page.
  useEffect(() => stopPlayback, [stopPlayback]);

  /* ---------- Trying the tune on the piano ---------- */

  const target = useMemo(
    () => (question ? soundingNotes(question.melody.notes).slice(0, spec.clueNotes) : []),
    [question, spec.clueNotes]
  );

  useEffect(() => {
    if (!trying || target.length === 0) return;
    const expected = target.map((n) => pitchClassOf(n.note));

    // Let the computer keyboard play the piano from here, wherever the page is scrolled.
    setKeyboardForced(true);
    const stopListening = onPianoNote((midi) => {
      // The game's own playback also lands here; only the visitor's notes count.
      if (busy.current) return;
      const pc = ((midi % 12) + 12) % 12;
      let progress = tryRef.current;
      if (pc === expected[progress]) progress += 1;
      else progress = pc === expected[0] ? 1 : 0;
      tryRef.current = progress;
      setTryProgress(progress);

      if (progress >= expected.length) {
        setTrying(false);
        setTriedOk(true);
        setScore((s) => s + 50);
        setEarned((e) => e + 50);
      }
    });

    return () => {
      setKeyboardForced(false);
      stopListening();
    };
  }, [trying, target]);

  /* ---------- Game flow ---------- */

  const startRound = (chosen: Level) => {
    stopPlayback();
    used.current.clear();
    setLevel(chosen);
    setScore(0);
    setStreak(0);
    setAsked(0);
    setCorrectCount(0);
    setBonusReady(false);
    setBonusDone(false);
    setQuestion(buildQuestion(pool, chosen, used.current, false));
    setPlays(0);
    setPicked(null);
    setEarned(0);
    setTrying(false);
    setTriedOk(false);
    setTryProgress(0);
    tryRef.current = 0;
    setPhase("asking");
  };

  const nextQuestion = (bonus = false) => {
    stopPlayback();
    setTrying(false);
    setTriedOk(false);
    setTryProgress(0);
    tryRef.current = 0;
    if (!bonus && asked >= ROUND_LENGTH) {
      setBest((previous) => {
        const next = Math.max(previous, score);
        try {
          localStorage.setItem(BEST_KEY, String(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
      setPhase("summary");
      return;
    }
    setQuestion(buildQuestion(pool, level, used.current, bonus));
    setPlays(0);
    setPicked(null);
    setEarned(0);
    setBonusReady(false);
    setPhase("asking");
  };

  const playClue = () => {
    if (!question || !canHear) return;
    if (playing) {
      stopPlayback();
      return;
    }
    if (plays >= spec.maxPlays) return;
    setPlays((p) => p + 1);
    playPhrase(cluePhrase(question, level), spec.tempo);
  };

  const answer = (option: Melody) => {
    if (!question || phase !== "asking") return;
    stopPlayback();
    const right = option.id === question.melody.id;
    setPicked(option.id);

    let points = 0;
    if (right) {
      const base = question.bonus ? spec.base * 2 : spec.base;
      const replayCost = Math.max(0, plays - 1) * 20;
      points = Math.max(Math.round(base * 0.4), base - replayCost) + Math.min(100, streak * 10);
      setStreak((s) => s + 1);
      // The bonus round is on top of the six, so it does not count toward "x of 6".
      if (!question.bonus) setCorrectCount((c) => c + 1);
      if (!question.bonus && streak + 1 >= BONUS_STREAK && !bonusDone) setBonusReady(true);
    } else {
      setStreak(0);
    }
    if (question.bonus) setBonusDone(true);
    else setAsked((a) => a + 1);

    setEarned(points);
    setScore((s) => s + points);
    setPhase("revealed");
  };

  const playWholeTune = () => {
    if (!question || !canHear) return;
    if (playing) {
      stopPlayback();
      return;
    }
    playPhrase(question.melody.notes, spec.tempo);
  };

  const toggleTrying = () => {
    if (!canHear) return;
    stopPlayback();
    tryRef.current = 0;
    setTryProgress(0);
    setTriedOk(false);
    setTrying((t) => !t);
  };

  /* ---------- What to draw ---------- */

  const clue = question ? cluePhrase(question, level) : [];
  const shownNotes: PhraseNote[] =
    !question || phase === "menu" || phase === "summary"
      ? []
      : phase === "revealed"
      ? soundingNotes(question.melody.notes)
      : spec.showNotes && !question.bonus
      ? clue
      : [];

  const correctTitle = question?.melody.title;
  const pickedRight = question !== null && picked === question.melody.id;

  /* ---------- Render ---------- */

  return (
    <div className="gs">
      <div className="gs-hud" aria-live="polite">
        <span>
          <b>{score}</b> POINTS
        </span>
        <span>
          STREAK <b>{streak}</b>
        </span>
        {phase !== "menu" && phase !== "summary" && (
          <span>
            {question?.bonus ? "BONUS ROUND" : `${Math.min(asked + (phase === "asking" ? 1 : 0), ROUND_LENGTH)} / ${ROUND_LENGTH}`}
            {" · "}
            {spec.label.toUpperCase()}
          </span>
        )}
        <span className="gs-best">BEST {best}</span>
      </div>

      {!enabled ? (
        <p className="gs-notice" role="status">
          This game is played by ear. <button type="button" onClick={toggle}>Turn the piano on</button>
        </p>
      ) : !ready ? (
        <p className="gs-notice" role="status">Loading the piano…</p>
      ) : null}

      {phase === "menu" && (
        <div className="gs-menu">
          <h3>Name that tune.</h3>
          <p>
            A few notes play on the piano. Pick the song they belong to. Six rounds, and a faster
            streak earns more. Every tune here is traditional or in the public domain.
          </p>
          <div className="gs-levels" role="group" aria-label="Choose a difficulty">
            {([1, 2, 3] as Level[]).map((l) => (
              <button key={l} type="button" onClick={() => startRound(l)} disabled={!canHear}>
                <strong>{LEVELS[l].label}</strong>
                <span>{LEVELS[l].blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(phase === "asking" || phase === "revealed") && question && (
        <div className="gs-round">
          <div className="gs-stage">
            <Notation
              notes={shownNotes}
              activeIndex={playIndex}
              label={shownNotes.length ? "The melody in musical notation" : "An empty staff: listen to the clue"}
            />
            {shownNotes.length === 0 && (
              <p className="gs-empty">
                {question.bonus ? "Played backwards. Good luck." : "No notes this time. Listen closely."}
              </p>
            )}
            <div className={`gs-wave ${playing ? "on" : ""}`} aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => (
                <i key={i} style={{ animationDelay: `${(i % 7) * 70}ms`, height: `${20 + ((i * 37) % 60)}%` }} />
              ))}
            </div>
          </div>

          <div className="gs-controls">
            <button type="button" className="gs-play" onClick={phase === "asking" ? playClue : playWholeTune} disabled={!canHear || (phase === "asking" && !playing && plays >= spec.maxPlays)}>
              {playing ? <Square size={14} /> : <Play size={14} />}
              {playing ? "Stop" : phase === "asking" ? (plays === 0 ? "Play the clue" : "Hear it again") : "Play the whole tune"}
            </button>
            {phase === "asking" && (
              <span className="gs-plays">
                {plays} / {spec.maxPlays} PLAYS{plays > 1 ? " · −20 EACH EXTRA" : ""}
              </span>
            )}
          </div>

          <div className="gs-options" role="group" aria-label="Which song is it?">
            {question.options.map((option) => {
              const isCorrect = option.id === question.melody.id;
              const isPicked = option.id === picked;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${phase === "revealed" && isCorrect ? "right" : ""} ${
                    phase === "revealed" && isPicked && !isCorrect ? "wrong" : ""
                  }`}
                  onClick={() => answer(option)}
                  disabled={phase === "revealed" || plays === 0}
                >
                  {option.title}
                </button>
              );
            })}
          </div>
          {phase === "asking" && plays === 0 && (
            <p className="gs-hint">Play the clue first, then choose.</p>
          )}

          {phase === "revealed" && (
            <div className="gs-result" role="status">
              <p className={pickedRight ? "good" : "bad"}>
                {pickedRight ? `Yes. +${earned - (triedOk ? 50 : 0)} points.` : "Not quite."}{" "}
                It was <strong>{correctTitle}</strong> — {question.melody.composer}.
              </p>

              <div className="gs-try">
                <button type="button" onClick={toggleTrying} disabled={!canHear}>
                  <Ear size={14} />
                  {trying ? "Stop trying" : triedOk ? "Played it! +50" : "Now play it yourself (+50)"}
                </button>
                {trying && (
                  <span className="gs-try-steps" aria-live="polite">
                    {target.map((_, i) => (
                      <i key={i} className={i < tryProgress ? "on" : ""} />
                    ))}
                    <em>Play the first {target.length} notes in any octave: use the keys A S D F G H J K on your keyboard, or scroll up to the piano.</em>
                  </span>
                )}
              </div>

              <div className="gs-next">
                {bonusReady && (
                  <button type="button" className="gs-bonus" onClick={() => nextQuestion(true)}>
                    <RotateCcw size={14} /> Something is playing backwards…
                  </button>
                )}
                <button type="button" onClick={() => nextQuestion(false)}>
                  {asked >= ROUND_LENGTH && !question.bonus ? "See my score" : "Next tune"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "summary" && (
        <div className="gs-menu">
          <h3>
            {correctCount} of {ROUND_LENGTH}.
          </h3>
          <p>
            You scored <strong>{score}</strong> on {spec.label}.{" "}
            {score >= best && score > 0 ? "That's your best yet." : `Your best is ${best}.`}
          </p>
          <div className="gs-levels" role="group" aria-label="Play again">
            {([1, 2, 3] as Level[]).map((l) => (
              <button key={l} type="button" onClick={() => startRound(l)} disabled={!canHear}>
                <strong>{LEVELS[l].label}</strong>
                <span>{l === level ? "Again" : LEVELS[l].blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="gs-credit">
        Tunes are traditional or public domain, played on the Salamander Grand Piano (CC BY 3.0, Alexander Holm).
      </p>
    </div>
  );
}

export default GuessSong;
