import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApi, type Movie } from "../services/api";
import PosterArt from "./PosterArt";
import "./MovieEggs.css";

const noMovies: Movie[] = [];

/** Sections that hints are spread across when a film is set to "automatic". */
const AUTO_SECTIONS = ["about", "skills", "experience", "leadership", "music", "recommend", "contact"];
const ALL_SECTIONS = [...AUTO_SECTIONS, "projects"];

type Kind = "clef" | "note" | "glow";

type Egg = {
  movie: Movie;
  index: number;
  section: string;
  /** When several films share a section they take turns down its length. */
  slot: number;
  slots: number;
  kind: Kind;
  glyph: string;
  side: "left" | "right";
  top: number;
};

const KINDS: Kind[] = ["clef", "note", "glow"];
const NOTES = ["♪", "♫", "♩", "♬"];
const TOPS = [34, 30, 62, 40, 26, 54];

/** Gives every film its own hint: a place, a musical symbol and a spot at the edge of the screen. */
function planEggs(movies: Movie[]): Egg[] {
  const load = new Map<string, number>(ALL_SECTIONS.map((s) => [s, 0]));
  const placed = movies.map(({ placement: wanted }) => {
    if (wanted && wanted !== "auto" && load.has(wanted)) {
      load.set(wanted, (load.get(wanted) ?? 0) + 1);
      return wanted;
    }
    return null;
  });

  // Automatic films go to the quietest sections first, in page order.
  const sections = movies.map((_movie, i) => {
    const manual = placed[i];
    if (manual) return manual;
    const pick = [...AUTO_SECTIONS].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0]!;
    load.set(pick, (load.get(pick) ?? 0) + 1);
    return pick;
  });

  return movies.map((movie, index) => {
    const section = sections[index]!;
    const sharing = sections.map((s, i) => (s === section ? i : -1)).filter((i) => i >= 0);
    const kind = KINDS[index % KINDS.length]!;
    return {
      movie,
      index,
      section,
      slot: sharing.indexOf(index),
      slots: sharing.length,
      kind,
      glyph: kind === "clef" ? "𝄞" : kind === "glow" ? "♬" : NOTES[index % NOTES.length]!,
      side: index % 2 === 0 ? "right" : "left",
      top: TOPS[index % TOPS.length]!,
    };
  });
}

/** Which section crosses the middle of the screen, and how far through it we are (0 to 1). */
function useSectionProgress(ids: string[]) {
  const [state, setState] = useState<{ id: string | null; progress: number }>({ id: null, progress: 0 });
  const key = ids.join("|");

  useEffect(() => {
    const list = key.split("|");
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let next: { id: string | null; progress: number } = { id: null, progress: 0 };
      for (const id of list) {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        if (rect && rect.top <= middle && rect.bottom > middle) {
          next = { id, progress: (middle - rect.top) / rect.height };
          break;
        }
      }
      setState((prev) => (prev.id === next.id && Math.abs(prev.progress - next.progress) < 0.02 ? prev : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key]);

  return state;
}

/* ---------- The reveal: the symbol unfolds into its poster ---------- */

type Origin = { left: number; top: number; width: number; height: number };

function PosterReveal({
  egg,
  origin,
  returnFocus,
  onClosed,
}: {
  egg: Egg;
  origin: Origin;
  returnFocus: HTMLElement | null;
  onClosed: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const tl = timeline.current;
    if (tl) tl.timeScale(1.3).reverse();
    else onClosed();
  }, [onClosed]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxHeight = vh * 0.6;
      const width = Math.min(vw * 0.8, 360, (maxHeight * 2) / 3);
      const height = width * 1.5;
      const left = (vw - width) / 2;
      const top = Math.max(28, (vh - height) / 2 - 36);

      gsap.set(".egg-reveal-poster", { left: origin.left, top: origin.top, width: origin.width, height: origin.height, borderRadius: 999 });

      const tl = gsap.timeline({
        onReverseComplete: () => {
          returnFocus?.focus({ preventScroll: true });
          onClosed();
        },
      });
      timeline.current = tl;

      if (reduced) {
        gsap.set(".egg-reveal-poster", { left, top, width, height, borderRadius: 18 });
        tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      } else {
        tl.fromTo(".egg-scrim", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0)
          // The symbol swells, then its edges open into the poster.
          .fromTo(".egg-reveal-glyph", { opacity: 1, scale: 1 }, { opacity: 0, scale: 2.4, duration: 0.35, ease: "power2.in" }, 0)
          .to(".egg-reveal-poster", { left, top, width, height, duration: 0.85, ease: "expo.out" }, 0.05)
          .to(".egg-reveal-poster", { borderRadius: 18, duration: 0.7, ease: "power3.out" }, 0.12)
          .fromTo(".egg-reveal-art", { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.15);
      }
      tl.fromTo(
        ".egg-reveal-info",
        { opacity: 0, y: 14, top: top + height + 18 },
        { opacity: 1, y: 0, top: top + height + 18, duration: 0.5, ease: "power3.out" },
        reduced ? 0.1 : 0.6
      );
      tl.fromTo(".egg-reveal-close", { opacity: 0 }, { opacity: 1, duration: 0.3 }, reduced ? 0.1 : 0.55);
    }, root);

    root.querySelector<HTMLElement>(".egg-reveal-close")?.focus({ preventScroll: true });
    return () => ctx.revert();
    // The poster opens once, from where the symbol was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const { movie, glyph } = egg;
  // Mounted on the page body, so it covers the navigation and the music player too.
  return createPortal(
    <div ref={rootRef} className="egg-reveal" role="dialog" aria-modal="true" aria-label={`${movie.title}, a hidden poster`}>
      <div className="egg-scrim" onClick={close} />
      <div className="egg-reveal-poster">
        <div className="egg-reveal-art">
          <PosterArt movie={movie} index={egg.index} />
        </div>
        <span className="egg-reveal-glyph" aria-hidden="true">{glyph}</span>
      </div>
      <div className="egg-reveal-info">
        <strong>{movie.title}</strong>
        {(movie.year || movie.director) && <span>{[movie.director, movie.year].filter(Boolean).join(" · ")}</span>}
        {movie.note && <p>{movie.note}</p>}
      </div>
      <button type="button" className="egg-reveal-close" onClick={close} aria-label="Close the poster">
        <X size={16} />
      </button>
    </div>,
    document.body
  );
}

/* ---------- The hints ---------- */

/**
 * Hidden film posters, found rather than listed. Each film appears as a tiny
 * musical symbol that shows up near the edge of the screen only while the
 * visitor is in its own part of the page. A click unfolds the symbol into the
 * film's poster. There is no gallery: at most one symbol is visible at a time
 * and only one poster can be open.
 */
function MovieEggs() {
  const { data: movies } = useApi<Movie[]>("/movies", noMovies);
  const eggs = useMemo(() => planEggs(movies), [movies]);
  const sectionIds = useMemo(() => [...new Set(eggs.map((e) => e.section))], [eggs]);
  const { id: current, progress } = useSectionProgress(sectionIds);

  const [open, setOpen] = useState<{ egg: Egg; origin: Origin; trigger: HTMLElement } | null>(null);

  const visibleId = useMemo(() => {
    if (!current) return null;
    // One symbol at a time: the first film whose turn it is in this part of the page.
    const here = eggs.filter((e) => e.section === current);
    const mine = here.find((e) => progress >= e.slot / e.slots && progress < (e.slot + 1) / e.slots);
    return mine?.movie.id ?? null;
  }, [eggs, current, progress]);

  const closed = useCallback(() => setOpen(null), []);

  return (
    <>
      {eggs.map((egg) => {
        const on = visibleId === egg.movie.id && !open;
        const isOpen = open?.egg.movie.id === egg.movie.id;
        return (
          <div
            key={egg.movie.id}
            className={`egg-hint egg-${egg.kind} side-${egg.side}`}
            data-on={on}
            data-open={isOpen}
            style={{ top: `${egg.top}%` }}
          >
            {egg.kind === "clef" && <span className="egg-staff" aria-hidden="true" />}
            <button
              type="button"
              className="egg-symbol"
              tabIndex={on ? 0 : -1}
              aria-hidden={on ? undefined : true}
              aria-label="A hidden musical symbol. Reveal a film poster."
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                setOpen({
                  egg,
                  trigger: event.currentTarget,
                  origin: {
                    left: rect.left + rect.width / 2 - size / 2,
                    top: rect.top + rect.height / 2 - size / 2,
                    width: size,
                    height: size,
                  },
                });
              }}
            >
              <span aria-hidden="true">{egg.glyph}</span>
            </button>
          </div>
        );
      })}
      {open && <PosterReveal egg={open.egg} origin={open.origin} returnFocus={open.trigger} onClosed={closed} />}
    </>
  );
}

export default MovieEggs;
