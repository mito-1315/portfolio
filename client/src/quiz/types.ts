import { noteToMidi } from "../audio/musicTheory";

/**
 * Guess the Song melodies, in the same JSON format the admin imports and
 * exports. Timing is counted in beats of the time signature, where one beat
 * is one note of the denominator (a quarter in 4/4, an eighth in 6/8), and
 * `tempo` is quarter notes per minute.
 */

export type Difficulty = "easy" | "medium" | "hard";

export type QuizNote = {
  id: number;
  /** "C4", "F#5", "Bb3", or "REST". */
  pitch: string;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type QuizSong = {
  id: string;
  title: string;
  movie: string;
  difficulty: Difficulty;
  music: {
    tempo: number;
    timeSignature: { numerator: number; denominator: number };
    key?: string;
    octaveRange: { min: number; max: number };
    startOffsetBeats: number;
    loop: boolean;
  };
  playback: { instrument: string; volume: number; noteGap: number };
  notes: QuizNote[];
  quiz: { hint: string; maxReplays: number; showTitleBeforeAnswer: boolean; enabled: boolean };
};

/** How long one beat lasts, in seconds. */
export const secondsPerBeat = (music: QuizSong["music"]): number =>
  (60 / music.tempo) * (4 / music.timeSignature.denominator);

/** Where the last note ends, in beats from the first. */
export const songBeats = (song: QuizSong): number =>
  song.notes.reduce((end, n) => Math.max(end, n.startBeat + n.durationBeats), 0);

/** The length of the melody in seconds, including any lead-in silence. */
export const songSeconds = (song: QuizSong): number =>
  (song.music.startOffsetBeats + songBeats(song)) * secondsPerBeat(song.music);

/** The piano keys to draw for a song: whole octaves, C to B, covering every note. */
export function keyboardRange(song: QuizSong): { low: number; high: number } {
  const midis = song.notes.filter((n) => n.pitch !== "REST").map((n) => noteToMidi(n.pitch)).filter((m): m is number => m !== null);
  if (midis.length === 0) return { low: 60, high: 71 };
  let low = Math.floor(Math.min(...midis) / 12) * 12;
  let high = Math.floor(Math.max(...midis) / 12) * 12 + 11;
  // Keep it readable on a phone: at most four octaves, and at least two.
  if (high - low < 23) high = low + 23;
  if (high - low > 47) high = low + 47;
  if (high > 119) {
    high = 119;
    low = Math.max(0, high - 23);
  }
  return { low, high };
}

/** Counts per difficulty, for the admin and the menu. */
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
