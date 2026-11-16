/**
 * The site's tonal identity. The mood chosen on the entry screen sets a
 * pentatonic scale, and every interface note is snapped to it so the whole
 * site sounds like one piece of music.
 */

export type MoodName = "Calm" | "Focused" | "Energetic" | "Nostalgic" | "Curious";

/** Pitch classes (0 = C) of each mood's five-note scale. */
const moodScales: Record<MoodName, { name: string; pitchClasses: number[] }> = {
  Calm: { name: "A minor pentatonic", pitchClasses: [9, 0, 2, 4, 7] },
  Focused: { name: "C major pentatonic", pitchClasses: [0, 2, 4, 7, 9] },
  Energetic: { name: "G major pentatonic", pitchClasses: [7, 9, 11, 2, 4] },
  Nostalgic: { name: "D minor pentatonic", pitchClasses: [2, 5, 7, 9, 0] },
  Curious: { name: "E minor pentatonic", pitchClasses: [4, 7, 9, 11, 2] },
};

export const defaultMood: MoodName = "Calm";

export function scaleFor(mood: MoodName) {
  return moodScales[mood];
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** "C#4" -> MIDI number, or null if the text isn't a note. */
export function noteToMidi(note: string): number | null {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!match) return null;
  const letter = match[1] as string;
  const accidental = match[2];
  const octave = Number(match[3]);
  let pitch = NAMES.indexOf(letter);
  if (accidental === "#") pitch += 1;
  if (accidental === "b") pitch -= 1;
  return (octave + 1) * 12 + pitch;
}

export function midiToNote(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Moves a note to the nearest pitch in the scale (stays in its octave range). */
export function snapToScale(note: string, pitchClasses: number[]): string {
  const midi = noteToMidi(note);
  if (midi === null) return note;

  let best = midi;
  let bestDistance = Infinity;
  for (let candidate = midi - 6; candidate <= midi + 6; candidate++) {
    if (!pitchClasses.includes(((candidate % 12) + 12) % 12)) continue;
    const distance = Math.abs(candidate - midi);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return midiToNote(best);
}

/** A mood's home note: played when the visitor picks that mood. */
const tonics: Record<MoodName, string> = {
  Calm: "A3",
  Focused: "C4",
  Energetic: "G3",
  Nostalgic: "D4",
  Curious: "E4",
};

export const tonicFor = (mood: MoodName): string => tonics[mood];

export type InstrumentName = "grand" | "felt" | "hall";

/** Three timbres, all shaped from the same sampled grand piano. */
export const INSTRUMENTS: Record<
  InstrumentName,
  { label: string; cutoff: number; reverb: number; volume: number }
> = {
  grand: { label: "Grand", cutoff: 18000, reverb: 0.12, volume: -6 },
  felt: { label: "Felt", cutoff: 1100, reverb: 0.2, volume: -3 },
  hall: { label: "Hall", cutoff: 18000, reverb: 0.5, volume: -6 },
};

/** Staff position of a note: diatonic steps above C0 (E4, the bottom line, is 30). */
export function staffStep(note: string): { step: number; accidental: "#" | "b" | null } | null {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!match) return null;
  const letters = "CDEFGAB";
  return {
    step: 7 * Number(match[3]) + letters.indexOf(match[1] as string),
    accidental: (match[2] as "#" | "b" | undefined) ?? null,
  };
}
