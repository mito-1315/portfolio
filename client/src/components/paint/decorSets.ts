import type { DecorItem } from "./Decor";

/**
 * Where the paint splats go in each part of the page. Positions are
 * percentages of the section, so they scale with its height; negative or
 * large left values let a splat bleed off the edge.
 */

export const ABOUT_DECOR: DecorItem[] = [
  { top: 14, left: -7, size: 320, seed: 3, opacity: 0.13, drift: 70 },
  { top: 66, left: 86, size: 280, seed: 9, tone: "ink", opacity: 0.06, drift: 90 },
];

export const SKILLS_DECOR: DecorItem[] = [
  { top: 6, left: -9, size: 360, seed: 11, opacity: 0.12 },
  { top: 52, left: 88, size: 300, seed: 14, tone: "ink", opacity: 0.07, drift: 110 },
  { top: 84, left: 4, size: 250, seed: 16, opacity: 0.1 },
];

export const EXPERIENCE_DECOR: DecorItem[] = [
  { top: 10, left: -6, size: 380, seed: 21, opacity: 0.12 },
  { top: 28, left: 90, size: 320, seed: 23, tone: "ink", opacity: 0.06 },
  { top: 50, left: -5, size: 340, seed: 27, opacity: 0.1 },
  { top: 70, left: 91, size: 360, seed: 31, opacity: 0.12 },
  { top: 90, left: 3, size: 280, seed: 33, tone: "ink", opacity: 0.06 },
];

export const MUSIC_DECOR: DecorItem[] = [
  { top: 5, left: 92, size: 340, seed: 41, opacity: 0.12 },
  { top: 34, left: -8, size: 320, seed: 43, opacity: 0.1 },
  { top: 68, left: 90, size: 360, seed: 47, opacity: 0.1 },
  { top: 92, left: 1, size: 280, seed: 49, opacity: 0.12 },
];

export const CONTACT_DECOR: DecorItem[] = [
  { top: 8, left: -6, size: 320, seed: 51, opacity: 0.12 },
  { top: 42, left: 90, size: 340, seed: 53, tone: "ink", opacity: 0.07 },
  { top: 82, left: 2, size: 300, seed: 57, opacity: 0.1 },
];
