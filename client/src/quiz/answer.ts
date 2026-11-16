import type { Difficulty } from "./types";

/** Lower case, accents and punctuation removed, spaces gone: "Kannazhaga!" and " kannazhaga " are the same. */
export const normalise = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]/gu, "");

/** How many single-letter edits separate two strings. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const held = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = held;
    }
  }
  return row[b.length]!;
}

/** The ways a title may be answered: in full, or without a subtitle or bracketed part. */
export function titleVariants(title: string): string[] {
  const variants = new Set<string>([title]);
  variants.add(title.split(/\s[-–—:]\s/)[0] ?? title);
  variants.add(title.replace(/\s*[([].*?[)\]]\s*/g, " "));
  return [...variants].map(normalise).filter(Boolean);
}

/**
 * Does the guess match? Case, spacing and punctuation do not matter, a subtitle
 * may be left off, and one slip of the keyboard is forgiven on longer names.
 */
export function isMatch(guess: string, truth: string): boolean {
  const g = normalise(guess);
  if (!g) return false;
  return titleVariants(truth).some((t) => {
    if (g === t) return true;
    const allowed = t.length >= 10 ? 2 : t.length >= 5 ? 1 : 0;
    return allowed > 0 && distance(g, t) <= allowed;
  });
}

export const BASE_POINTS: Record<Difficulty, number> = { easy: 100, medium: 150, hard: 200 };
export const MAX_ATTEMPTS = 3;

/**
 * Points for a correct answer. Wrong tries and replays each cost a little, there
 * is always something for getting it right, and a run of correct answers adds a
 * bonus. Giving up scores nothing, so asking again and again cannot be farmed.
 */
export function pointsFor(opts: { difficulty: Difficulty; wrongTries: number; replaysUsed: number; streakBefore: number; movieRight: boolean }): number {
  const base = BASE_POINTS[opts.difficulty];
  const kept = Math.max(0.3, 1 - opts.wrongTries * 0.25 - opts.replaysUsed * 0.08);
  const streakBonus = Math.min(0.5, opts.streakBefore * 0.1);
  return Math.round(base * kept * (1 + streakBonus)) + (opts.movieRight ? 25 : 0);
}
