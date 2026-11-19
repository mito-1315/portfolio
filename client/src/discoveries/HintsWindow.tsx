import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useSecretDoor } from "./useSecretDoor";
import "../music/SecretPlaylists.css";
import "./HintsWindow.css";

export const OPEN_HINTS_EVENT = "open-hints";

type Hint = { where: string; text: string };

/** One riddle for every hidden thing on the page, in the order you meet them. No answers. */
function hintsFor(filmCount: number | null): Hint[] {
  const films =
    filmCount === null || filmCount === 0
      ? "Each belongs to one film."
      : `${filmCount} ${filmCount === 1 ? "film is" : "films are"} hiding this way, one at a time, each in a place of its own.`;
  return [
    {
      where: "About",
      text: "Look in the margin for something small that wants to be aimed at. Take a shot, and the whole page turns into a target.",
    },
    {
      where: "Along the way",
      text: `Tiny musical symbols drift in from the edges of the screen: a clef sailing along a short staff, a note half out of sight, a faint glow that comes and goes. ${films} Click one and it unfolds.`,
    },
    {
      where: "Experience",
      text: "Something you strum with is lying near the edge. Pick it up, and throw it.",
    },
    {
      where: "Leadership",
      text: "Scroll to the Leadership section and look at the bottom-left corner of your screen: a football with the number 10 is half hidden at the edge. Click it to kick it up, then keep clicking to juggle it. Every touch plays the next note of a tune.",
    },
    {
      where: "Music Room",
      text: "The piano is not only to look at. Press it, or drag across its keys, and even the dust moves out of your way.",
    },
    {
      where: "Near the end",
      text: "Close to the bottom of the page, something peeks up from the edge. It has pages, and it is happy to be read.",
    },
    {
      where: "Anywhere",
      text: "Some words open doors. Type the word for a list of songs, in the plural. Then type the word for what a film is announced on, also plural, and see what is on the wall.",
    },
    {
      where: "Anywhere",
      text: "Not everything answers to a word. Press and hold the music button in the corner, or the MT button at the top left.",
    },
  ];
}

/**
 * A window of clues for every hidden thing on the site. It opens from the quiet
 * "need a hint?" line near the end of the page, or by typing "hints".
 */
function HintsWindow() {
  const [open, setOpen] = useState(false);
  const [films, setFilms] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);

  const show = useCallback(() => {
    returnTo.current = document.activeElement;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
  }, []);

  useSecretDoor("hints", OPEN_HINTS_EVENT, show);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/movies")
      .then((r) => (r.ok ? (r.json() as Promise<unknown[]>) : []))
      .then((list) => {
        if (!cancelled) setFilms(list.length);
      })
      .catch(() => {
        if (!cancelled) setFilms(null);
      });
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  const hints = hintsFor(films);

  return createPortal(
    <div className="sp" role="dialog" aria-modal="true" aria-label="Hints">
      <div className="sp-scrim" onClick={close} />
      <div className="sp-window hw-window" data-lenis-prevent>
        <header>
          <span>HINTS</span>
          <button ref={closeRef} type="button" aria-label="Close" onClick={close}>
            <X size={16} />
          </button>
        </header>
        <div className="hw-body">
          <h2>
            Things hide in this <em>page.</em>
          </h2>
          <p className="hw-lede">A clue for each one. The answers are yours to find.</p>
          <ol>
            {hints.map((hint, index) => (
              <li key={index}>
                <span className="hw-n">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <span className="hw-where">{hint.where}</span>
                  <p>{hint.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default HintsWindow;
