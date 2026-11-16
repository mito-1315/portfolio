import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Track } from "../services/api";
import { useSecretDoor } from "../discoveries/useSecretDoor";
import { useMusic } from "./MusicContext";
import "./SecretPlaylists.css";

type PlaylistView = {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
  /** True when only the signed-in owner can see this list. */
  private: boolean;
  tracks: (Track & { published: boolean })[];
};

/** Typing this anywhere outside a text field opens the window. */
const WORD = "playlists";
export const OPEN_EVENT = "open-secret-playlists";

/**
 * A hidden window with the owner's playlists. It opens by typing "playlists"
 * or by pressing and holding the music button. Visitors only see playlists
 * marked visible; the signed-in owner sees all of them.
 */
function SecretPlaylists() {
  const music = useMusic();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<PlaylistView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
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

  // The two secret ways in: the word, or a press-and-hold on the music button.
  useSecretDoor(WORD, OPEN_EVENT, show);

  // Fetch fresh each time it opens, so a change in the admin shows up straight away.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/music/playlists", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<PlaylistView[]>) : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (cancelled) return;
        setLists(data);
        setFailed(false);
        setActive(0);
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
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const list = lists?.[Math.min(active, (lists?.length ?? 1) - 1)];
  const playable = (t: PlaylistView["tracks"][number]) => t.published && music.tracks.some((m) => m.id === t.id);

  return createPortal(
    <div className="sp" role="dialog" aria-modal="true" aria-label="Playlists">
      <div className="sp-scrim" onClick={close} />
      <div className="sp-window" data-lenis-prevent>
        <header>
          <span>PLAYLISTS</span>
          <button ref={closeRef} type="button" aria-label="Close" onClick={close}>
            <X size={16} />
          </button>
        </header>

        {failed && <p className="sp-empty">Couldn&apos;t load the playlists just now.</p>}
        {!failed && lists === null && <p className="sp-empty">Loading…</p>}
        {lists && lists.length === 0 && <p className="sp-empty">Nothing here yet.</p>}

        {lists && lists.length > 0 && list && (
          <div className="sp-body">
            <nav aria-label="Playlists">
              {lists.map((l, i) => (
                <button key={l.id} type="button" aria-current={i === active} onClick={() => setActive(i)}>
                  {l.coverUrl ? <img src={l.coverUrl} alt="" loading="lazy" /> : <i aria-hidden="true">♪</i>}
                  <b>{l.name}</b>
                  <span>
                    {l.tracks.length} song{l.tracks.length === 1 ? "" : "s"}
                    {l.private ? " · only you" : ""}
                  </span>
                </button>
              ))}
            </nav>

            <div className="sp-tracks">
              <div className="sp-head">
                {list.coverUrl ? (
                  <img className="sp-poster" src={list.coverUrl} alt="" />
                ) : (
                  <span className="sp-poster sp-poster-empty" aria-hidden="true">♪</span>
                )}
                <div className="sp-head-text">
                  <h2>{list.name}</h2>
                  {list.description && <p>{list.description}</p>}
                  {list.tracks.some(playable) && (
                    <button type="button" className="sp-playall" onClick={() => music.playTrack(list.tracks.find(playable)!)}>
                      Play from the start
                    </button>
                  )}
                </div>
              </div>
              <ol>
                {list.tracks.length === 0 && <li className="sp-empty">No songs in this playlist yet.</li>}
                {list.tracks.map((t, i) => (
                  <li key={t.id}>
                    <button type="button" disabled={!playable(t)} onClick={() => music.playTrack(t)}>
                      <span className="sp-n">{String(i + 1).padStart(2, "0")}</span>
                      {t.coverUrl ? <img src={t.coverUrl} alt="" loading="lazy" /> : <span className="sp-art">♪</span>}
                      <span className="sp-t">
                        <b>{t.title}</b>
                        <em>{t.artist}</em>
                      </span>
                      <span className="sp-m">{t.published ? t.mood : "inactive"}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default SecretPlaylists;
