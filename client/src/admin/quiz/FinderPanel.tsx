import { useEffect, useRef, useState } from "react";
import { ExternalLink, Pause, Play } from "lucide-react";
import type { QuizPlayer } from "../../quiz/engine";
import type { QuizSong } from "../../quiz/types";
import { ApiError, call } from "../adminApi";
import { draftFrom, type Candidate, type FindResult } from "./quizApi";

const SCOPE_LABEL: Record<Candidate["scope"], string> = {
  whole: "Everything on the page",
  first: "From the start of the page",
  longest: "The longest run of notes",
};

/**
 * Looks for ready-made notes online, shows what it found and where, and lets
 * you preview and choose. Nothing is saved: "Use this" only opens an editable
 * draft, and the draft starts switched off.
 */
function FinderPanel({
  existingIds,
  player,
  onUse,
  onAuthError,
}: {
  existingIds: string[];
  player: QuizPlayer;
  onUse: (draft: QuizSong) => void;
  onAuthError: () => void;
}) {
  const [title, setTitle] = useState("");
  const [movie, setMovie] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FindResult | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingRef = useRef<string | null>(null);

  useEffect(() => () => player.stop(), [player]);

  const search = async (specificUrl?: string) => {
    setBusy(true);
    setError("");
    setResult(null);
    player.stop();
    try {
      const r = await call<FindResult>("POST", "/admin/quiz/find-notes", {
        title: title.trim(),
        movie: movie.trim(),
        ...(specificUrl ? { url: specificUrl } : {}),
      });
      setResult(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setError(e instanceof Error ? e.message : "The search failed.");
    } finally {
      setBusy(false);
    }
  };

  const preview = async (c: Candidate) => {
    if (playingRef.current === c.id) {
      player.stop();
      return;
    }
    const draft = draftFrom(title.trim() || "Preview", movie.trim(), c.notes, existingIds);
    playingRef.current = c.id;
    setPlayingId(c.id);
    try {
      await player.play(draft, {
        onEnd: () => {
          if (playingRef.current === c.id) {
            playingRef.current = null;
            setPlayingId(null);
          }
        },
      });
    } catch {
      playingRef.current = null;
      setPlayingId(null);
    }
  };

  return (
    <div className="qz-panel">
      <h3>Find notes online</h3>
      <p className="admin-hint">
        Searches the web for notes someone has already written out for this song, and shows you what it finds. Pages usually give the order of
        the pitches but not the rhythm, so check each suggestion by ear before you use it. You are responsible for having the right to use
        what you take.
      </p>

      <div className="qz-find-form">
        <label><span>Song title</span><input type="text" value={title} placeholder="e.g. Kannazhaga" onChange={(e) => setTitle(e.target.value)} /></label>
        <label><span>Movie</span><input type="text" value={movie} placeholder="e.g. 3" onChange={(e) => setMovie(e.target.value)} /></label>
        <button type="button" disabled={busy || !title.trim()} onClick={() => search()}>{busy ? "Searching…" : "Search the web"}</button>
      </div>
      <div className="qz-find-form">
        <label className="wide"><span>Or read one specific page</span><input type="url" value={url} placeholder="https://… (a page with the notes written out)" onChange={(e) => setUrl(e.target.value)} /></label>
        <button type="button" className="ghost" disabled={busy || !title.trim() || !url.trim()} onClick={() => search(url.trim())}>Read this page</button>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}

      {result && (
        <>
          <p className="admin-hint">
            Searched with {result.engine}: {result.pagesChecked} page{result.pagesChecked === 1 ? "" : "s"} read, {result.candidates.length} suggestion{result.candidates.length === 1 ? "" : "s"} found.
          </p>
          {result.candidates.length === 0 && (
            <p className="admin-hint">Nothing usable was found. Try the song&apos;s English spelling, add the movie name, or paste the address of a page that has the notes.</p>
          )}
          <ul className="qz-cands">
            {result.candidates.map((c) => (
              <li key={c.id}>
                <div className="qz-cand-top">
                  <div>
                    <strong>{c.sourceTitle}</strong>
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener">{c.site} <ExternalLink size={12} /></a>
                  </div>
                  <span className="qz-score" title="How well the page matches the song and how much it contains">match {Math.max(0, Math.min(99, c.score))}</span>
                </div>
                <p className="qz-cand-meta">
                  {SCOPE_LABEL[c.scope]} · {c.noteCount} notes{c.restCount ? ` + ${c.restCount} rests` : ""} · {c.kind === "sargam" ? "sargam" : "note letters"}
                </p>
                <code className="qz-cand-snippet">{c.snippet}</code>
                <p className="qz-cand-first">Starts: {c.notes.slice(0, 12).map((n) => n.pitch).join(" ")}{c.notes.length > 12 ? " …" : ""}</p>
                <ul className="qz-flags">{c.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
                <div className="admin-actions">
                  <button type="button" className="ghost" onClick={() => preview(c)}>
                    {playingId === c.id ? <Pause size={14} /> : <Play size={14} />} {playingId === c.id ? "Stop" : "Preview"}
                  </button>
                  <button type="button" onClick={() => { player.stop(); onUse(draftFrom(title.trim(), movie.trim(), c.notes, existingIds)); }}>Use this</button>
                </div>
              </li>
            ))}
          </ul>
          {result.skipped.length > 0 && (
            <details className="qz-skipped">
              <summary>{result.skipped.length} page{result.skipped.length === 1 ? "" : "s"} skipped</summary>
              <ul>{result.skipped.map((s, i) => <li key={i}><code>{s.url}</code> {s.reason}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

export default FinderPanel;
