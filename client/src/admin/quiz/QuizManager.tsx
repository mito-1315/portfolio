import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileJson, Plus, Search, Trash2, Upload } from "lucide-react";
import { createQuizPlayer } from "../../quiz/engine";
import type { QuizSong } from "../../quiz/types";
import { ApiError, call } from "../adminApi";
import { useConfirm } from "../ConfirmDialog";
import FinderPanel from "./FinderPanel";
import ImportPanel from "./ImportPanel";
import SongDetail, { type Source } from "./SongDetail";
import { draftFrom, downloadText, fmtDate, type Collection, type SongRow } from "./quizApi";
import "./Quiz.css";

type Panel = "import" | "finder" | "new-collection" | "edit-collection" | null;
type Open = { key: number; source: Source; initial: QuizSong; autoPlay: boolean };

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** The Guess the Song area of the admin: collections, their songs, importing, finding notes, and previewing. */
function QuizManager({ onAuthError }: { onAuthError: () => void }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({ name: "", description: "", enabled: true });
  const { confirm, dialog } = useConfirm();

  // One piano for the whole admin area, freed when it closes.
  const player = useMemo(() => createQuizPlayer(), []);
  useEffect(() => () => player.dispose(), [player]);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setNote(errorText(e));
    },
    [onAuthError]
  );

  const loadCollections = useCallback(
    async (keep?: number) => {
      try {
        const list = await call<Collection[]>("GET", "/admin/quiz/collections");
        setCollections(list);
        setSelectedId((current) => {
          const wanted = keep ?? current;
          return list.some((c) => c.id === wanted) ? wanted : list[0]?.id ?? null;
        });
      } catch (e) {
        fail(e);
      }
    },
    [fail]
  );

  const loadSongs = useCallback(
    async (id: number | null) => {
      if (id === null) return setSongs([]);
      try {
        setSongs(await call<SongRow[]>("GET", `/admin/quiz/collections/${id}/songs`));
      } catch (e) {
        fail(e);
      }
    },
    [fail]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSongs(selectedId);
  }, [selectedId, loadSongs]);

  const collection = collections.find((c) => c.id === selectedId) ?? null;
  const refresh = useCallback(async () => {
    await Promise.all([loadCollections(selectedId ?? undefined), loadSongs(selectedId)]);
  }, [loadCollections, loadSongs, selectedId]);

  /* ----- collection actions ----- */

  const startCollection = (mode: "new-collection" | "edit-collection") => {
    setPanel(mode);
    setForm(mode === "edit-collection" && collection ? { name: collection.name, description: collection.description, enabled: collection.enabled } : { name: "", description: "", enabled: true });
  };

  const saveCollection = async () => {
    try {
      if (panel === "edit-collection" && collection) {
        await call("PUT", `/admin/quiz/collections/${collection.id}`, form);
        await loadCollections(collection.id);
      } else {
        const created = await call<Collection>("POST", "/admin/quiz/collections", form);
        await loadCollections(created.id);
      }
      setPanel(null);
      setNote("Saved.");
    } catch (e) {
      fail(e);
    }
  };

  const removeCollection = async () => {
    if (!collection) return;
    const ok = await confirm({
      title: "Delete this collection?",
      message: `"${collection.name}" and its ${collection.total} song${collection.total === 1 ? "" : "s"} will be deleted for good. Export it first if you may want it back.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await call("DELETE", `/admin/quiz/collections/${collection.id}`);
      setSelectedId(null);
      setOpen(null);
      await loadCollections();
    } catch (e) {
      fail(e);
    }
  };

  const exportCollection = async () => {
    if (!collection) return;
    try {
      const file = await call<unknown>("GET", `/admin/quiz/collections/${collection.id}/export`);
      downloadText(`${collection.key}.json`, JSON.stringify(file, null, 2));
    } catch (e) {
      fail(e);
    }
  };

  const downloadTemplate = async () => {
    try {
      downloadText("guess-the-song-template.json", JSON.stringify(await call<unknown>("GET", "/admin/quiz/template"), null, 2));
    } catch (e) {
      fail(e);
    }
  };

  /* ----- song actions ----- */

  const openSong = async (row: SongRow, autoPlay: boolean) => {
    try {
      const full = await call<SongRow & { data: QuizSong }>("GET", `/admin/quiz/songs/${row.id}`);
      setOpen({ key: Date.now(), source: { kind: "saved", rowId: row.id }, initial: full.data, autoPlay });
    } catch (e) {
      fail(e);
    }
  };

  const addSong = () => {
    setPanel(null);
    // The notes here are the structure's example only. The title is left empty and the song disabled,
    // so it cannot be saved or shown until it has been filled in properly.
    const starter = draftFrom("", "", [
      { id: 1, pitch: "C4", startBeat: 0, durationBeats: 1, velocity: 0.8 },
      { id: 2, pitch: "G4", startBeat: 1, durationBeats: 2, velocity: 0.9 },
      { id: 3, pitch: "REST", startBeat: 3, durationBeats: 1, velocity: 0 },
    ], songs.map((s) => s.songId));
    setOpen({ key: Date.now(), source: { kind: "draft" }, initial: { ...starter, id: starter.id === "song" ? "song_001" : starter.id }, autoPlay: false });
  };

  const toggleEnabled = async (row: SongRow) => {
    try {
      await call("PATCH", `/admin/quiz/songs/${row.id}`, { enabled: !row.enabled });
      await refresh();
    } catch (e) {
      fail(e);
    }
  };

  const removeSong = async (row: SongRow) => {
    const ok = await confirm({
      title: "Delete this song?",
      message: `"${row.title}" will be deleted for good. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await call("DELETE", `/admin/quiz/songs/${row.id}`);
      if (open?.source.kind === "saved" && open.source.rowId === row.id) setOpen(null);
      await refresh();
    } catch (e) {
      fail(e);
    }
  };

  const existingIds = songs.map((s) => s.songId);

  return (
    <section className="qz">
      {dialog}
      <div className="admin-bar">
        <h2>Guess the Song</h2>
        <div className="admin-bar-buttons">
          <button type="button" className="ghost" onClick={() => startCollection("new-collection")}><Plus size={14} /> New collection</button>
        </div>
      </div>
      {note && <p className="admin-note" role="status">{note}</p>}

      {collections.length === 0 && <p className="admin-hint">No collections yet. Create one to start adding songs.</p>}

      {collection && (
        <>
          <div className="qz-collection">
            <div className="qz-collection-top">
              <label>
                <span>Collection</span>
                <select value={collection.id} onChange={(e) => { setSelectedId(Number(e.target.value)); setOpen(null); setPanel(null); }}>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="qz-collection-actions">
                <button type="button" className="ghost" onClick={() => startCollection("edit-collection")}>Edit details</button>
                <button type="button" className="ghost danger" onClick={removeCollection}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
            <p className="qz-desc">{collection.description || "No description."}{!collection.enabled && "  (disabled: visitors do not see these songs)"}</p>
            <dl className="qz-stats">
              <div><dt>Songs</dt><dd>{collection.total}</dd></div>
              <div><dt>Enabled</dt><dd>{collection.enabledCount}</dd></div>
              <div><dt>Easy</dt><dd>{collection.easy}</dd></div>
              <div><dt>Medium</dt><dd>{collection.medium}</dd></div>
              <div><dt>Hard</dt><dd>{collection.hard}</dd></div>
              <div className="wide"><dt>Last updated</dt><dd>{fmtDate(collection.lastSongUpdate ?? collection.updatedAt)}</dd></div>
            </dl>
          </div>

          <div className="qz-toolbar">
            <button type="button" className={panel === "import" ? "on" : "ghost"} onClick={() => setPanel(panel === "import" ? null : "import")}><Upload size={14} /> Import JSON</button>
            <button type="button" className="ghost" onClick={exportCollection}><Download size={14} /> Export JSON</button>
            <button type="button" className="ghost" onClick={downloadTemplate}><FileJson size={14} /> Blank template</button>
            <button type="button" className={panel === "finder" ? "on" : "ghost"} onClick={() => setPanel(panel === "finder" ? null : "finder")}><Search size={14} /> Find notes online</button>
            <button type="button" onClick={addSong}><Plus size={14} /> Add song</button>
          </div>
        </>
      )}

      {(panel === "new-collection" || panel === "edit-collection") && (
        <div className="qz-panel">
          <h3>{panel === "new-collection" ? "New collection" : "Edit collection"}</h3>
          <div className="admin-form">
            <label><span>Name</span><input type="text" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label><span>Description</span><input type="text" value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /><span>Enabled (its songs are offered to visitors)</span></label>
          </div>
          <div className="admin-actions">
            <button type="button" disabled={!form.name.trim()} onClick={saveCollection}>Save</button>
            <button type="button" className="ghost" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}

      {panel === "import" && (
        <ImportPanel
          collections={collections}
          selectedId={selectedId}
          onAuthError={onAuthError}
          onDone={(id) => { void loadCollections(id); void loadSongs(id); setSelectedId(id); }}
        />
      )}

      {panel === "finder" && (
        <FinderPanel
          existingIds={existingIds}
          player={player}
          onAuthError={onAuthError}
          onUse={(draft) => { setOpen({ key: Date.now(), source: { kind: "draft" }, initial: draft, autoPlay: false }); setPanel(null); }}
        />
      )}

      {open && collection && (
        <SongDetail
          key={open.key}
          collectionId={collection.id}
          source={open.source}
          initial={open.initial}
          player={player}
          autoPlay={open.autoPlay}
          onAuthError={onAuthError}
          onClose={() => setOpen(null)}
          onSaved={() => { void refresh(); if (open.source.kind === "draft") setOpen(null); }}
        />
      )}

      {collection && (
        <div className="qz-table-wrap">
          <table className="qz-table songs">
            <thead>
              <tr><th>Song</th><th>Movie</th><th>Level</th><th>BPM</th><th>Time</th><th>Key</th><th>Notes</th><th>On</th><th /></tr>
            </thead>
            <tbody>
              {songs.length === 0 && <tr><td colSpan={9} className="empty">No songs in this collection yet. Import a file, find notes online, or add one.</td></tr>}
              {songs.map((s) => (
                <tr key={s.id} className={s.enabled ? "" : "off"}>
                  <td><strong>{s.title}</strong><small>{s.songId}</small></td>
                  <td>{s.movie || "–"}</td>
                  <td><span className={`qz-level ${s.difficulty}`}>{s.difficulty}</span></td>
                  <td>{s.tempo}</td>
                  <td>{s.timeSignature}</td>
                  <td>{s.key || "–"}</td>
                  <td>{s.noteCount}</td>
                  <td>
                    <label className="qz-switch" title={s.enabled ? "Shown to visitors" : "Hidden from visitors"}>
                      <input type="checkbox" checked={s.enabled} onChange={() => toggleEnabled(s)} aria-label={`${s.title} enabled`} />
                      <i />
                    </label>
                  </td>
                  <td className="qz-row-actions">
                    <button type="button" className="ghost" onClick={() => openSong(s, true)}>Preview</button>
                    <button type="button" className="ghost" onClick={() => openSong(s, false)}>JSON</button>
                    <button type="button" className="ghost danger" aria-label={`Delete ${s.title}`} onClick={() => removeSong(s)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default QuizManager;
