import { Fragment, useState } from "react";
import { ApiError, call } from "../adminApi";
import { beautify, type Collection, type FileReport, type SongReport } from "./quizApi";

type Duplicates = "skip" | "replace" | "new";
type ImportResult = {
  collectionId: number;
  summary: { validated: number; failedValidation: number; imported: number; replaced: number; skipped: number };
  results: { index: number; id: string; title: string; action: "imported" | "replaced" | "skipped" | "failed"; newId?: string; reason?: string }[];
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/**
 * Bring songs in from a file in the quiz format: drop it, browse for it, or
 * paste it. Every song is checked on its own, so one bad song never stops the
 * good ones, and nothing existing is overwritten without being asked.
 */
function ImportPanel({
  collections,
  selectedId,
  onDone,
  onAuthError,
}: {
  collections: Collection[];
  selectedId: number | null;
  onDone: (collectionId: number) => void;
  onAuthError: () => void;
}) {
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [target, setTarget] = useState<"file" | number>(selectedId ?? "file");
  const [duplicates, setDuplicates] = useState<Duplicates>("skip");
  const [report, setReport] = useState<FileReport | null>(null);
  const [parseError, setParseError] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [note, setNote] = useState("");

  const check = async (source: string, into: "file" | number = target) => {
    setResult(null);
    setNote("");
    setReport(null);
    let json: unknown;
    try {
      json = JSON.parse(source);
      setParseError("");
    } catch (e) {
      setParseError(errorText(e));
      return;
    }
    setBusy(true);
    try {
      const r = await call<FileReport>("POST", "/admin/quiz/validate", { json, ...(typeof into === "number" ? { collectionId: into } : {}) });
      setReport(r);
      setPicked(new Set(r.songs.filter((s) => s.ok).map((s) => s.id)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    void check(content);
  };

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async () => {
    setBusy(true);
    setNote("");
    try {
      const r = await call<ImportResult>("POST", "/admin/quiz/import", { json: JSON.parse(text), target, duplicates, songIds: [...picked] });
      setResult(r);
      onDone(r.collectionId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const ready = report ? report.songs.filter((s) => s.ok && picked.has(s.id)).length : 0;
  const failed = report ? report.songs.filter((s) => !s.ok).length : 0;
  const status = (s: SongReport) => (s.ok ? (s.exists ? "already in the collection" : s.warnings.length ? `ok, ${s.warnings.length} to review` : "ok") : "failed");

  return (
    <div className="qz-panel">
      <h3>Import JSON</h3>
      <p className="admin-hint">One file can hold many songs. Drop it, choose it, or paste it below. Nothing is saved until you press Import.</p>

      <label
        className={`admin-drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void readFile(e.dataTransfer.files[0]); }}
      >
        <input type="file" accept=".json,application/json" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
        <strong>{over ? "Drop the file here" : "Drop a .json file here"}</strong>
        <span>or click to browse</span>
      </label>

      <label className="qz-paste">
        <span>Or paste JSON</span>
        <textarea value={text} rows={7} spellCheck={false} placeholder='{ "formatVersion": "1.0", "collection": { ... } }' onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="admin-actions">
        <button type="button" disabled={!text.trim() || busy} onClick={() => check(text)}>{busy ? "Checking…" : "Check the JSON"}</button>
        <button
          type="button"
          className="ghost"
          disabled={!text.trim()}
          onClick={() => { try { setText(beautify(text)); setParseError(""); } catch (e) { setParseError(errorText(e)); } }}
        >
          Format
        </button>
        {text && <button type="button" className="ghost" onClick={() => { setText(""); setReport(null); setResult(null); setParseError(""); }}>Clear</button>}
      </div>

      {parseError && <p className="admin-error" role="alert">That is not valid JSON: {parseError}</p>}
      {note && <p className="admin-error" role="alert">{note}</p>}

      {report && (
        <>
          {report.fileErrors.length > 0 && (
            <ul className="qz-issues bad">{report.fileErrors.map((e, i) => <li key={i}><code>{e.path || "file"}</code> {e.message}</li>)}</ul>
          )}

          {report.collection && (
            <div className="qz-file-head">
              <strong>{report.collection.name || "(unnamed collection)"}</strong>
              <span>{report.collection.description}</span>
              <span>{report.songs.length} song{report.songs.length === 1 ? "" : "s"} found</span>
            </div>
          )}

          <div className="qz-chips">
            <b>{report.songs.filter((s) => s.ok).length} validated</b>
            <b>{ready} ready to import</b>
            <b className={failed ? "bad" : ""}>{failed} failed validation</b>
          </div>

          {report.songs.length > 0 && (
            <div className="qz-table-wrap">
              <table className="qz-table">
                <thead>
                  <tr><th /><th>Title</th><th>Movie</th><th>Level</th><th>BPM</th><th>Time</th><th>Key</th><th>Notes</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {report.songs.map((s) => (
                    <Fragment key={s.index}>
                      <tr className={s.ok ? "" : "bad"} onClick={() => setOpen(open === s.index ? null : s.index)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" disabled={!s.ok} checked={picked.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Import ${s.title || s.id}`} />
                        </td>
                        <td>{s.title || <em>(no title)</em>}</td>
                        <td>{s.movie}</td>
                        <td>{s.difficulty}</td>
                        <td>{s.tempo ?? "–"}</td>
                        <td>{s.timeSignature || "–"}</td>
                        <td>{s.key || "–"}</td>
                        <td>{s.noteCount}</td>
                        <td>{status(s)}</td>
                      </tr>
                      {open === s.index && (s.errors.length > 0 || s.warnings.length > 0) && (
                        <tr className="detail">
                          <td colSpan={9}>
                            {s.errors.length > 0 && <ul className="qz-issues bad">{s.errors.map((e, i) => <li key={i}><code>{e.path}</code> {e.message}</li>)}</ul>}
                            {s.warnings.length > 0 && <ul className="qz-issues">{s.warnings.map((w, i) => <li key={i}><code>{w.path}</code> {w.message}</li>)}</ul>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="admin-hint">Click a row to see its problems. Failed songs are left out; the others can still be imported.</p>

          {report.collection && report.songs.some((s) => s.ok) && (
            <div className="qz-import-opts">
              <label>
                <span>Add them to</span>
                <select
                  value={target === "file" ? "file" : String(target)}
                  onChange={(e) => {
                    const next = e.target.value === "file" ? "file" : Number(e.target.value);
                    setTarget(next);
                    void check(text, next);
                  }}
                >
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="file">A collection from the file ({report.collection.name})</option>
                </select>
              </label>
              <fieldset>
                <legend>If a song id already exists</legend>
                {([["skip", "Skip the existing song"], ["replace", "Replace the existing song"], ["new", "Import as a new song with a fresh id"]] as const).map(([value, label]) => (
                  <label key={value} className="check">
                    <input type="radio" name="dup" checked={duplicates === value} onChange={() => setDuplicates(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          )}

          <div className="admin-actions">
            <button type="button" disabled={busy || ready === 0 || report.fileErrors.length > 0} onClick={run}>
              {busy ? "Importing…" : `Import ${ready} song${ready === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="qz-result" role="status">
          <strong>Import finished</strong>
          <div className="qz-chips">
            <b>{result.summary.validated} validated</b>
            <b>{result.summary.imported} imported</b>
            <b>{result.summary.replaced} replaced</b>
            <b>{result.summary.skipped} skipped</b>
            <b className={result.summary.failedValidation ? "bad" : ""}>{result.summary.failedValidation} failed validation</b>
          </div>
          <ul>
            {result.results.map((r) => (
              <li key={r.index} className={r.action}>
                <b>{r.action}</b> {r.title || r.id}
                {r.newId ? ` (saved as ${r.newId})` : ""}
                {r.reason ? ` — ${r.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ImportPanel;
