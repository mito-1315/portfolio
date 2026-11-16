import type { MoodName } from "../audio/musicTheory";

const KEY = "portfolio-music";

export type MusicPrefs = {
  mood?: MoodName;
  trackId?: number | undefined;
  volume?: number;
  muted?: boolean;
  /** True once the visitor has paused on purpose: do not start on their next visit. */
  paused?: boolean;
  /** Where the track was, so a refresh carries on from about the same place. */
  position?: number;
};

const MOODS: MoodName[] = ["Calm", "Focused", "Energetic", "Nostalgic", "Curious"];

export function loadPrefs(): MusicPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(MOODS.includes(data.mood as MoodName) ? { mood: data.mood as MoodName } : {}),
      ...(typeof data.trackId === "number" ? { trackId: data.trackId } : {}),
      ...(typeof data.volume === "number" ? { volume: Math.min(1, Math.max(0, data.volume)) } : {}),
      ...(typeof data.muted === "boolean" ? { muted: data.muted } : {}),
      ...(typeof data.paused === "boolean" ? { paused: data.paused } : {}),
      ...(typeof data.position === "number" ? { position: Math.max(0, data.position) } : {}),
    };
  } catch {
    return {};
  }
}

export function savePrefs(patch: MusicPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    // Storage unavailable: the choices just won't last past this visit.
  }
}
