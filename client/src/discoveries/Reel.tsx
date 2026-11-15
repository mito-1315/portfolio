import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fallbackMovies, useApi, type Movie } from "../services/api";
import PosterArt from "./PosterArt";
import "./Reel.css";

const isManiRatnam = (movie: Movie) => movie.director === "Mani Ratnam";

/**
 * A film reel: a strip of posters, opened from the poster peeking in at the
 * edge of the page. Choosing one opens its details.
 */
function Reel({ onClose }: { onClose: () => void }) {
  const { data: movies } = useApi<Movie[]>("/movies", fallbackMovies);
  const [selected, setSelected] = useState<Movie | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selected) setSelected(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  return (
    <div className="reel" role="dialog" aria-modal="true" aria-label="Film reel" onClick={onClose}>
      <button ref={closeRef} type="button" className="reel-close" onClick={onClose} aria-label="Close the reel">
        <X size={16} />
        <span>ESC</span>
      </button>

      <div className="reel-body" onClick={(e) => e.stopPropagation()}>
        <span className="reel-label">FRAMES I KEEP RETURNING TO</span>
        <ul className="reel-strip" aria-label="Favourite films">
          {movies.map((movie, index) => (
            <li key={movie.id}>
              <button
                type="button"
                className="reel-poster"
                onClick={() => setSelected(movie)}
                aria-label={`${movie.title}, details`}
              >
                <PosterArt movie={movie} index={index} />
                <span className="reel-caption">
                  <strong>{movie.title}</strong>
                  <span>{[movie.director, movie.year].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="film-detail" onClick={(e) => { e.stopPropagation(); setSelected(null); }}>
          <div className="film-card" onClick={(e) => e.stopPropagation()}>
            <div className="film-poster">
              <PosterArt movie={selected} index={movies.indexOf(selected)} />
            </div>
            <div className="film-info">
              <span className="film-year">{selected.year}</span>
              <h3>{selected.title}</h3>
              {selected.director && <p>Directed by {selected.director}</p>}
              {isManiRatnam(selected) && (
                <p className="film-hint">
                  A Mani Ratnam film. Pay attention to the light, and to what the characters
                  leave unsaid.
                </p>
              )}
              {selected.note && <p className="film-note">{selected.note}</p>}
              <button type="button" className="film-back" onClick={() => setSelected(null)}>
                Back to the reel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reel;
