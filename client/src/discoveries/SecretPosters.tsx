import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import type { Movie } from "../services/api";
import PosterArt from "./PosterArt";
import { useSecretDoor } from "./useSecretDoor";
import "../music/SecretPlaylists.css";
import "./SecretPosters.css";

export const OPEN_POSTERS_EVENT = "open-secret-posters";

/**
 * A hidden window with every film poster. It opens by typing "posters" or by
 * pressing and holding the MT button. Choosing a poster shows its details.
 */
function SecretPosters() {
  const [open, setOpen] = useState(false);
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Movie | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);

  const show = useCallback(() => {
    returnTo.current = document.activeElement;
    setSelected(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
  }, []);

  useSecretDoor("posters", OPEN_POSTERS_EVENT, show);

  // Fresh each time it opens, so a poster added in the admin is there straight away.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/movies", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<Movie[]>) : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (cancelled) return;
        setMovies(data);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    closeRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selected) setSelected(null);
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, close]);

  if (!open) return null;

  return createPortal(
    <div className="sp" role="dialog" aria-modal="true" aria-label="Posters">
      <div className="sp-scrim" onClick={close} />
      <div className="sp-window" data-lenis-prevent>
        <header>
          <span>POSTERS</span>
          <button ref={closeRef} type="button" aria-label="Close" onClick={close}>
            <X size={16} />
          </button>
        </header>

        {failed && <p className="sp-empty">Couldn&apos;t load the posters just now.</p>}
        {!failed && movies === null && <p className="sp-empty">Loading…</p>}
        {movies && movies.length === 0 && <p className="sp-empty">Nothing here yet.</p>}

        {movies && movies.length > 0 && !selected && (
          <ul className="spo-grid">
            {movies.map((movie, index) => (
              <li key={movie.id}>
                <button type="button" onClick={() => setSelected(movie)} aria-label={`${movie.title}, details`}>
                  <span className="spo-tile">
                    <PosterArt movie={movie} index={index} />
                  </span>
                  <b>{movie.title}</b>
                  {movie.year && <em>{movie.year}</em>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="spo-detail">
            <div className="spo-poster">
              <PosterArt movie={selected} index={movies?.indexOf(selected) ?? 0} />
            </div>
            <div className="spo-info">
              <button type="button" className="spo-back" onClick={() => setSelected(null)}>
                <ArrowLeft size={14} /> All posters
              </button>
              <h2>{selected.title}</h2>
              {(selected.director || selected.year) && (
                <span>{[selected.director, selected.year].filter(Boolean).join(" · ")}</span>
              )}
              {selected.note && <p>{selected.note}</p>}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default SecretPosters;
