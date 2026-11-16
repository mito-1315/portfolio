import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Pause, Play } from "lucide-react";
import { noteToMidi } from "../../audio/musicTheory";
import type { QuizPlayer } from "../../quiz/engine";
import MiniKeyboard from "../../quiz/MiniKeyboard";
import { keyboardRange, secondsPerBeat, songSeconds, type QuizSong } from "../../quiz/types";
import { ApiError, call } from "../adminApi";
import { downloadText, formatSong, highlight, type SongReport } from "./quizApi";

export type Source = { kind: "saved"; rowId: number } | { kind: "draft" };

type Props = {
  collectionId: number;
  source: Source;
  initial: QuizSong;
  player: QuizPlayer;
  /** Start playing as soon as this opens. */
  autoPlay?: boolean;
  onSaved: () => void;
  onClose: () => void;
  onAuthError: () => void;
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/**
 * One song: its real saved JSON (viewable, editable, copyable, downloadable),
 * a check of every field, and a preview you can play before saving.
 */
function SongDetail({ collectionId, source, initial, player, autoPlay, onSaved, onClose, onAuthError }: Props) {
  const [text, setText] = useState(() => formatSong(initial));
  const [editing, setEditing] = useState(source.kind === "draft");
  const [report, setReport] = useState<SongReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [trimTo, setTrimTo] = useState("");

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<ReadonlySet<number>>(new Set());
  const [loop, setLoop] = useState(false);
  const activeRef = useRef(new Set<number>());

  const parsed = useMemo(() => {
    try {
      return { doc: JSON.parse(text) as QuizSong, error: "" };
    } catch (e) {
      return { doc: null, error: errorText(e) };
    }
  }, [text]);
  const doc = parsed.doc;

  // Check the song with the server a moment after the text stops changing.
  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => {
      call<SongReport>("POST", "/admin/quiz/validate-song", { song: doc })
        .then(setReport)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) onAuthError();
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [doc, onAuthError]);

  const stop = useCallback(() => player.stop(), [player]);

  const start = useCallback(
    async (song: QuizSong) => {
      activeRef.current = new Set();
      setActive(new Set());
      setProgress(0);
      setPlaying(true);
      try {
        await player.play(song, {
          loop,
          onProgress: setProgress,
          onNoteOn: (midi) => {
            activeRef.current = new Set(activeRef.current).add(midi);
            setActive(activeRef.current);
          },
          onNoteOff: (midi) => {
            const next = new Set(activeRef.current);
            next.delete(midi);
            activeRef.current = next;
            setActive(next);
          },
          onEnd: () => {
            setPlaying(false);
            activeRef.current = new Set();
            setActive(new Set());
          },
        });
      } catch {
        setPlaying(false);
        setNote("The piano sounds couldn't be loaded.");
      }
    },
    [player, loop]
  );

  // Open straight into playback when asked, and stop when this closes.
  const started = useRef(false);
  useEffect(() => {
    if (autoPlay && !started.current && doc) {
      started.current = true;
      void start(doc);
    }
  }, [autoPlay, doc, start]);
  useEffect(() => () => player.stop(), [player]);

  const update = (change: (copy: QuizSong) => void) => {
    if (!doc) return;
    const copy = structuredClone(doc);
    change(copy);
    setText(formatSong(copy));
  };

  const save = async () => {
    if (!doc) return;
    setBusy(true);
    setNote("");
    try {
      if (source.kind === "saved") await call("PUT", `/admin/quiz/songs/${source.rowId}`, { song: doc });
      else await call("POST", `/admin/quiz/collections/${collectionId}/songs`, { song: doc });
      setNote("Saved.");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied the JSON.");
    } catch {
      setNote("Couldn't copy. Select the text and copy it by hand.");
    }
  };

  const format = () => {
    if (doc) setText(formatSong(doc));
  };

  const minutes = doc ? songSeconds(doc) : 0;
  const range = doc ? keyboardRange(doc) : { low: 60, high: 83 };
  const sounding = doc ? doc.notes.filter((n) => n.pitch !== "REST" && noteToMidi(n.pitch) !== null).length : 0;

  return (
    <div className="qz-detail">
      <div className="qz-detail-head">
        <div>
          <strong>{doc?.title || "Song"}</strong>
          <span>
            {source.kind === "draft" ? "New song, not saved yet" : "Saved song"}
            {doc ? ` · ${sounding} notes · ${doc.music.tempo} BPM · ${doc.music.timeSignature.numerator}/${doc.music.timeSignature.denominator} · ${minutes.toFixed(1)}s` : ""}
          </span>
        </div>
        <button type="button" className="ghost" onClick={onClose}>Close</button>
      </div>

      {/* Preview: plays the song as it is right now, including unsaved edits. */}
      <div className="qz-preview">
        <button
          type="button"
          className="qz-play"
          disabled={!doc || !report?.ok}
          title={report && !report.ok ? "Fix the problems below to preview" : "Preview the melody"}
          onClick={() => (playing ? stop() : doc && void start(doc))}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? "Stop" : "Preview"}
        </button>
        <div className="qz-bar" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></div>
        <label className="qz-loop">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
        </label>
      </div>
      <MiniKeyboard low={range.low} high={range.high} active={active} />

      {/* Quick fixes without touching the JSON by hand. */}
      {doc && (
        <div className="qz-fields">
          <label><span>Title</span><input type="text" value={doc.title} onChange={(e) => update((d) => { d.title = e.target.value; })} /></label>
          <label><span>Movie</span><input type="text" value={doc.movie} onChange={(e) => update((d) => { d.movie = e.target.value; })} /></label>
          <label>
            <span>Difficulty</span>
            <select value={doc.difficulty} onChange={(e) => update((d) => { d.difficulty = e.target.value as QuizSong["difficulty"]; })}>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </label>
          <label><span>Tempo (BPM)</span><input type="number" min={20} max={400} value={doc.music.tempo} onChange={(e) => update((d) => { d.music.tempo = Number(e.target.value); })} /></label>
          <label>
            <span>Time signature</span>
            <span className="qz-ts">
              <input type="number" min={1} max={32} value={doc.music.timeSignature.numerator} onChange={(e) => update((d) => { d.music.timeSignature.numerator = Number(e.target.value); })} />
              <b>/</b>
              <select value={doc.music.timeSignature.denominator} onChange={(e) => update((d) => { d.music.timeSignature.denominator = Number(e.target.value); })}>
                {[1, 2, 4, 8, 16, 32].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </span>
          </label>
          <label><span>Key</span><input type="text" value={doc.music.key ?? ""} placeholder="C Major" onChange={(e) => update((d) => { d.music.key = e.target.value; })} /></label>
          <label><span>Hint</span><input type="text" value={doc.quiz.hint} onChange={(e) => update((d) => { d.quiz.hint = e.target.value; })} /></label>
          <label><span>Replays allowed</span><input type="number" min={0} max={20} value={doc.quiz.maxReplays} onChange={(e) => update((d) => { d.quiz.maxReplays = Number(e.target.value); })} /></label>
          <label className="check"><input type="checkbox" checked={doc.quiz.enabled} onChange={(e) => update((d) => { d.quiz.enabled = e.target.checked; })} /><span>Enabled (shown to visitors)</span></label>
        </div>
      )}

      {/* Notes found online come with every note the same length: these reshape them. */}
      {doc && (
        <div className="qz-tools">
          <span>Notes</span>
          <button type="button" className="ghost" onClick={() => update((d) => { d.notes = d.notes.map((n) => ({ ...n, startBeat: n.startBeat * 0.5, durationBeats: n.durationBeats * 0.5 })); })}>Twice as fast</button>
          <button type="button" className="ghost" onClick={() => update((d) => { d.notes = d.notes.map((n) => ({ ...n, startBeat: n.startBeat * 2, durationBeats: n.durationBeats * 2 })); })}>Half as fast</button>
          <label className="qz-trim">
            Keep only the first
            <input type="number" min={1} value={trimTo} placeholder={String(doc.notes.length)} onChange={(e) => setTrimTo(e.target.value)} />
            notes
          </label>
          <button
            type="button"
            className="ghost"
            disabled={!trimTo || Number(trimTo) < 1 || Number(trimTo) >= doc.notes.length}
            onClick={() => {
              update((d) => { d.notes = d.notes.slice(0, Number(trimTo)).map((n, i) => ({ ...n, id: i + 1 })); });
              setTrimTo("");
            }}
          >
            Trim
          </button>
          {doc.music.timeSignature.denominator && <small>One beat lasts {secondsPerBeat(doc.music).toFixed(2)}s.</small>}
        </div>
      )}

      {/* The check. Errors block saving; warnings are only worth a look. */}
      <div className="qz-report" role="status">
        {parsed.error && <p className="admin-error">This is not valid JSON yet: {parsed.error}</p>}
        {!parsed.error && report?.ok && report.warnings.length === 0 && <p className="qz-good">✓ Valid. Nothing unusual found.</p>}
        {!parsed.error && report?.ok && report.warnings.length > 0 && <p className="qz-good">✓ Valid, with {report.warnings.length} thing{report.warnings.length === 1 ? "" : "s"} worth a look.</p>}
        {!parsed.error && report && !report.ok && <p className="admin-error">{report.errors.length} problem{report.errors.length === 1 ? "" : "s"} to fix before this can be saved.</p>}
        {report && report.errors.length > 0 && (
          <ul className="qz-issues bad">{report.errors.slice(0, 12).map((e, i) => <li key={i}><code>{e.path.replace(/^songs[0]./, "")}</code> {e.message}</li>)}</ul>
        )}
        {report && report.warnings.length > 0 && (
          <ul className="qz-issues">{report.warnings.slice(0, 8).map((w, i) => <li key={i}><code>{w.path.replace(/^songs[0]./, "")}</code> {w.message}</li>)}</ul>
        )}
      </div>

      <div className="qz-json-bar">
        <span>JSON</span>
        <button type="button" className="ghost" onClick={copy}><Copy size={14} /> Copy</button>
        <button type="button" className="ghost" onClick={() => downloadText(`${doc?.id ?? "song"}.json`, text)}><Download size={14} /> Download</button>
        <button type="button" className="ghost" onClick={format} disabled={!doc}>Format</button>
        <button
          type="button"
          className="ghost"
          onClick={() => doc && call<SongReport>("POST", "/admin/quiz/validate-song", { song: doc }).then((r) => { setReport(r); setNote(r.ok ? "Valid." : "Problems found."); })}
          disabled={!doc}
        >
          Validate
        </button>
        <button type="button" className={editing ? "on" : "ghost"} onClick={() => setEditing((v) => !v)}>{editing ? "Done editing" : "Edit JSON"}</button>
      </div>

      {editing ? (
        <textarea className="qz-json-edit" value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} aria-label="Song JSON" />
      ) : (
        <pre className="qz-json" tabIndex={0} aria-label="Song JSON"><code>{highlight(text)}</code></pre>
      )}

      <div className="admin-actions">
        <button type="button" disabled={busy || !doc || !report?.ok} onClick={save}>
          {busy ? "Saving…" : source.kind === "draft" ? "Add to collection" : "Save changes"}
        </button>
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        {note && <span className="admin-hint">{note}</span>}
      </div>
    </div>
  );
}

export default SongDetail;
