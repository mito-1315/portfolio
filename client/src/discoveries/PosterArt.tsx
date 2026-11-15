import type { Movie } from "../services/api";

/** A film's poster: the image if there is one, otherwise a typographic poster. */
function PosterArt({ movie, index }: { movie: Movie; index: number }) {
  if (movie.posterUrl) {
    return <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" draggable={false} />;
  }
  return (
    <div className={`poster-art tone-${index % 5}`} aria-hidden="true">
      <span className="poster-year">{movie.year ?? ""}</span>
      <span className="poster-title">{movie.title}</span>
    </div>
  );
}

export default PosterArt;
