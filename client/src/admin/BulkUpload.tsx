import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, call, uploadFile, type FileTags, type SpotifyMatch } from "./adminApi";

const MOODS = ["Calm", "Focused", "Energetic", "Nostalgic", "Curious"];

type RowState = "uploading" | "ready" | "saving" | "saved" | "failed";

type Row = {
  key: number;
  fileName: string;
  url: string;
  state: RowState;
  error: string;
  title: string;
  artist: string;
  album: string;
  releaseDate: string;
  durationMs: number | null;
  spotifyId: string;
  spotifyUrl: string;
  coverUrl: string;
  mood: string;
  matches: SpotifyMatch[];
  searching: boolean;
  showMatches: boolean;
};

type PlaylistOption = { id: number; name: string; trackIds: number[] };

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** "Artist - Title" file names are common; otherwise the whole name is the title. */
function guessFromName(fileName: string): { title: string; artist: string } {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const split = stem.split(/\s+-\s+/);
  if (split.length >= 2) return { artist: split[0]!.trim(), title: split.slice(1).join(" - ").trim() };
  return { artist: "", title: stem };
}

let nextKey = 1;

/**
 * Upload many songs in one go. Drop the files, let each one fill itself in from
 * its tags (and Spotify), pick its category, then save them all together.
 */
function BulkUpload({ onAuthError, onSaved }: { onAuthError: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [allMood, setAllMood] = useState("");
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [playlistId, setPlaylistId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    call<PlaylistOption[]>("GET", "/admin/playlists").then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  const patch = useCallback((key: number, changes: Partial<Row>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }, []);

  const authAware = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onAuthError();
    },
    [onAuthError]
  );

  /** Looks the song up on Spotify. Quiet when Spotify isn't set up, so a batch is not buried in errors. */
  const search = useCallback(
    async (key: number, query: string, loud: boolean) => {
      if (query.trim().length < 2) return;
      patch(key, { searching: true });
      try {
        const found = await call<SpotifyMatch[]>("GET", `/admin/spotify/search?q=${encodeURIComponent(query.trim())}`);
        patch(key, { matches: found, searching: false, showMatches: found.length > 0 && loud });
        if (loud && found.length === 0) setNote("Nothing found on Spotify for that song. Edit the title and artist, then search again.");
      } catch (e) {
        patch(key, { searching: false });
        authAware(e);
        if (loud) setNote(message(e));
      }
    },
    [patch, authAware]
  );

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name) || f.type.startsWith("audio/"));
    if (list.length === 0) {
      setNote("Those don't look like audio files (MP3, M4A, WAV, OGG or FLAC).");
      return;
    }
    setNote("");
    const created: Row[] = list.map((file) => {
      const guess = guessFromName(file.name);
      return {
        key: nextKey++,
        fileName: file.name,
        url: "",
        state: "uploading",
        error: "",
        title: guess.title,
        artist: guess.artist,
        album: "",
        releaseDate: "",
        durationMs: null,
        spotifyId: "",
        spotifyUrl: "",
        coverUrl: "",
        mood: allMood,
        matches: [],
        searching: false,
        showMatches: false,
      };
    });
    setRows((current) => [...current, ...created]);

    // One at a time, so a big batch does not swamp the server or the connection.
    for (const [i, file] of list.entries()) {
      const row = created[i]!;
      try {
        const result = await uploadFile(file, "audio");
        const tags: FileTags = result.tags ?? {};
        patch(row.key, {
          url: result.url,
          state: "ready",
          title: tags.title ?? row.title,
          artist: tags.artist ?? row.artist,
          album: tags.album ?? "",
          releaseDate: tags.year ? String(tags.year) : "",
          durationMs: tags.durationMs ?? null,
        });
        void search(row.key, `${tags.artist ?? row.artist} ${tags.title ?? row.title}`, false);
      } catch (e) {
        authAware(e);
        patch(row.key, { state: "failed", error: message(e) });
      }
    }
  };

  const applyMatch = (key: number, m: SpotifyMatch) =>
    patch(key, {
      title: m.title,
      artist: m.artist,
      album: m.album,
      releaseDate: m.releaseDate,
      durationMs: m.durationMs,
      spotifyId: m.spotifyId,
      spotifyUrl: m.spotifyUrl,
      coverUrl: m.artworkUrl ?? "",
      showMatches: false,
    });

  const useBestForAll = () => {
    setRows((current) =>
      current.map((r) => {
        const m = r.matches[0];
        if (!m || r.state === "saved") return r;
        return {
          ...r,
          title: m.title,
          artist: m.artist,
          album: m.album,
          releaseDate: m.releaseDate,
          durationMs: m.durationMs,
          spotifyId: m.spotifyId,
          spotifyUrl: m.spotifyUrl,
          coverUrl: m.artworkUrl ?? "",
        };
      })
    );
  };

  const setMoodForAll = (mood: string) => {
    setAllMood(mood);
    if (mood) setRows((current) => current.map((r) => (r.state === "saved" ? r : { ...r, mood })));
  };

  const pending = rows.filter((r) => r.state === "ready" || r.state === "failed");
  const readyToSave = rows.filter((r) => r.state === "ready" && r.url && r.title.trim() && r.artist.trim() && r.mood);
  const missing = rows.filter((r) => r.state === "ready").length - readyToSave.length;

  const saveAll = async () => {
    setSaving(true);
    setNote("");
    const savedIds: number[] = [];
    for (const row of readyToSave) {
      patch(row.key, { state: "saving", error: "" });
      try {
        const body = {
          title: row.title.trim(),
          artist: row.artist.trim(),
          audioUrl: row.url,
          mood: row.mood,
          album: row.album.trim() || null,
          releaseDate: row.releaseDate.trim() || null,
          durationMs: row.durationMs,
          spotifyId: row.spotifyId || null,
          spotifyUrl: row.spotifyUrl || null,
          coverUrl: row.coverUrl || null,
          published: true,
        };
        const created = await call<{ id: number }>("POST", "/admin/tracks", body);
        savedIds.push(created.id);
        patch(row.key, { state: "saved" });
      } catch (e) {
        authAware(e);
        patch(row.key, { state: "ready", error: message(e) });
      }
    }

    if (playlistId && savedIds.length > 0) {
      try {
        const list = playlists.find((p) => String(p.id) === playlistId);
        await call("PUT", `/admin/playlists/${playlistId}/tracks`, { trackIds: [...(list?.trackIds ?? []), ...savedIds] });
        setNote(`Saved ${savedIds.length} song${savedIds.length === 1 ? "" : "s"} and added them to "${list?.name ?? "the playlist"}".`);
      } catch (e) {
        authAware(e);
        setNote(`Saved ${savedIds.length}, but couldn't add them to the playlist: ${message(e)}`);
      }
    } else if (savedIds.length > 0) {
      setNote(`Saved ${savedIds.length} song${savedIds.length === 1 ? "" : "s"}.`);
    }
    setSaving(false);
    onSaved();
  };

  const clearDone = () => setRows((current) => current.filter((r) => r.state !== "saved"));

  return (
    <div className="admin-bulk">
      <label
        className={`admin-drop ${dragging ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
          multiple
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <strong>{dragging ? "Drop them here" : "Drop many songs here"}</strong>
        <span>or click to choose several files</span>
      </label>

      {rows.length > 0 && (
        <>
          <div className="admin-bulk-bar">
            <label>
              <span>Category for all</span>
              <select value={allMood} onChange={(e) => setMoodForAll(e.target.value)}>
                <option value="">Choose…</option>
                {MOODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Add them to a playlist</span>
              <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
                <option value="">No playlist</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="ghost" onClick={useBestForAll} disabled={!rows.some((r) => r.matches.length > 0)}>
              Use best Spotify match for all
            </button>
          </div>

          <ul className="admin-bulk-list">
            {rows.map((r) => (
              <li key={r.key} className={`state-${r.state}`}>
                <div className="admin-bulk-art">
                  {r.coverUrl ? <img src={r.coverUrl} alt="" loading="lazy" /> : <span aria-hidden="true">♪</span>}
                </div>
                <div className="admin-bulk-fields">
                  <small>
                    {r.fileName}
                    {r.state === "uploading" && "  ·  uploading…"}
                    {r.state === "saving" && "  ·  saving…"}
                    {r.state === "saved" && "  ·  saved ✓"}
                    {r.spotifyUrl && "  ·  matched on Spotify"}
                  </small>
                  {r.state !== "uploading" && (
                    <>
                      <div className="admin-bulk-grid">
                        <input
                          type="text"
                          value={r.title}
                          placeholder="Song title"
                          aria-label="Song title"
                          disabled={r.state === "saved" || r.state === "saving"}
                          onChange={(e) => patch(r.key, { title: e.target.value })}
                        />
                        <input
                          type="text"
                          value={r.artist}
                          placeholder="Artist"
                          aria-label="Artist"
                          disabled={r.state === "saved" || r.state === "saving"}
                          onChange={(e) => patch(r.key, { artist: e.target.value })}
                        />
                        <input
                          type="text"
                          value={r.album}
                          placeholder="Album"
                          aria-label="Album"
                          disabled={r.state === "saved" || r.state === "saving"}
                          onChange={(e) => patch(r.key, { album: e.target.value })}
                        />
                        <select
                          value={r.mood}
                          aria-label="Category"
                          disabled={r.state === "saved" || r.state === "saving"}
                          onChange={(e) => patch(r.key, { mood: e.target.value })}
                        >
                          <option value="">Category…</option>
                          {MOODS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      {r.state !== "saved" && (
                        <div className="admin-bulk-actions">
                          <button
                            type="button"
                            className="ghost"
                            disabled={r.searching}
                            onClick={() => {
                              if (r.matches.length > 0) patch(r.key, { showMatches: !r.showMatches });
                              else void search(r.key, `${r.artist} ${r.title}`, true);
                            }}
                          >
                            {r.searching
                              ? "Searching…"
                              : r.matches.length > 0
                              ? `${r.showMatches ? "Hide" : "Show"} Spotify matches (${r.matches.length})`
                              : "Find on Spotify"}
                          </button>
                          {r.matches.length > 0 && (
                            <button type="button" className="ghost" onClick={() => void search(r.key, `${r.artist} ${r.title}`, true)}>
                              Search again
                            </button>
                          )}
                          <button type="button" className="ghost danger" onClick={() => setRows((c) => c.filter((x) => x.key !== r.key))}>
                            Remove
                          </button>
                        </div>
                      )}
                      {r.showMatches && (
                        <ul className="admin-finder-results">
                          {r.matches.map((m) => (
                            <li key={m.spotifyId}>
                              {m.artworkUrl ? <img src={m.artworkUrl} alt="" loading="lazy" /> : <span className="noart">♪</span>}
                              <div>
                                <strong>{m.title}</strong>
                                <span>{m.artist}</span>
                                <small>{m.album}{m.releaseDate ? ` · ${m.releaseDate.slice(0, 4)}` : ""}</small>
                              </div>
                              <button type="button" onClick={() => applyMatch(r.key, m)}>Use this</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {r.error && <p className="admin-error" role="alert">{r.error}</p>}
                </div>
              </li>
            ))}
          </ul>

          <div className="admin-actions">
            <button type="button" disabled={saving || readyToSave.length === 0} onClick={saveAll}>
              {saving ? "Saving…" : `Save ${readyToSave.length} song${readyToSave.length === 1 ? "" : "s"}`}
            </button>
            {missing > 0 && <span className="admin-hint">{missing} still need a title, artist and category.</span>}
            {rows.some((r) => r.state === "saved") && (
              <button type="button" className="ghost" onClick={clearDone}>Clear saved</button>
            )}
            {pending.length === 0 && rows.every((r) => r.state === "saved") && (
              <span className="admin-hint">All done.</span>
            )}
          </div>
        </>
      )}
      {note && <p className="admin-note" role="status">{note}</p>}
    </div>
  );
}

export default BulkUpload;
