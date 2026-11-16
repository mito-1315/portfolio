import { Fragment } from "react";
import type { ReactNode } from "react";
import type { QuizNote, QuizSong } from "../../quiz/types";

/* ---------- Shapes the admin API returns ---------- */

export type Collection = {
  id: number;
  key: string;
  name: string;
  description: string;
  instrument: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  total: number;
  enabledCount: number;
  easy: number;
  medium: number;
  hard: number;
  lastSongUpdate: string | null;
};

export type SongRow = {
  id: number;
  songId: string;
  title: string;
  movie: string;
  difficulty: string;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string;
  tempo: number;
  timeSignature: string;
  key: string;
  noteCount: number;
  beats: number;
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
  /** Only on a file check: this id is already in the target collection. */
  exists?: boolean;
};

export type FileReport = {
  ok: boolean;
  fileErrors: Issue[];
  collection: { id: string; name: string; description: string; instrument: string } | null;
  songs: SongReport[];
};

export type Candidate = {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  site: string;
  kind: "letters" | "sargam";
  scope: "whole" | "first" | "longest";
  noteCount: number;
  restCount: number;
  snippet: string;
  flags: string[];
  score: number;
  notes: QuizNote[];
};

export type FindResult = {
  query: string;
  engine: string;
  pagesChecked: number;
  skipped: { url: string; reason: string }[];
  candidates: Candidate[];
};

/* ---------- Formatting and display ---------- */

/** One note per line, so a long melody stays readable instead of running to thousands of lines. */
const noteLine = (n: QuizNote) => JSON.stringify(n).replace(/":/g, '": ').replace(/,"/g, ', "');

function withNotes(value: unknown, depth: number): string {
  const pad = " ".repeat(depth * 2);
  const record = value as { notes?: QuizNote[] };
  if (!Array.isArray(record.notes)) return JSON.stringify(value, null, 2);
  const head = JSON.stringify({ ...record, notes: "__NOTES__" }, null, 2);
  const lines = record.notes.map((n) => `${pad}    ${noteLine(n)}`).join(",\n");
  return head.replace('"__NOTES__"', record.notes.length ? `[\n${lines}\n${pad}  ]` : "[]");
}

/** A song as readable JSON. */
export const formatSong = (song: unknown): string => withNotes(song, 0);

/** Pretty-prints whatever JSON text this is, keeping notes on single lines where it recognises them. */
export function beautify(text: string): string {
  const value = JSON.parse(text) as unknown;
  const file = value as { collection?: { songs?: unknown[] } };
  if (file?.collection && Array.isArray(file.collection.songs)) {
    const songs = file.collection.songs.map((s) => withNotes(s, 3).replace(/\n/g, "\n      "));
    const head = JSON.stringify({ ...(file as object), collection: { ...file.collection, songs: ["__SONGS__"] } }, null, 2);
    return head.replace('"__SONGS__"', songs.length ? `\n      ${songs.join(",\n      ")}\n    ` : "");
  }
  const record = value as { notes?: unknown };
  return Array.isArray(record?.notes) ? formatSong(value) : JSON.stringify(value, null, 2);
}

/** Colours JSON text: keys, strings, numbers and true/false/null get their own classes. */
export function highlight(json: string): ReactNode {
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of json.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(json.slice(last, at));
    if (match[1] !== undefined) {
      parts.push(
        <Fragment key={key++}>
          <span className={match[2] ? "jk" : "js"}>{match[1]}</span>
          {match[2]}
        </Fragment>
      );
    } else if (match[3] !== undefined) {
      parts.push(<span key={key++} className="jb">{match[3]}</span>);
    } else {
      parts.push(<span key={key++} className="jn">{match[4]}</span>);
    }
    last = at + match[0].length;
  }
  if (last < json.length) parts.push(json.slice(last));
  return parts;
}

/** Saves text as a file in the browser. */
export function downloadText(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A tidy id from a title, e.g. "Kannazhaga" -> "kannazhaga". */
export const slugId = (title: string) =>
  title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "song";

/** A song document ready to edit from some notes: nothing is claimed beyond what was given. */
export function draftFrom(title: string, movie: string, notes: QuizNote[], existingIds: string[]): QuizSong {
  let id = slugId(title);
  for (let n = 2; existingIds.includes(id); n++) id = `${slugId(title)}_${n}`;
  const octaves = notes.filter((n) => n.pitch !== "REST").map((n) => Number(/-?\d$/.exec(n.pitch)?.[0] ?? 4));
  return {
    id,
    title,
    movie,
    difficulty: "easy",
    music: {
      tempo: 100,
      timeSignature: { numerator: 4, denominator: 4 },
      octaveRange: { min: Math.min(...octaves, 8), max: Math.max(...octaves, 0) },
      startOffsetBeats: 0,
      loop: false,
    },
    playback: { instrument: "acoustic_piano", volume: 0.8, noteGap: 0 },
    notes,
    // Disabled until it has been previewed and corrected, so a draft never reaches visitors by accident.
    quiz: { hint: "", maxReplays: 2, showTitleBeforeAnswer: false, enabled: false },
  };
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never";
