import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, Ear, Lightbulb, Pause, Play, RotateCcw, Share2, X } from "lucide-react";
import { useApi } from "../../../services/api";
import { isMatch, MAX_ATTEMPTS, pointsFor } from "../../../quiz/answer";
import { createQuizPlayer } from "../../../quiz/engine";
import MiniKeyboard from "../../../quiz/MiniKeyboard";
import { DIFFICULTY_LABEL, keyboardRange, type Difficulty, type QuizSong } from "../../../quiz/types";
import "./GuessSong.css";

const ROUNDS = 5;
const BEST_KEY = "portfolio-guess-best";
const noSongs: QuizSong[] = [];

type Phase = "menu" | "playing" | "summary";
type Outcome = { song: QuizSong; correct: boolean; points: number };

const BLURB: Record<Difficulty, string> = {
  easy: "Familiar tunes, plenty of replays",
  medium: "A fair challenge",
  hard: "Fewer replays, trickier songs",
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

/**
 * Guess the Song. The melodies are the ones saved in the admin: they are played
 * on the site's own piano from their notes, and the visitor types the title.
 */
function GuessSong() {
  const { data: songs, live } = useApi<QuizSong[]>("/quiz/songs", noSongs);
  const player = useMemo(() => createQuizPlayer(), []);
  useEffect(() => () => player.dispose(), [player]);

  const counts = useMemo(() => {
    const c: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const s of songs) c[s.difficulty]++;
    return c;
  }, [songs]);

  const [phase, setPhase] = useState<Phase>("menu");
  const [level, setLevel] = useState<Difficulty>("easy");
  const [queue, setQueue] = useState<QuizSong[]>([]);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [best, setBest] = useState(readBest);
  const [wrongTotal, setWrongTotal] = useState(0);

  // Per song
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<ReadonlySet<number>>(new Set());
  const [showKeys, setShowKeys] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [wrongTries, setWrongTries] = useState(0);
  const [title, setTitle] = useState("");
  const [movie, setMovie] = useState("");
  const [feedback, setFeedback] = useState("");
  const [shake, setShake] = useState(0);
  const [revealed, setRevealed] = useState<null | { correct: boolean; points: number; movieRight: boolean }>(null);
  const [instructions, setInstructions] = useState(false);
  const [shared, setShared] = useState("");
  const activeRef = useRef(new Set<number>());
  const answerRef = useRef<HTMLInputElement>(null);

  const song = queue[index];
  const maxReplays = song?.quiz.maxReplays ?? 0;
  const replaysUsed = Math.max(0, plays - 1);
  const replaysLeft = Math.max(0, maxReplays - replaysUsed);
  const canPlay = !!song && !loading && (plays === 0 || replaysLeft > 0 || playing);

  const resetSong = () => {
    player.stop();
    setPlays(0);
    setPlaying(false);
    setProgress(0);
    setActive(new Set());
    activeRef.current = new Set();
    setShowHint(false);
    setWrongTries(0);
    setTitle("");
    setMovie("");
    setFeedback("");
    setRevealed(null);
  };

  /** Plays the current melody. The first listen is free; later ones use up a replay. */
  const listen = useCallback(
    async (target: QuizSong, isFirst: boolean) => {
      setLoading(true);
      try {
        await player.load();
      } catch {
        setLoading(false);
        setFeedback("The piano couldn't be loaded. Check your connection and try again.");
        return;
      }
      setLoading(false);
      setPlays((p) => p + 1);
      void isFirst;
      setPlaying(true);
      setProgress(0);
      await player.play(target, {
        onProgress: setProgress,
        onNoteOn: (midi) => {
          activeRef.current = new Set(activeRef.current).add(midi);
          setActive(activeRef.current);
        },
        onNoteOff: (midi) => {
          const next = new Set(activeRef.current);
          next.delete(midi);
          activeRef.current = next;
          setActive(next);
        },
        onEnd: () => {
          setPlaying(false);
          activeRef.current = new Set();
          setActive(new Set());
        },
      });
    },
    [player]
  );

  const begin = (chosen: Difficulty) => {
    const pool = shuffle(songs.filter((s) => s.difficulty === chosen)).slice(0, ROUNDS);
    if (pool.length === 0) return;
    setLevel(chosen);
    setQueue(pool);
    setIndex(0);
    setOutcomes([]);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setWrongTotal(0);
    resetSong();
    setPhase("playing");
    // Starting is the visitor's own click, so the first melody can begin straight away.
    void listen(pool[0]!, true);
  };

  const finishSong = (correct: boolean, points: number, movieRight: boolean) => {
    if (!song) return;
    player.stop();
    setRevealed({ correct, points, movieRight });
    setOutcomes((o) => [...o, { song, correct, points }]);
    if (correct) {
      setScore((s) => s + points);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!song || revealed || !title.trim()) return;
    if (isMatch(title, song.title)) {
      const movieRight = !!movie.trim() && !!song.movie && isMatch(movie, song.movie);
      finishSong(true, pointsFor({ difficulty: song.difficulty, wrongTries, replaysUsed, streakBefore: streak, movieRight }), movieRight);
      return;
    }
    const used = wrongTries + 1;
    setWrongTries(used);
    setWrongTotal((w) => w + 1);
    setShake((s) => s + 1);
    if (used >= MAX_ATTEMPTS) {
      setFeedback("Out of tries this time. Here's the answer.");
      finishSong(false, 0, false);
    } else {
      setFeedback(
        `Not quite. ${MAX_ATTEMPTS - used} ${MAX_ATTEMPTS - used === 1 ? "try" : "tries"} left.${replaysLeft > 0 ? " Listen again?" : " No replays left, so trust your ear."}`
      );
      answerRef.current?.select();
    }
  };

  const giveUp = () => {
    if (!song || revealed) return;
    setFeedback("");
    finishSong(false, 0, false);
  };

  const next = () => {
    if (index + 1 >= queue.length) {
      const total = score;
      if (total > best) {
        setBest(total);
        try {
          localStorage.setItem(BEST_KEY, String(total));
        } catch {
          /* storage unavailable: the record just isn't kept */
        }
      }
      player.stop();
      setPhase("summary");
      return;
    }
    const upcoming = queue[index + 1]!;
    setIndex(index + 1);
    resetSong();
    void listen(upcoming, true);
  };

  const share = async () => {
    const correct = outcomes.filter((o) => o.correct).length;
    const text = `I scored ${score} on Guess the Song (${DIFFICULTY_LABEL[level]}): ${correct}/${outcomes.length} right, best streak ${bestStreak}.`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        setShared("Copied. Paste it anywhere.");
      }
    } catch {
      setShared("Couldn't share from here.");
    }
  };

  const leave = () => {
    player.stop();
    setPhase("menu");
  };

  /* ---------- Screens ---------- */

  if (phase === "menu") {
    const total = songs.length;
    return (
      <div className="gs">
        <div className="gs-intro">
          <span className="gs-eyebrow"><Ear size={14} /> A LISTENING GAME</span>
          <h3>Guess the Song</h3>
          <p>
            I&apos;ll play the first notes of a song on the piano. Name it before you run out of tries. No peeking at the title: the answer only
            shows once you&apos;ve guessed or given up.
          </p>
        </div>

        {total === 0 ? (
          <p className="gs-empty">{live ? "No songs are ready yet. Check back soon." : "The songs load from the server, which isn't reachable right now."}</p>
        ) : (
          <>
            <div className="gs-levels" role="group" aria-label="Difficulty">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button key={d} type="button" className={level === d ? "on" : ""} aria-pressed={level === d} disabled={counts[d] === 0} onClick={() => setLevel(d)}>
                  <strong>{DIFFICULTY_LABEL[d]}</strong>
                  <span>{counts[d] === 0 ? "No songs yet" : BLURB[d]}</span>
                  <em>{counts[d]} song{counts[d] === 1 ? "" : "s"}</em>
                </button>
              ))}
            </div>

            <div className="gs-start">
              <button type="button" className="gs-primary" disabled={counts[level] === 0} onClick={() => begin(level)}>
                <Play size={16} /> Start game
              </button>
              <button type="button" className="gs-link" onClick={() => setInstructions((v) => !v)} aria-expanded={instructions}>
                {instructions ? "Hide" : "How it works"}
              </button>
              {best > 0 && <span className="gs-best">Your best: {best}</span>}
            </div>

            {instructions && (
              <ul className="gs-how">
                <li>Each game is {Math.min(ROUNDS, counts[level])} songs. Listening starts when a song begins.</li>
                <li>You can replay a limited number of times, so listen closely. Each replay is worth a little less.</li>
                <li>Type the song title. The movie is optional, and gets a bonus if you know it.</li>
                <li>{MAX_ATTEMPTS} tries per song. A streak of right answers earns extra points. Giving up scores nothing.</li>
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  if (phase === "summary") {
    const correct = outcomes.filter((o) => o.correct).length;
    return (
      <div className="gs">
        <div className="gs-summary">
          <span className="gs-eyebrow">ALL DONE · {DIFFICULTY_LABEL[level].toUpperCase()}</span>
          <h3>{score} <small>points</small></h3>
          <div className="gs-stats">
            <div><b>{correct}/{outcomes.length}</b><span>correct</span></div>
            <div><b>{bestStreak}</b><span>best streak</span></div>
            <div><b>{wrongTotal}</b><span>wrong tries</span></div>
            <div><b>{Math.max(best, score)}</b><span>your best</span></div>
          </div>
          <ol className="gs-list">
            {outcomes.map((o, i) => (
              <li key={i} className={o.correct ? "right" : "missed"}>
                {o.correct ? <Check size={15} /> : <X size={15} />}
                <span><b>{o.song.title}</b>{o.song.movie ? ` · ${o.song.movie}` : ""}</span>
                <em>{o.correct ? `+${o.points}` : "missed"}</em>
              </li>
            ))}
          </ol>
          <div className="gs-start">
            <button type="button" className="gs-primary" onClick={() => begin(level)}><RotateCcw size={15} /> Play again</button>
            <button type="button" onClick={share}><Share2 size={15} /> Share results</button>
            <button type="button" className="gs-link" onClick={leave}>Change difficulty</button>
          </div>
          {shared && <p className="gs-note" role="status">{shared}</p>}
        </div>
      </div>
    );
  }

  if (!song) return null;
  const range = keyboardRange(song);
  const last = index + 1 >= queue.length;

  return (
    <div className="gs">
      <div className="gs-hud" aria-live="polite">
        <span>Song {index + 1} of {queue.length}</span>
        <span>Score <b>{score}</b></span>
        <span>Streak <b>{streak}</b></span>
        <button type="button" className="gs-link" onClick={leave}>Quit</button>
      </div>

      <div className="gs-stage">
        <div className="gs-player">
          <button
            type="button"
            className="gs-play"
            disabled={!canPlay && !playing}
            aria-label={playing ? "Stop" : plays === 0 ? "Play the melody" : "Replay the melody"}
            onClick={() => (playing ? player.stop() : void listen(song, false))}
          >
            {loading ? <span className="gs-spin" aria-hidden="true" /> : playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <div className="gs-meter">
            <div className="gs-bar" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></div>
            <span>
              {loading ? "Loading the piano…" : playing ? "Listening…" : plays === 0 ? "Press play" : replaysLeft > 0 ? "Press to replay" : "No replays left"}
              {" · "}
              Replays: {Math.min(replaysUsed, maxReplays)} of {maxReplays} used
            </span>
          </div>
          <label className="gs-keys-toggle">
            <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} /> Show keys
          </label>
        </div>
        {showKeys && <MiniKeyboard low={range.low} high={range.high} active={active} />}
        {song.quiz.showTitleBeforeAnswer && <p className="gs-title-shown">The song: <b>{song.title}</b></p>}
      </div>

      {!revealed ? (
        <form key={shake} className={`gs-form ${shake ? "shake" : ""}`} onSubmit={submit}>
          <label>
            <span>Song title</span>
            <input ref={answerRef} type="text" value={title} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type your guess" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span>Movie <em>(optional, for a bonus)</em></span>
            <input type="text" value={movie} autoComplete="off" spellCheck={false} placeholder="Which film?" onChange={(e) => setMovie(e.target.value)} />
          </label>
          <div className="gs-actions">
            <button type="submit" className="gs-primary" disabled={!title.trim()}>Submit answer</button>
            {song.quiz.hint && (
              <button type="button" onClick={() => setShowHint(true)} disabled={showHint}><Lightbulb size={15} /> Hint</button>
            )}
            <button type="button" className="gs-link" onClick={giveUp}>Give up · reveal the answer</button>
          </div>
          {showHint && song.quiz.hint && <p className="gs-hint">Hint: {song.quiz.hint}</p>}
          {feedback && <p className="gs-feedback" role="status">{feedback}</p>}
          <p className="gs-tries">Tries left: {MAX_ATTEMPTS - wrongTries}</p>
        </form>
      ) : (
        <div className={`gs-reveal ${revealed.correct ? "right" : "missed"}`} role="status">
          <div className="gs-reveal-mark">{revealed.correct ? <Check size={26} /> : <X size={26} />}</div>
          <div>
            <strong>{revealed.correct ? "Yes! That's it." : feedback || "Here's the answer."}</strong>
            <h4>{song.title}</h4>
            <p>
              {song.movie ? `${song.movie} · ` : ""}{DIFFICULTY_LABEL[song.difficulty]}
              {revealed.correct && ` · +${revealed.points} points${revealed.movieRight ? " (movie bonus!)" : ""}`}
            </p>
          </div>
          <button type="button" className="gs-primary" onClick={next}>{last ? "See my results" : "Next song"}</button>
        </div>
      )}
    </div>
  );
}

export default GuessSong;
