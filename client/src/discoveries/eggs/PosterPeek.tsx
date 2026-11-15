import { fallbackMovies, useApi, type Movie } from "../../services/api";
import PosterArt from "../PosterArt";

/** A poster peeking in from the right edge. Opens the film reel. */
function PosterPeek({ visible, onOpen }: { visible: boolean; onOpen: () => void }) {
  const { data: movies } = useApi<Movie[]>("/movies", fallbackMovies);
  const movie = movies[0];
  if (!movie) return null;

  return (
    <button
      type="button"
      className={`egg egg-poster ${visible ? "on" : ""}`}
      onClick={onOpen}
      tabIndex={visible ? 0 : -1}
      aria-label="A movie poster peeking in from the edge. Open the film reel."
    >
      <PosterArt movie={movie} index={0} />
    </button>
  );
}

export default PosterPeek;
