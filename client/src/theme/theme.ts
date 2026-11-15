/**
 * Colour themes. The values live in styles/variables.css; this file only
 * names them, remembers the visitor's choice, and applies it.
 */

export type ThemeId = "paper" | "white" | "black" | "midnight" | "sunset";

export type ThemeInfo = {
  id: ThemeId;
  label: string;
  /** Two colours for the swatch: ground and accent. */
  swatch: [string, string];
};

export const THEMES: ThemeInfo[] = [
  { id: "paper", label: "Paper", swatch: ["#faf9f6", "#d97836"] },
  { id: "white", label: "White", swatch: ["#ffffff", "#000000"] },
  { id: "black", label: "Black", swatch: ["#000000", "#ffffff"] },
  { id: "midnight", label: "Midnight", swatch: ["#0b1020", "#5ec8ff"] },
  { id: "sunset", label: "Sunset", swatch: ["#fff4eb", "#d6336c"] },
];

const STORAGE_KEY = "portfolio-theme";

const isTheme = (value: string | null | undefined): value is ThemeId =>
  THEMES.some((theme) => theme.id === value);

export function currentTheme(): ThemeId {
  const set = document.documentElement.dataset.theme;
  return isTheme(set) ? set : "paper";
}

/** Switches theme, remembers it, and tells canvases and 3D scenes to re-read their colours. */
export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: id }));
}

/** An "r g b" token from a computed style, as three numbers 0-255. */
export function readRgbToken(
  element: Element,
  token: string,
  fallback: [number, number, number]
): [number, number, number] {
  const raw = getComputedStyle(element).getPropertyValue(token).trim();
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every(Number.isFinite)
    ? [parts[0] as number, parts[1] as number, parts[2] as number]
    : fallback;
}
