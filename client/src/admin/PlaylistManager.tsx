import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, call, uploadFile } from "./adminApi";
import { useConfirm } from "./ConfirmDialog";

type TrackRow = {
  id: number;
  title: string;
  artist: string;
  mood: string;
  coverUrl: string | null;
  published: boolean;
};
type PlaylistRow = {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
  published: boolean;
  sortOrder: number;
  trackIds: number[];
};

const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Crops an image to a centred square (at most 800px) so every poster is the same shape. */
async function toSquare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, 800);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't crop images");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Couldn't prepare that image");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "poster"}.jpg`, { type: "image/jpeg" });
}

/** A song's artwork as a square tile, or a note when it has none. */
function Art({ url, className = "" }: { url: string | null | undefined; className?: string }) {
  return (
    <span className={`admin-art ${className}`} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" draggable={false} /> : <i>♪</i>}
    </span>
  );
}

/** The playlist's square poster: upload one (cropped to a square for you) or take it from a song. */
function PosterPicker({
  value,
  onChange,
  onAuthError,
}: {
  value: string;
  onChange: (url: string) => void;
  onAuthError: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadFile(await toSquare(file), "image");
      onChange(result.url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-poster">
      <span className="admin-poster-title">Playlist poster</span>
      <div className="admin-poster-body">
        <Art url={value} className="admin-poster-preview" />
        <div className="admin-poster-controls">
          <label
            className={`admin-drop ${over ? "over" : ""} ${busy ? "busy" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (!busy) void take(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                void take(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <strong>{busy ? "Uploading…" : over ? "Drop it here" : "Drop an image here"}</strong>
            <span>or click to choose. It is cropped to a square.</span>
          </label>
          <p className="admin-hint">Or press <b>Use as poster</b> on any song in the playlist.</p>
          {value && (
            <button type="button" className="ghost" onClick={() => onChange("")}>Remove poster</button>
          )}
          {error && <p className="admin-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * The owner's playlists: a name, a square poster, the songs in it in order,
 * and whether visitors may see it in the secret window or only the owner.
 */
function PlaylistManager({ onAuthError }: { onAuthError: () => void }) {
  const [lists, setLists] = useState<PlaylistRow[]>([]);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [editing, setEditing] = useState<PlaylistRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("");
  const [published, setPublished] = useState(false);
  const [chosen, setChosen] = useState<number[]>([]);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");
  const { confirm, dialog } = useConfirm();

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setNote(message(e));
    },
    [onAuthError]
  );

  const load = useCallback(async () => {
    try {
      const [playlists, allTracks] = await Promise.all([
        call<PlaylistRow[]>("GET", "/admin/playlists"),
        call<TrackRow[]>("GET", "/admin/tracks"),
      ]);
      setLists(playlists);
      setTracks(allTracks);
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const open = (row: PlaylistRow | "new") => {
    setEditing(row);
    setName(row === "new" ? "" : row.name);
    setDescription(row === "new" ? "" : row.description ?? "");
    setCover(row === "new" ? "" : row.coverUrl ?? "");
    setPublished(row === "new" ? false : row.published);
    setChosen(row === "new" ? [] : row.trackIds);
    setFilter("");
    setNote("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = { name, description: description.trim() || null, coverUrl: cover || null, published };
      const saved =
        editing === "new"
          ? await call<PlaylistRow>("POST", "/admin/playlists", body)
          : await call<PlaylistRow>("PUT", `/admin/playlists/${(editing as PlaylistRow).id}`, body);
      await call("PUT", `/admin/playlists/${saved.id}/tracks`, { trackIds: chosen });
      setEditing(null);
      setNote("Saved.");
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (row: PlaylistRow) => {
    const ok = await confirm({
      title: "Delete this playlist?",
      message: `"${row.name}" will be deleted. The songs in it stay in your library.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await call("DELETE", `/admin/playlists/${row.id}`);
      setNote("Deleted.");
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= chosen.length) return;
    const next = [...chosen];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setChosen(next);
  };

  const add = (id: number) => {
    setChosen((current) => (current.includes(id) ? current : [...current, id]));
    // The first song's artwork is a good poster until another is chosen.
    const art = byId.get(id)?.coverUrl;
    if (art && !cover && chosen.length === 0) setCover(art);
  };

  const available = tracks.filter(
    (t) =>
      !chosen.includes(t.id) &&
      `${t.title} ${t.artist}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <section>
      {dialog}
      <div className="admin-bar">
        <h2>Playlists</h2>
        <button type="button" onClick={() => open("new")}>+ Add</button>
      </div>
      {note && <p className="admin-note" role="status">{note}</p>}

      {editing && (
        <form className="admin-form admin-playlist-form" onSubmit={save}>
          <div className="admin-playlist-top">
            <PosterPicker value={cover} onChange={setCover} onAuthError={onAuthError} />
            <div className="admin-playlist-fields">
              <label>
                <span>Playlist name</span>
                <input type="text" value={name} required maxLength={120} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                <span>Description (optional)</span>
                <input type="text" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="check">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                <span>Visible to visitors in the secret window (off = only you, when signed in)</span>
              </label>
            </div>
          </div>

          <div className="admin-picker">
            <div>
              <span className="admin-picker-title">In this playlist ({chosen.length})</span>
              <ol className="admin-chosen">
                {chosen.length === 0 && <li className="empty">No songs yet. Hover a song on the right and press Add.</li>}
                {chosen.map((id, index) => {
                  const t = byId.get(id);
                  return (
                    <li key={id}>
                      <Art url={t?.coverUrl} />
                      <span className="admin-chosen-text">
                        <b>{t ? t.title : `Song ${id}`}</b>
                        <em>{t ? t.artist : ""}{t && !t.published ? " · inactive" : ""}</em>
                      </span>
                      <div className="admin-chosen-actions">
                        {t?.coverUrl && (
                          <button
                            type="button"
                            className={t.coverUrl === cover ? "on" : "ghost"}
                            onClick={() => setCover(t.coverUrl!)}
                            title="Use this song's artwork as the playlist poster"
                          >
                            {t.coverUrl === cover ? "Poster ✓" : "Use as poster"}
                          </button>
                        )}
                        <button type="button" className="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                        <button type="button" className="ghost" aria-label="Move down" disabled={index === chosen.length - 1} onClick={() => move(index, 1)}>↓</button>
                        <button type="button" className="ghost danger" aria-label="Remove from playlist" onClick={() => setChosen(chosen.filter((c) => c !== id))}>✕</button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div>
              <span className="admin-picker-title">Add songs</span>
              <input
                type="search"
                value={filter}
                placeholder="Search your songs"
                onChange={(e) => setFilter(e.target.value)}
              />
              {available.length === 0 && (
                <p className="admin-hint">{tracks.length === 0 ? "Upload songs first." : "Nothing else to add."}</p>
              )}
              <ul className="admin-songgrid">
                {available.map((t) => (
                  <li key={t.id}>
                    <div className="admin-song-art">
                      <Art url={t.coverUrl} />
                      <button type="button" className="admin-song-add" aria-label={`Add ${t.title}`} onClick={() => add(t.id)}>
                        <span>＋ Add</span>
                      </button>
                    </div>
                    <b>{t.title}</b>
                    <em>{t.artist}</em>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="admin-actions">
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="admin-list">
        {lists.length === 0 && <li className="empty">No playlists yet.</li>}
        {lists.map((row) => (
          <li key={row.id}>
            <span className="admin-list-main">
              <Art url={row.coverUrl} className="admin-thumb" />
              <span>
                {row.name}  ·  {row.trackIds.length} song{row.trackIds.length === 1 ? "" : "s"}  ·  {row.published ? "visible to visitors" : "private"}
              </span>
            </span>
            <div>
              <button type="button" className="ghost" onClick={() => open(row)}>Edit</button>
              <button type="button" className="ghost danger" onClick={() => remove(row)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PlaylistManager;
