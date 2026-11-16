import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { MoodName } from "../audio/musicTheory";
import { useMusic, useMusicTime } from "./MusicContext";
import { OPEN_EVENT } from "./SecretPlaylists";
import "./FloatingPlayer.css";

const MOODS: MoodName[] = ["Calm", "Focused", "Energetic", "Nostalgic", "Curious"];

/** How long the card stays open on arrival before it folds into the circle. */
const GREETING_MS = 1800;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function Progress() {
  const { seek, track } = useMusic();
  const { time, duration } = useMusicTime();
  return (
    <div className="fp-progress">
      <span>{formatTime(time)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(time, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        disabled={!duration || !track}
        aria-label="Seek"
        style={{ "--fill": `${duration ? (time / duration) * 100 : 0}%` } as React.CSSProperties}
      />
      <span>{formatTime(duration)}</span>
    </div>
  );
}

/**
 * The music player: a small circle at the bottom right that opens into a card.
 * It is a floating overlay, so it never moves the page. The audio itself lives
 * in MusicProvider and is untouched when this opens or closes.
 */
function FloatingPlayer() {
  const music = useMusic();
  const { tracks, moodTracks, track, mood, playing, blocked, failed, volume, muted } = music;

  // The card greets the visitor, then folds away unless they start using it.
  const [open, setOpen] = useState(true);
  const used = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focusOnToggle = useRef(false);
  // Pressing and holding the circle opens the hidden playlists window.
  const holdTimer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const startHold = () => {
    held.current = false;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      window.dispatchEvent(new Event(OPEN_EVENT));
    }, 900);
  };
  const endHold = () => window.clearTimeout(holdTimer.current);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!used.current) setOpen(false);
    }, GREETING_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Move focus along with a keyboard or click open/close, but not on the automatic fold.
  useEffect(() => {
    if (!focusOnToggle.current) return;
    focusOnToggle.current = false;
    (open ? closeRef.current : triggerRef.current)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && rootRef.current?.contains(document.activeElement)) {
        focusOnToggle.current = true;
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (tracks.length === 0) return null;

  const markUsed = () => {
    used.current = true;
  };

  const openFromTrigger = () => {
    used.current = true;
    focusOnToggle.current = true;
    setOpen(true);
    if (blocked) music.toggle();
  };

  const counts = (m: MoodName) => tracks.filter((t) => t.mood === m).length;

  return (
    <div
      ref={rootRef}
      className="fp"
      data-open={open}
      data-playing={playing}
      onPointerEnter={markUsed}
      onPointerDown={markUsed}
      onFocusCapture={markUsed}
    >
      <section className="fp-card" aria-label="Music player" inert={!open} data-lenis-prevent>
        <div className="fp-body">
          <header className="fp-head">
            <div className="fp-cover" aria-hidden="true">
              {track?.coverUrl ? <img src={track.coverUrl} alt="" loading="lazy" decoding="async" /> : <span>♪</span>}
            </div>
            <div className="fp-now" aria-live="polite">
              <strong>{track?.title ?? `No ${mood} tracks yet`}</strong>
              <span>{track?.artist ?? "Pick another mood below"}</span>
              <em>{mood}</em>
              {track?.spotifyUrl && (
                <a className="fp-spotify" href={track.spotifyUrl} target="_blank" rel="noreferrer noopener">
                  Song details on Spotify ↗
                </a>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              className="fp-icon"
              aria-label="Collapse the music player"
              onClick={() => {
                focusOnToggle.current = true;
                setOpen(false);
              }}
            >
              <ChevronDown size={18} />
            </button>
          </header>

          {failed && <p className="fp-note">This track couldn&apos;t be loaded.</p>}
          {blocked && !failed && <p className="fp-note">Your browser paused the music. Press play to start.</p>}

          <Progress />

          <div className="fp-controls">
            <button type="button" className="fp-icon" aria-label="Previous track" onClick={music.previous} disabled={!track}>
              <SkipBack size={17} />
            </button>
            <button
              type="button"
              className="fp-play"
              aria-label={playing ? "Pause" : "Play"}
              onClick={music.toggle}
              disabled={!track}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <button type="button" className="fp-icon" aria-label="Next track" onClick={music.next} disabled={!track}>
              <SkipForward size={17} />
            </button>

            <div className="fp-volume">
              <button type="button" className="fp-icon" aria-label={muted ? "Unmute" : "Mute"} onClick={music.toggleMute}>
                {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => music.setVolume(Number(e.target.value))}
                aria-label="Volume"
                style={{ "--fill": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="fp-moods" role="group" aria-label="Music mood">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === mood}
                disabled={counts(m) === 0}
                title={counts(m) === 0 ? `No ${m} tracks yet` : `${counts(m)} track${counts(m) === 1 ? "" : "s"}`}
                onClick={() => music.selectMood(m)}
              >
                {m}
              </button>
            ))}
          </div>

          {moodTracks.length > 0 && (
            <ol className="fp-list">
              {moodTracks.map((t, i) => (
                <li key={t.id}>
                  <button type="button" aria-current={t.id === track?.id} onClick={() => music.selectTrack(t.id)}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <b>{t.title}</b>
                    <em>{t.artist}</em>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <button
        ref={triggerRef}
        type="button"
        className="fp-trigger"
        aria-label={blocked ? "Music is waiting: press to play" : "Open the music player"}
        aria-expanded={open}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onContextMenu={(event) => {
          if (held.current) event.preventDefault();
        }}
        onClick={() => {
          // A press-and-hold already did its job; do not also open the card.
          if (held.current) {
            held.current = false;
            return;
          }
          openFromTrigger();
        }}
        inert={open}
      >
        <span className="fp-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>

      {blocked && !open && <span className="fp-hint" aria-hidden="true">Tap to play</span>}
    </div>
  );
}

export default FloatingPlayer;
