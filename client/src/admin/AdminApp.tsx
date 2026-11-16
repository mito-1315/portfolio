import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  call,
  checkHealth,
  getSession,
  signOutRequest,
  uploadFile,
  type SessionInfo,
  type ApiHealth,
  type FileTags,
  type SpotifyMatch,
  type UploadKind,
} from "./adminApi";
import { Heart } from "lucide-react";
import BulkUpload from "./BulkUpload";
import { useConfirm } from "./ConfirmDialog";
import PlaylistManager from "./PlaylistManager";

const QuizManager = lazy(() => import("./quiz/QuizManager"));
import { GUESS_THE_SONG_ENABLED } from "../features";
import "./Admin.css";

type Row = Record<string, unknown> & { id: number };
type FieldType = "text" | "textarea" | "select" | "number" | "checkbox" | "upload";
type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  /** For upload fields: what kind of file is accepted. */
  upload?: UploadKind;
  /** For select fields: friendlier text for each option value. */
  optionLabels?: Record<string, string>;
  /** Value a new row starts with. */
  default?: string;
};

type Resource = {
  label: string;
  /** Endpoint used to list rows (admin where it exists). */
  listPath: string;
  /** Endpoint used to create/update/delete rows. */
  writePath: string;
  fields: Field[];
  /** Tracks only: shows the Spotify lookup panel above the fields. */
  spotify?: boolean;
  /** Rows can be moved up and down. */
  reorder?: boolean;
  /** Rows have a heart that adds the song to the Favourites playlist. */
  like?: boolean;
  /** A small picture at the left of each row: the song's artwork or the movie's poster. */
  thumb?: { url: (row: Row) => string | null; shape: "square" | "poster" };
  /** Offers uploading many songs at once. */
  bulk?: boolean;
  /** Column(s) shown in the list. */
  summary: (row: Row) => string;
};

/** The five moods of the entry screen: the only categories tracks can have. */
const MOODS = ["Calm", "Focused", "Energetic", "Nostalgic", "Curious"];

const resources: Record<string, Resource> = {
  tracks: {
    label: "Tracks",
    listPath: "/admin/tracks",
    writePath: "/admin/tracks",
    spotify: true,
    reorder: true,
    bulk: true,
    like: true,
    thumb: { url: (r) => (r.coverUrl ? String(r.coverUrl) : null), shape: "square" },
    fields: [
      { key: "title", label: "Song title", type: "text", required: true },
      { key: "artist", label: "Artist name", type: "text", required: true },
      { key: "audioUrl", label: "Audio file", type: "upload", upload: "audio", required: true },
      { key: "coverUrl", label: "Album artwork", type: "upload", upload: "image" },
      { key: "mood", label: "Category (mood)", type: "select", options: MOODS, required: true },
      { key: "album", label: "Album", type: "text" },
      { key: "releaseDate", label: "Release date (year or full date)", type: "text" },
      { key: "durationMs", label: "Duration (milliseconds)", type: "number" },
      { key: "spotifyUrl", label: "Spotify link", type: "text" },
      { key: "spotifyId", label: "Spotify track ID", type: "text" },
      { key: "description", label: "Description (optional)", type: "text" },
      { key: "sortOrder", label: "Display order (lower plays first)", type: "number" },
      { key: "published", label: "Active (shown on the site)", type: "checkbox" },
    ],
    summary: (r) => `${r.title} — ${r.artist}  ·  ${r.mood ?? "no mood"}${r.published === false ? "  (inactive)" : ""}`,
  },
  movies: {
    label: "Movies",
    listPath: "/admin/movies",
    writePath: "/admin/movies",
    reorder: true,
    thumb: { url: (r) => (r.posterUrl ? String(r.posterUrl) : null), shape: "poster" },
    fields: [
      { key: "posterUrl", label: "Poster image (drop it here)", type: "upload", upload: "image" },
      { key: "title", label: "Movie title", type: "text", required: true },
      { key: "year", label: "Release year (optional)", type: "number" },
      { key: "director", label: "Director (optional)", type: "text" },
      { key: "note", label: "Your note about the movie (optional)", type: "text" },
      {
        key: "placement",
        label: "Where its hidden hint lives",
        type: "select",
        required: true,
        default: "auto",
        options: ["auto", "about", "skills", "experience", "leadership", "music", "recommend", "contact", "projects"],
        optionLabels: {
          auto: "Automatic (spread out for me)",
          about: "About",
          skills: "Skills",
          experience: "Experience",
          leadership: "Leadership",
          music: "Music Room",
          recommend: "Recommendations",
          contact: "Contact",
          projects: "Projects",
        },
      },
      { key: "sortOrder", label: "Display order (decides automatic placement)", type: "number" },
      { key: "published", label: "Easter egg enabled", type: "checkbox" },
    ],
    summary: (r) =>
      `${r.title}${r.year ? ` (${r.year})` : ""}  ·  ${r.placement === "auto" || !r.placement ? "automatic" : r.placement}${
        r.posterUrl ? "" : "  — no poster"
      }${r.published === false ? "  (off)" : ""}`,
  },
};

const ALL_TABS = [...Object.keys(resources), "playlists", "quiz", "recommendations", "settings"] as const;
// Guess the Song is switched off for now (see features.ts), so its tab is left out.
const TABS = ALL_TABS.filter((t) => t !== "quiz" || GUESS_THE_SONG_ENABLED);
type Tab = (typeof ALL_TABS)[number];

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/* ---------- Login ---------- */

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

/** Google's own sign-in button. It hands back a signed ID token that the server verifies. */
function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const render = () => {
      const google = (window as unknown as { google?: GoogleAccounts }).google;
      if (!google || !holder.current) return;
      google.accounts.id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential) });
      google.accounts.id.renderButton(holder.current, { theme: "outline", size: "large", shape: "pill", width: 280 });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [clientId]);

  return <div ref={holder} className="admin-google" />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<ApiHealth>("checking");
  const [info, setInfo] = useState<SessionInfo | null>(null);

  const recheck = useCallback(() => {
    setHealth("checking");
    checkHealth().then(setHealth);
    getSession().then(setInfo);
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    getSession().then((session) => {
      if (cancelled) return;
      setInfo(session);
      if (session?.authenticated) onDone();
    });
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  const withGoogle = async (credential: string) => {
    setBusy(true);
    setError("");
    try {
      await call("POST", "/admin/google", { credential });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await call("POST", "/admin/login", { password });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <span className="admin-label">ADMIN</span>
        <h1>Sign in</h1>

        {info?.google && <GoogleButton clientId={info.google.clientId} onCredential={withGoogle} />}
        {info?.google && info.password && <p className="admin-hint">or use the password</p>}

        {(info === null || info.password) && (
          <>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus={!info?.google}
              required
            />
            <button type="submit" disabled={busy || health === "offline"}>
              {busy ? "Checking…" : "Enter"}
            </button>
          </>
        )}
        {error && <p className="admin-error" role="alert">{error}</p>}

        <p className={`admin-health ${health}`} role="status">
          <span aria-hidden="true" />
          {health === "checking" && "Checking the API…"}
          {health === "up" && "API and database are running"}
          {health === "database-down" && "The API is running but the database is not. Start PostgreSQL."}
          {health === "offline" && "The API is not running. Start it with npm run dev."}
          {health !== "checking" && health !== "up" && (
            <button type="button" onClick={recheck}>
              Check again
            </button>
          )}
        </p>
      </form>
    </main>
  );
}

/* ---------- A file picker that uploads straight away ---------- */

function UploadField({
  kind,
  value,
  required,
  onChange,
  onUploaded,
  onAuthError,
}: {
  kind: UploadKind;
  value: string;
  required?: boolean;
  onChange: (url: string) => void;
  /** Called after a successful upload, with what the file said about itself. */
  onUploaded?: (file: File, tags: FileTags | undefined) => void;
  onAuthError: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadFile(file, kind);
      onChange(result.url);
      onUploaded?.(file, result.tags);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-upload">
      {value && (
        <div className="admin-upload-preview">
          {kind === "image" ? <img src={value} alt="" /> : <audio controls src={value} preload="none" />}
          <small>{value}</small>
        </div>
      )}
      <div className="admin-upload-row">
        <label
          className={`admin-drop ${dragging ? "over" : ""} ${busy ? "busy" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) void pick(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept={kind === "audio" ? "audio/*,.mp3,.m4a,.wav,.ogg,.flac" : "image/*"}
            disabled={busy}
            // A required upload is satisfied by an existing file, so the browser's own check is skipped.
            required={required && !value}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <strong>{busy ? "Uploading…" : dragging ? "Drop it here" : value ? "Replace the file" : `Drop ${kind === "audio" ? "an audio file" : "an image"} here`}</strong>
          {!busy && <span>or click to choose</span>}
        </label>
        {value && !busy && (
          <button type="button" className="ghost" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>
  );
}

/** A small preview of a row's picture. Hovering it enlarges it a little; no picture shows the first letter. */
function ListThumb({ url, shape, label }: { url: string | null; shape: "square" | "poster"; label: string }) {
  return (
    <span className={`admin-list-thumb ${shape}`} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" draggable={false} /> : <i>{label.slice(0, 1).toUpperCase()}</i>}
    </span>
  );
}

/* ---------- Song lookup on Spotify ---------- */

const minutes = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/**
 * Finds the song on Spotify so its details do not have to be typed. It starts
 * on its own from the uploaded file's tags (or its name), and also accepts
 * search words or a pasted Spotify link. Picking a result fills the form, which
 * can still be edited before saving.
 */
function SpotifyFinder({
  seed,
  onPick,
  onAuthError,
}: {
  /** Changes each time a new file is uploaded; carries the words to search for. */
  seed: { id: number; query: string } | null;
  onPick: (match: SpotifyMatch) => void;
  onAuthError: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyMatch[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    call<{ configured: boolean }>("GET", "/admin/spotify/status")
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(null));
  }, []);

  const search = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (q.length < 2) return;
      setBusy(true);
      setMessage("");
      try {
        const found = await call<SpotifyMatch[]>("GET", `/admin/spotify/search?q=${encodeURIComponent(q)}`);
        setResults(found);
        if (found.length === 0) setMessage("Nothing found. Try the song and artist names, or paste the Spotify link.");
      } catch (e) {
        setResults(null);
        if (e instanceof ApiError && e.status === 401) onAuthError();
        else setMessage(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [onAuthError]
  );

  // A new upload starts a search by itself.
  useEffect(() => {
    if (!seed || !seed.query) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(seed.query);
    void search(seed.query);
  }, [seed, search]);

  return (
    <div className="admin-finder">
      <span className="admin-finder-title">Find the song on Spotify</span>
      <p className="admin-hint">
        Fills in the title, artist, album, artwork and more. Spotify can&apos;t recognise a song from its audio, so it
        searches by the file&apos;s tags or name; you can also type words or paste a Spotify link.
      </p>
      {configured === false && (
        <p className="admin-error" role="status">
          Spotify isn&apos;t set up yet. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to server/.env and restart the API.
        </p>
      )}
      <div className="admin-finder-bar">
        <input
          type="text"
          value={query}
          placeholder="Song and artist, or a Spotify link"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search(query);
            }
          }}
        />
        <button type="button" disabled={busy || query.trim().length < 2} onClick={() => search(query)}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      {message && configured !== false && <p className="admin-error" role="status">{message}</p>}
      {results && results.length > 0 && (
        <ul className="admin-finder-results">
          {results.map((m) => (
            <li key={m.spotifyId}>
              {m.artworkUrl ? <img src={m.artworkUrl} alt="" loading="lazy" /> : <span className="noart">♪</span>}
              <div>
                <strong>{m.title}</strong>
                <span>{m.artist}</span>
                <small>
                  {m.album}
                  {m.releaseDate ? ` · ${m.releaseDate.slice(0, 4)}` : ""} · {minutes(m.durationMs)}
                </small>
              </div>
              <button
                type="button"
                onClick={() => {
                  onPick(m);
                  setResults(null);
                  setMessage("Details filled in below. Check them, then save.");
                }}
              >
                Use this
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Generic list + form for tracks / movies / playlists ---------- */

function ResourceManager({ name, onAuthError }: { name: string; onAuthError: () => void }) {
  const resource = resources[name]!;
  const [rows, setRows] = useState<Row[]>([]);
    const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState("");
  const [seed, setSeed] = useState<{ id: number; query: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    },
    [onAuthError]
  );

  /** A fresh audio upload: start looking the song up from its tags, or failing that its file name. */
  const audioUploaded = (file: File, tags: FileTags | undefined) => {
    const fromName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const query = tags?.title ? `${tags.artist ?? ""} ${tags.title}`.trim() : fromName;
    setSeed({ id: Date.now(), query });
    // Anything the file already knows fills blanks right away, before any Spotify result.
    setValues((current) => ({
      ...current,
      ...(tags?.title && !current.title ? { title: tags.title } : {}),
      ...(tags?.artist && !current.artist ? { artist: tags.artist } : {}),
      ...(tags?.album && !current.album ? { album: tags.album } : {}),
      ...(tags?.year && !current.releaseDate ? { releaseDate: String(tags.year) } : {}),
      ...(tags?.durationMs && !current.durationMs ? { durationMs: String(tags.durationMs) } : {}),
    }));
  };

  /** Copies a chosen Spotify result into the form. Everything stays editable. */
  const applyMatch = (m: SpotifyMatch) => {
    setValues((current) => ({
      ...current,
      title: m.title,
      artist: m.artist,
      album: m.album,
      releaseDate: m.releaseDate,
      durationMs: String(m.durationMs),
      spotifyId: m.spotifyId,
      spotifyUrl: m.spotifyUrl,
      coverUrl: m.artworkUrl ?? current.coverUrl ?? "",
    }));
  };

  const load = useCallback(async () => {
    try {
      setRows(await call<Row[]>("GET", resource.listPath));
    } catch (e) {
      fail(e);
    }
  }, [resource.listPath, fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const open = (row: Row | "new") => {
    const next: Record<string, string | boolean> = {};
    for (const f of resource.fields) {
      const current = row === "new" ? f.default : row[f.key];
      next[f.key] =
        f.type === "checkbox"
          ? current === undefined
            ? true
            : Boolean(current)
          : current === null || current === undefined
          ? ""
          : f.key === "entryDate"
          ? String(current).slice(0, 10)
          : String(current);
    }
    setValues(next);
    setSeed(null);
    setEditing(row);
    setMessage("");
  };

  const payload = () => {
    const body: Record<string, unknown> = {};
    for (const f of resource.fields) {
      const v = values[f.key];
      if (f.type === "checkbox") body[f.key] = Boolean(v);
      else if (f.type === "number") {
        body[f.key] = v === "" || v === undefined ? (f.required ? null : undefined) : Number(v);
      } else {
        const text = String(v ?? "").trim();
        body[f.key] = text === "" ? (f.required ? text : null) : text;
      }
    }
    return body;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing === "new") await call("POST", resource.writePath, payload());
      else if (editing) await call("PUT", `${resource.writePath}/${editing.id}`, payload());
      setEditing(null);
      setMessage("Saved.");
      await load();
    } catch (err) {
      fail(err);
    }
  };

  /** Moves a row up or down and saves the new order. */
  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((r) => r.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await call("POST", `${resource.writePath}/reorder`, { ids });
      await load();
    } catch (err) {
      fail(err);
    }
  };

  /** The heart: liked songs live in the Favourites playlist. */
  const toggleLike = async (row: Row) => {
    const liked = !row.liked;
    // Show the change straight away, and undo it if the server says no.
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, liked } : r)));
    try {
      await call("PUT", `${resource.writePath}/${row.id}/favourite`, { liked });
    } catch (err) {
      setRows((current) => current.map((r) => (r.id === row.id ? { ...r, liked: !liked } : r)));
      fail(err);
    }
  };

  const remove = async (row: Row) => {
    const ok = await confirm({
      title: "Delete this?",
      message: `"${resource.summary(row).trim()}" will be deleted for good. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await call("DELETE", `${resource.writePath}/${row.id}`);
      setMessage("Deleted.");
      await load();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <section>
      {dialog}
      <div className="admin-bar">
        <h2>{resource.label}</h2>
        <div className="admin-bar-buttons">
          {resource.bulk && (
            <button type="button" className={bulkOpen ? "on" : "ghost"} onClick={() => setBulkOpen((v) => !v)}>
              Upload many songs
            </button>
          )}
          <button type="button" onClick={() => open("new")}>+ Add</button>
        </div>
      </div>
      {message && <p className="admin-note" role="status">{message}</p>}
      {resource.bulk && bulkOpen && <BulkUpload onAuthError={onAuthError} onSaved={load} />}

      {editing && (
        <form className="admin-form" onSubmit={save}>
          {resource.spotify && <SpotifyFinder seed={seed} onPick={applyMatch} onAuthError={onAuthError} />}
          {resource.fields.map((f) => (
            <label key={f.key} className={f.type === "checkbox" ? "check" : ""}>
              <span>{f.label}</span>
              {f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  rows={5}
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : f.type === "select" ? (
                <select
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {(f.options ?? []).map((option) => (
                    <option key={option} value={option}>{f.optionLabels?.[option] ?? option}</option>
                  ))}
                </select>
              ) : f.type === "upload" ? (
                <UploadField
                  kind={f.upload ?? "image"}
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(url) => setValues((current) => ({ ...current, [f.key]: url }))}
                  {...(resource.spotify && f.key === "audioUrl" ? { onUploaded: audioUploaded } : {})}
                  onAuthError={onAuthError}
                />
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <div className="admin-actions">
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="admin-list">
        {rows.length === 0 && <li className="empty">Nothing here yet.</li>}
        {rows.map((row, index) => (
          <li key={row.id}>
            <span className="admin-list-main">
              {resource.thumb && (
                <ListThumb url={resource.thumb.url(row)} shape={resource.thumb.shape} label={String(row.title ?? row.name ?? "")} />
              )}
              <span>{resource.summary(row)}</span>
            </span>
            <div>
              {resource.like && (
                <button
                  type="button"
                  className={`heart ${row.liked ? "on" : "ghost"}`}
                  aria-pressed={Boolean(row.liked)}
                  aria-label={row.liked ? "Remove from favourites" : "Add to favourites"}
                  title={row.liked ? "In your favourites" : "Add to favourites"}
                  onClick={() => toggleLike(row)}
                >
                  <Heart size={15} fill={row.liked ? "currentColor" : "none"} />
                </button>
              )}
              {resource.reorder && (
                <>
                  <button type="button" className="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                  <button type="button" className="ghost" aria-label="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>↓</button>
                </>
              )}
              <button type="button" className="ghost" onClick={() => open(row)}>Edit</button>
              <button type="button" className="ghost danger" onClick={() => remove(row)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Recommendation moderation ---------- */

function Recommendations({ onAuthError }: { onAuthError: () => void }) {
  const [status, setStatus] = useState("PENDING");
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await call<Row[]>("GET", `/admin/recommendations?status=${status}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    }
  }, [status, onAuthError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };

  return (
    <section>
      {dialog}
      <div className="admin-bar">
        <h2>Recommendations</h2>
        <div className="admin-filter">
          {["PENDING", "APPROVED", "REJECTED"].map((s) => (
            <button key={s} type="button" className={s === status ? "on" : "ghost"} onClick={() => setStatus(s)}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {message && <p className="admin-error" role="alert">{message}</p>}
      <ul className="admin-list">
        {rows.length === 0 && <li className="empty">No {status.toLowerCase()} recommendations.</li>}
        {rows.map((r) => (
          <li key={r.id} className="rec">
            <div>
              <strong>{String(r.title)}</strong> <em>({String(r.kind).toLowerCase()})</em>
              <p>{String(r.reason)}</p>
              <small>
                from {String(r.name)}
                {r.link ? (
                  <>
                    {" · "}
                    <a href={String(r.link)} target="_blank" rel="noreferrer noopener">{String(r.link)}</a>
                  </>
                ) : null}
              </small>
            </div>
            <div>
              {status !== "APPROVED" && (
                <button type="button" onClick={() => act(() => call("PATCH", `/admin/recommendations/${r.id}`, { status: "APPROVED" }))}>
                  Approve
                </button>
              )}
              {status !== "REJECTED" && (
                <button type="button" className="ghost" onClick={() => act(() => call("PATCH", `/admin/recommendations/${r.id}`, { status: "REJECTED" }))}>
                  Reject
                </button>
              )}
              <button
                type="button"
                className="ghost danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this recommendation?",
                    message: `"${String(r.title)}" from ${String(r.name)} will be deleted for good.`,
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  if (ok) await act(() => call("DELETE", `/admin/recommendations/${r.id}`));
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Site settings ---------- */

function Settings({ onAuthError }: { onAuthError: () => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setSettings(await call<Record<string, string>>("GET", "/settings"));
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = async (key: string, value: string) => {
    try {
      await call("PUT", `/admin/settings/${key}`, { value });
      setMessage(`Saved ${key}.`);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    }
  };

  const keys = Object.keys(settings);

  return (
    <section>
      <div className="admin-bar"><h2>Site settings</h2></div>
      {message && <p className="admin-note" role="status">{message}</p>}
      <div className="admin-form">
        {keys.map((key) => (
          <label key={key}>
            <span>{key}</span>
            <input
              type="text"
              value={settings[key] ?? ""}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              onBlur={(e) => save(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          <span>Add a setting (key: a-z, 0-9, _ . -)</span>
          <input
            type="text"
            value={newKey}
            placeholder="new_key"
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newKey.trim()) {
                e.preventDefault();
                save(newKey.trim(), "");
                setNewKey("");
              }
            }}
          />
        </label>
        <p className="admin-hint">Changes save when you leave a field.</p>
      </div>
    </section>
  );
}

/* ---------- Shell ---------- */

function AdminApp() {
  // Unknown until the server says whether the cookie is still good.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("movies");

  useEffect(() => {
    document.title = "Admin";
  }, []);

  const signOut = useCallback(() => {
    void signOutRequest();
    setSignedIn(false);
  }, []);

  // An expired cookie shows up as a 401 from any call: go back to the login page.
  const expired = useCallback(() => setSignedIn(false), []);
  const markSignedIn = useCallback(() => setSignedIn(true), []);

  useEffect(() => {
    // Older versions kept a token here; nothing should be left behind in the browser.
    try {
      sessionStorage.removeItem("portfolio-admin-token");
    } catch {
      // Storage unavailable: nothing to clear.
    }
    getSession().then((session) => setSignedIn(Boolean(session?.authenticated)));
  }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <Login onDone={markSignedIn} />;

  return (
    <div className="admin">
      <header>
        <span className="admin-label">PORTFOLIO · ADMIN</span>
        <nav aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} type="button" className={t === tab ? "on" : "ghost"} onClick={() => setTab(t)}>
              {t === "recommendations" ? "Recommendations" : t === "settings" ? "Settings" : t === "playlists" ? "Playlists" : t === "quiz" ? "Guess the Song" : resources[t]!.label}
            </button>
          ))}
        </nav>
        <div>
          <a href="/">View site</a>
          <button type="button" className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main>
        {tab === "playlists" ? (
          <PlaylistManager onAuthError={expired} />
        ) : tab === "quiz" ? (
          <Suspense fallback={null}>
            <QuizManager onAuthError={expired} />
          </Suspense>
        ) : tab === "recommendations" ? (
          <Recommendations onAuthError={expired} />
        ) : tab === "settings" ? (
          <Settings onAuthError={expired} />
        ) : (
          <ResourceManager key={tab} name={tab} onAuthError={expired} />
        )}
      </main>
    </div>
  );
}

export default AdminApp;
