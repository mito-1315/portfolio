import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useApi, type Playlist, type Track } from "../../services/api";
import "./MusicPlayer.css";

const noTracks: Track[] = [];
const noPlaylists: Playlist[] = [];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Plays tracks from the API. Audio is created only after the visitor presses
 * play, and never starts on its own.
 */
function MusicPlayer() {
  const { data: allTracks, live } = useApi<Track[]>("/music/tracks", noTracks);
  const { data: playlists } = useApi<Playlist[]>("/music/playlists", noPlaylists);

  const [playlistId, setPlaylistId] = useState<number | "all">("all");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tracks =
    playlistId === "all" ? allTracks : allTracks.filter((t) => t.playlistId === playlistId);
  // `ended` can push the index past the end; wrap around instead of storing a fix.
  const current = tracks.length ? index % tracks.length : 0;
  const track = tracks[current];

  // Create the audio element once, and release it when the section unmounts.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;

    const onTime = () => setTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setIndex((i) => i + 1);
    const onError = () => {
      setError(true);
      setPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, []);

  // Load the selected track (without playing it).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    setError(false);
    setTime(0);
    setDuration(0);
    audio.src = track.audioUrl;
    if (playing) audio.play().catch(() => setPlaying(false));
    // Only reload when the track itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
    }
  }, [volume, muted]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      if (!audio.src) audio.src = track.audioUrl;
      audio.play().then(() => setPlaying(true)).catch(() => setError(true));
    }
  };

  const step = (delta: number) => {
    if (tracks.length === 0) return;
    setIndex(() => (current + delta + tracks.length) % tracks.length);
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (audio && duration) audio.currentTime = value;
    setTime(value);
  };

  if (tracks.length === 0) {
    return (
      <div className="player player-empty">
        <p>
          {live
            ? "No tracks yet. Add some from the admin API and they will appear here."
            : "The track list loads from the server, which isn't reachable right now."}
        </p>
      </div>
    );
  }

  return (
    <div className="player">
      {playlists.length > 0 && (
        <div className="player-playlists" role="group" aria-label="Playlists">
          <button
            type="button"
            className={playlistId === "all" ? "on" : ""}
            onClick={() => {
              setPlaylistId("all");
              setIndex(0);
            }}
          >
            All
          </button>
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              className={playlistId === p.id ? "on" : ""}
              onClick={() => {
                setPlaylistId(p.id);
                setIndex(0);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className={`player-disc ${playing ? "spin" : ""}`} aria-hidden="true">
        {track?.coverUrl ? <img src={track.coverUrl} alt="" /> : <span>♪</span>}
      </div>

      <div className="player-now">
        <strong>{track?.title}</strong>
        <span>{track?.artist}</span>
        {error && <em>This track couldn&apos;t be loaded.</em>}
      </div>

      <div className="player-progress">
        <span>{formatTime(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          disabled={!duration}
        />
        <span>{formatTime(duration)}</span>
      </div>

      <div className="player-controls">
        <button type="button" onClick={() => step(-1)} aria-label="Previous track">
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className="player-play"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" onClick={() => step(1)} aria-label="Next track">
          <SkipForward size={16} />
        </button>

        <div className="player-volume">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
            aria-label="Volume"
          />
        </div>
      </div>

      <ol className="player-list">
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              className={i === current ? "on" : ""}
              onClick={() => {
                setIndex(i);
                setPlaying(true);
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {t.title}
              <em>{t.artist}</em>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default MusicPlayer;
