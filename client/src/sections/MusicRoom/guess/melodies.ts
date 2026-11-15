import { midiToNote, noteToMidi } from "../../../audio/musicTheory";

/**
 * Melodies for "Guess the Song".
 *
 * Only tunes in the public domain are built in (traditional songs and
 * composers whose work is long out of copyright), written as note data and
 * played on the site's own piano samples. Your own melodies can be added
 * from the admin dashboard and arrive through the API.
 */

export type PhraseNote = {
  /** "C4", "D#5", "Eb4", or "R" for a rest. */
  note: string;
  /** Length in beats. */
  beats: number;
};

export type Melody = {
  id: string;
  title: string;
  composer: string;
  /** 1 = easy, 2 = medium, 3 = hard. */
  difficulty: 1 | 2 | 3;
  notes: PhraseNote[];
};

/** Reads "C4:1 D4:0.5 R:1" into notes; anything malformed is skipped. */
export function parseNotes(text: string): PhraseNote[] {
  const result: PhraseNote[] = [];
  for (const token of text.trim().split(/\s+/)) {
    const [name, length] = token.split(":");
    const beats = Number(length ?? "1");
    if (!name || !Number.isFinite(beats) || beats <= 0 || beats > 16) continue;
    if (name === "R" || noteToMidi(name) !== null) result.push({ note: name, beats });
  }
  return result;
}

const builtIn = (
  id: string,
  title: string,
  composer: string,
  difficulty: 1 | 2 | 3,
  notes: string
): Melody => ({ id, title, composer, difficulty, notes: parseNotes(notes) });

export const BUILT_IN_MELODIES: Melody[] = [
  builtIn(
    "twinkle",
    "Twinkle, Twinkle, Little Star",
    "Traditional",
    1,
    "C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2"
  ),
  builtIn(
    "hot-cross-buns",
    "Hot Cross Buns",
    "Traditional",
    1,
    "E4:1 D4:1 C4:2 E4:1 D4:1 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4:1 D4:1 C4:2"
  ),
  builtIn(
    "mary-lamb",
    "Mary Had a Little Lamb",
    "Traditional",
    1,
    "E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2 D4:1 D4:1 D4:2 E4:1 G4:1 G4:2"
  ),
  builtIn(
    "happy-birthday",
    "Happy Birthday to You",
    "Hill sisters, 1893",
    1,
    "C4:0.75 C4:0.25 D4:1 C4:1 F4:1 E4:2 C4:0.75 C4:0.25 D4:1 C4:1 G4:1 F4:2"
  ),
  builtIn(
    "ode-to-joy",
    "Ode to Joy",
    "Ludwig van Beethoven",
    1,
    "E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2"
  ),
  builtIn(
    "jingle-bells",
    "Jingle Bells",
    "James Lord Pierpont, 1857",
    1,
    "E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4"
  ),
  builtIn(
    "amazing-grace",
    "Amazing Grace",
    "Traditional",
    2,
    "G4:1 C5:2 E5:0.5 C5:0.5 E5:2 D5:1 C5:2 A4:1 G4:2"
  ),
  builtIn(
    "greensleeves",
    "Greensleeves",
    "Traditional",
    2,
    "A4:1 C5:2 D5:1 E5:1.5 F5:0.5 E5:1 D5:2 B4:1 G4:1.5 A4:0.5 B4:1 C5:2 A4:1 A4:1.5 G#4:0.5 A4:1 B4:2 G#4:1 E4:2"
  ),
  builtIn(
    "fur-elise",
    "Für Elise",
    "Ludwig van Beethoven",
    2,
    "E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5 E4:0.5 G#4:0.5 B4:0.5 C5:1.5"
  ),
  builtIn(
    "beethoven-5",
    "Symphony No. 5",
    "Ludwig van Beethoven",
    2,
    "G4:0.5 G4:0.5 G4:0.5 Eb4:3 F4:0.5 F4:0.5 F4:0.5 D4:3"
  ),
];

/* ---------- Helpers ---------- */

/** The melody's sounding notes, ignoring rests. */
export const soundingNotes = (notes: PhraseNote[]) => notes.filter((n) => n.note !== "R");

/** Moves every note by some semitones (rests stay rests). */
export function transpose(notes: PhraseNote[], semitones: number): PhraseNote[] {
  if (semitones === 0) return notes;
  return notes.map((n) => {
    if (n.note === "R") return n;
    const midi = noteToMidi(n.note);
    return midi === null ? n : { ...n, note: midiToNote(midi + semitones) };
  });
}

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

/** Pitch class (0..11) of a note name, or null. */
export function pitchClassOf(note: string): number | null {
  const midi = noteToMidi(note);
  return midi === null ? null : ((midi % 12) + 12) % 12;
}
