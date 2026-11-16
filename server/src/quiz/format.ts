/**
 * The Guess the Song file format, version 1.0, and its checks.
 *
 * Timing: `startBeat` and `durationBeats` are counted in beats of the time
 * signature, where one beat is one note of the denominator (a quarter note in
 * 4/4, an eighth in 6/8). `tempo` is quarter notes per minute, so one beat lasts
 * (60 / tempo) * (4 / denominator) seconds.
 */

export const FORMAT_VERSION = "1.0";
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
/** Instruments the site can actually play. Anything else is played as piano, with a warning. */
export const SUPPORTED_INSTRUMENTS = ["acoustic_piano"];

export type QuizNote = { id: number; pitch: string; startBeat: number; durationBeats: number; velocity: number };

export type QuizSongDoc = {
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

export type QuizCollectionDoc = {
  id: string;
  name: string;
  description: string;
  instrument: string;
  songs: QuizSongDoc[];
};

export type Issue = { path: string; message: string };

export type SongReport = {
  index: number;
  id: string;
  title: string;
  movie: string;
  difficulty: string;
  tempo: number | null;
  timeSignature: string;
  key: string;
  noteCount: number;
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
};

export type FileReport = {
  ok: boolean;
  /** Problems with the file as a whole, before any song is looked at. */
  fileErrors: Issue[];
  collection: { id: string; name: string; description: string; instrument: string } | null;
  songs: SongReport[];
};

const PITCH = /^([A-G])(#|b)?(-?\d)$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === "string";

export function parsePitch(pitch: string): { octave: number } | null {
  const match = PITCH.exec(pitch);
  return match ? { octave: Number(match[3]) } : null;
}

/** Every problem with one song. Warnings are unusual but legitimate; errors stop the song being saved. */
export function checkSong(raw: unknown, index = 0): SongReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const error = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });
  const where = `songs[${index}]`;

  const song = isObject(raw) ? raw : {};
  if (!isObject(raw)) error(where, "A song must be an object.");

  const id = isString(song.id) ? song.id : "";
  if (!id) error(`${where}.id`, "Required: a short unique id such as song_001.");
  else if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) error(`${where}.id`, "Use only letters, numbers, - and _ (up to 64 characters).");

  const title = isString(song.title) ? song.title.trim() : "";
  if (!title) error(`${where}.title`, "Required.");
  else if (title.length > 200) error(`${where}.title`, "Too long (200 characters at most).");

  const movie = isString(song.movie) ? song.movie.trim() : "";
  if (!isString(song.movie)) error(`${where}.movie`, "Required (it may be an empty string for a song with no film).");
  else if (movie.length > 200) error(`${where}.movie`, "Too long (200 characters at most).");
  else if (!movie) warn(`${where}.movie`, "No movie name: visitors will not be asked for one.");

  const difficulty = isString(song.difficulty) ? song.difficulty : "";
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) error(`${where}.difficulty`, 'Must be "easy", "medium" or "hard".');

  // ----- music -----
  const music = isObject(song.music) ? song.music : null;
  if (!music) error(`${where}.music`, "Required.");
  let tempo: number | null = null;
  let denominator = 4;
  let key = "";
  let octMin = 0;
  let octMax = 8;
  let startOffset = 0;
  if (music) {
    if (!isNumber(music.tempo) || music.tempo <= 0) error(`${where}.music.tempo`, "Must be a positive number of beats per minute.");
    else if (music.tempo < 20 || music.tempo > 400) error(`${where}.music.tempo`, "Must be between 20 and 400.");
    else {
      tempo = music.tempo;
      if (tempo < 40 || tempo > 240) warn(`${where}.music.tempo`, `${tempo} BPM is unusual: check it.`);
    }

    const ts = isObject(music.timeSignature) ? music.timeSignature : null;
    if (!ts) error(`${where}.music.timeSignature`, "Required: { numerator, denominator }.");
    else {
      if (!Number.isInteger(ts.numerator) || (ts.numerator as number) < 1 || (ts.numerator as number) > 32) {
        error(`${where}.music.timeSignature.numerator`, "Must be a whole number from 1 to 32.");
      }
      if (![1, 2, 4, 8, 16, 32].includes(ts.denominator as number)) {
        error(`${where}.music.timeSignature.denominator`, "Must be 1, 2, 4, 8, 16 or 32.");
      } else denominator = ts.denominator as number;
    }

    if (music.key !== undefined && music.key !== null) {
      if (!isString(music.key) || music.key.length > 40) error(`${where}.music.key`, "Must be short text such as \"C Major\".");
      else key = music.key;
    }

    const range = isObject(music.octaveRange) ? music.octaveRange : null;
    if (!range) error(`${where}.music.octaveRange`, "Required: { min, max }.");
    else {
      const okMin = Number.isInteger(range.min) && (range.min as number) >= 0 && (range.min as number) <= 8;
      const okMax = Number.isInteger(range.max) && (range.max as number) >= 0 && (range.max as number) <= 8;
      if (!okMin) error(`${where}.music.octaveRange.min`, "Must be a whole number from 0 to 8.");
      if (!okMax) error(`${where}.music.octaveRange.max`, "Must be a whole number from 0 to 8.");
      if (okMin && okMax) {
        octMin = range.min as number;
        octMax = range.max as number;
        if (octMin > octMax) error(`${where}.music.octaveRange`, "min cannot be higher than max.");
      }
    }

    if (!isNumber(music.startOffsetBeats) || music.startOffsetBeats < 0 || music.startOffsetBeats > 64) {
      error(`${where}.music.startOffsetBeats`, "Must be a number from 0 to 64 (beats of silence before the melody).");
    } else startOffset = music.startOffsetBeats;
    if (typeof music.loop !== "boolean") error(`${where}.music.loop`, "Must be true or false.");
  }

  // ----- playback -----
  const playback = isObject(song.playback) ? song.playback : null;
  if (!playback) error(`${where}.playback`, "Required.");
  else {
    if (!isString(playback.instrument) || !playback.instrument) error(`${where}.playback.instrument`, "Required.");
    else if (!SUPPORTED_INSTRUMENTS.includes(playback.instrument)) {
      warn(`${where}.playback.instrument`, `"${playback.instrument}" is not available here: acoustic_piano will be used.`);
    }
    if (!isNumber(playback.volume) || playback.volume < 0 || playback.volume > 1) error(`${where}.playback.volume`, "Must be between 0 and 1.");
    if (!isNumber(playback.noteGap) || playback.noteGap < 0 || playback.noteGap > 2) error(`${where}.playback.noteGap`, "Must be between 0 and 2 (beats).");
  }

  // ----- notes -----
  const notes = Array.isArray(song.notes) ? song.notes : null;
  let noteCount = 0;
  if (!notes) error(`${where}.notes`, "Required: a list of notes.");
  else if (notes.length === 0) error(`${where}.notes`, "A playable song needs at least one note. An empty list is not allowed.");
  else if (notes.length > 3000) error(`${where}.notes`, "Too many notes (3000 at most).");
  else {
    noteCount = notes.length;
    const seenIds = new Set<number>();
    let sounding = 0;
    const parsed: { pitch: string; start: number; end: number; index: number }[] = [];
    let previousStart = -1;
    let outOfOrder = false;

    notes.forEach((n, i) => {
      const at = `${where}.notes[${i}]`;
      if (!isObject(n)) return error(at, "A note must be an object.");

      if (!Number.isInteger(n.id) || (n.id as number) < 1) error(`${at}.id`, "Must be a positive whole number.");
      else if (seenIds.has(n.id as number)) error(`${at}.id`, `Note id ${n.id} is used twice.`);
      else seenIds.add(n.id as number);

      const pitch = isString(n.pitch) ? n.pitch : "";
      const isRest = pitch === "REST";
      if (!pitch) error(`${at}.pitch`, 'Required: a note such as "C4" or "F#5", or "REST".');
      else if (!isRest) {
        const info = parsePitch(pitch);
        if (!info) error(`${at}.pitch`, `"${pitch}" is not a valid note. Use a letter A-G, an optional # or b, and an octave, e.g. C#4.`);
        else if (info.octave < 0 || info.octave > 8) error(`${at}.pitch`, `Octave ${info.octave} is outside the playable range (0 to 8).`);
        else {
          sounding++;
          if (info.octave < octMin || info.octave > octMax) warn(`${at}.pitch`, `${pitch} is outside the song's octave range (${octMin} to ${octMax}).`);
        }
      }

      const startOk = isNumber(n.startBeat) && n.startBeat >= 0 && n.startBeat <= 10000;
      const durOk = isNumber(n.durationBeats) && n.durationBeats > 0 && n.durationBeats <= 64;
      if (!startOk) error(`${at}.startBeat`, "Must be a number of beats, 0 or more.");
      if (!durOk) error(`${at}.durationBeats`, "Must be more than 0 and at most 64 beats.");
      if (!isNumber(n.velocity) || n.velocity < 0 || n.velocity > 1) error(`${at}.velocity`, "Must be between 0 and 1.");
      else if (isRest && n.velocity !== 0) warn(`${at}.velocity`, "A REST should have velocity 0.");
      else if (!isRest && n.velocity === 0) warn(`${at}.velocity`, "Velocity 0 is silent: this note will not be heard.");

      if (startOk && durOk && pitch) {
        const start = n.startBeat as number;
        if (start < previousStart) outOfOrder = true;
        previousStart = Math.max(previousStart, start);
        if (!isRest) parsed.push({ pitch, start, end: start + (n.durationBeats as number), index: i });
      }
    });

    if (sounding === 0 && errors.length === 0) error(`${where}.notes`, "Every note is a rest: there is nothing to play.");
    if (outOfOrder) warn(`${where}.notes`, "Notes are not in time order. They will still be scheduled by startBeat.");

    // Unusual timing worth a look: same-pitch overlaps and long silences. Not errors.
    const byPitch = new Map<string, typeof parsed>();
    for (const p of parsed) byPitch.set(p.pitch, [...(byPitch.get(p.pitch) ?? []), p]);
    for (const [pitch, list] of byPitch) {
      const sorted = [...list].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.start < sorted[i - 1]!.end - 1e-9) {
          warn(`${where}.notes[${sorted[i]!.index}]`, `${pitch} starts before the previous ${pitch} has finished.`);
          break;
        }
      }
    }
    const spans = [...parsed].sort((a, b) => a.start - b.start);
    let reach = spans[0]?.end ?? 0;
    for (const s of spans) {
      if (s.start - reach > 4) {
        warn(`${where}.notes[${s.index}]`, `${(s.start - reach).toFixed(1)} beats of silence before this note: check that nothing is missing.`);
        break;
      }
      reach = Math.max(reach, s.end);
    }
  }

  // ----- quiz -----
  const quiz = isObject(song.quiz) ? song.quiz : null;
  if (!quiz) error(`${where}.quiz`, "Required.");
  else {
    if (!isString(quiz.hint) || quiz.hint.length > 200) error(`${where}.quiz.hint`, "Must be short text (200 characters at most).");
    if (!Number.isInteger(quiz.maxReplays) || (quiz.maxReplays as number) < 0 || (quiz.maxReplays as number) > 20) {
      error(`${where}.quiz.maxReplays`, "Must be a whole number from 0 to 20.");
    }
    if (typeof quiz.showTitleBeforeAnswer !== "boolean") error(`${where}.quiz.showTitleBeforeAnswer`, "Must be true or false.");
    if (typeof quiz.enabled !== "boolean") error(`${where}.quiz.enabled`, "Must be true or false.");
  }

  void startOffset;
  void denominator;
  const ts = music && isObject(music.timeSignature) ? `${music.timeSignature.numerator}/${music.timeSignature.denominator}` : "";
  return {
    index,
    id,
    title,
    movie,
    difficulty,
    tempo,
    timeSignature: ts,
    key,
    noteCount,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/** Checks a whole file: its wrapper, then every song on its own, so one bad song never hides the others. */
export function checkFile(raw: unknown): FileReport {
  const fileErrors: Issue[] = [];
  const fail = (path: string, message: string) => fileErrors.push({ path, message });

  if (!isObject(raw)) {
    fail("", "The file must contain a JSON object.");
    return { ok: false, fileErrors, collection: null, songs: [] };
  }
  if (raw.formatVersion !== FORMAT_VERSION) fail("formatVersion", `Unsupported or missing formatVersion. This site reads "${FORMAT_VERSION}".`);
  const col = isObject(raw.collection) ? raw.collection : null;
  if (!col) {
    fail("collection", "Required: a collection object holding the songs.");
    return { ok: false, fileErrors, collection: null, songs: [] };
  }

  const text = (key: string, max: number, required: boolean) => {
    const v = col[key];
    if (!isString(v) || (required && !v.trim())) fail(`collection.${key}`, "Required.");
    else if (v.length > max) fail(`collection.${key}`, `Too long (${max} characters at most).`);
    return isString(v) ? v : "";
  };
  const id = text("id", 64, true);
  if (id && !/^[A-Za-z0-9_-]+$/.test(id)) fail("collection.id", "Use only letters, numbers, - and _.");
  const name = text("name", 120, true);
  const description = isString(col.description) ? col.description : "";
  if (col.description !== undefined && !isString(col.description)) fail("collection.description", "Must be text.");
  const instrument = isString(col.instrument) ? col.instrument : "acoustic_piano";

  if (!Array.isArray(col.songs)) {
    fail("collection.songs", "Required: a list of songs.");
    return { ok: false, fileErrors, collection: { id, name, description, instrument }, songs: [] };
  }
  if (col.songs.length > 500) fail("collection.songs", "Too many songs in one file (500 at most).");

  const songs = col.songs.slice(0, 500).map((s, i) => checkSong(s, i));
  // The same id twice in one file would make the second overwrite the first.
  const firstSeen = new Map<string, number>();
  for (const report of songs) {
    if (!report.id) continue;
    const earlier = firstSeen.get(report.id);
    if (earlier !== undefined) {
      report.errors.push({ path: `songs[${report.index}].id`, message: `The id "${report.id}" is already used by songs[${earlier}] in this file.` });
      report.ok = false;
    } else firstSeen.set(report.id, report.index);
  }

  return { ok: fileErrors.length === 0, fileErrors, collection: { id, name, description, instrument }, songs };
}

/** Puts keys in the order the format documents, whatever order the database stored them in. */
const arrange = (value: unknown, order: string[]): Record<string, unknown> => {
  const source = (isObject(value) ? value : {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of order) if (key in source) result[key] = source[key];
  for (const key of Object.keys(source)) if (!(key in result)) result[key] = source[key];
  return result;
};

/** A saved song with its fields in the documented order, so views and exports read like the format. */
export function orderedSong(value: unknown): QuizSongDoc {
  const song = arrange(value, ["id", "title", "movie", "difficulty", "music", "playback", "notes", "quiz"]);
  if (isObject(song.music)) {
    const music = arrange(song.music, ["tempo", "timeSignature", "key", "octaveRange", "startOffsetBeats", "loop"]);
    music.timeSignature = arrange(music.timeSignature, ["numerator", "denominator"]);
    music.octaveRange = arrange(music.octaveRange, ["min", "max"]);
    song.music = music;
  }
  if (isObject(song.playback)) song.playback = arrange(song.playback, ["instrument", "volume", "noteGap"]);
  if (Array.isArray(song.notes)) song.notes = song.notes.map((n) => arrange(n, ["id", "pitch", "startBeat", "durationBeats", "velocity"]));
  if (isObject(song.quiz)) song.quiz = arrange(song.quiz, ["hint", "maxReplays", "showTitleBeforeAnswer", "enabled"]);
  return song as unknown as QuizSongDoc;
}

/** Beats and seconds, for stats and previews. */
export function songBeats(song: QuizSongDoc): number {
  return song.notes.reduce((max, n) => Math.max(max, n.startBeat + n.durationBeats), 0);
}

/** A blank file to fill in. Disabled by default, so nothing half-finished reaches visitors. */
export function blankTemplate(): { formatVersion: string; collection: QuizCollectionDoc } {
  return {
    formatVersion: FORMAT_VERSION,
    collection: {
      id: "my_collection",
      name: "My Collection",
      description: "Describe this collection",
      instrument: "acoustic_piano",
      songs: [
        {
          id: "song_001",
          title: "Replace with the song title",
          movie: "Replace with the movie name",
          difficulty: "easy",
          music: {
            tempo: 100,
            timeSignature: { numerator: 4, denominator: 4 },
            key: "C Major",
            octaveRange: { min: 4, max: 5 },
            startOffsetBeats: 0,
            loop: false,
          },
          playback: { instrument: "acoustic_piano", volume: 0.8, noteGap: 0 },
          // Three illustrative notes so the structure is clear. Replace them with the real melody.
          notes: [
            { id: 1, pitch: "C4", startBeat: 0, durationBeats: 1, velocity: 0.8 },
            { id: 2, pitch: "G4", startBeat: 1, durationBeats: 2, velocity: 0.9 },
            { id: 3, pitch: "REST", startBeat: 3, durationBeats: 1, velocity: 0 },
          ],
          quiz: { hint: "A short hint that does not give the answer away", maxReplays: 2, showTitleBeforeAnswer: false, enabled: false },
        },
      ],
    },
  };
}
