/** Where the site's grand piano recordings live, shared by every part that plays piano. */
export const SAMPLE_BASE_URL = "/audio/piano/";

/** The Salamander grand piano, one recording every minor third. */
export const SAMPLE_URLS: Record<string, string> = Object.fromEntries(
  [
    "A0", "C1", "D#1", "F#1", "A1", "C2", "D#2", "F#2", "A2", "C3", "D#3", "F#3",
    "A3", "C4", "D#4", "F#4", "A4", "C5", "D#5", "F#5", "A5", "C6", "D#6", "F#6",
    "A6", "C7", "D#7", "F#7", "A7", "C8",
  ].map((note) => [note, `${note.replace("#", "s")}.mp3`])
);
