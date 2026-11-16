import { config } from "./config.js";

/**
 * Spotify's public catalogue, used only to look up song details (title, artist,
 * album, artwork, year, link). It does not identify audio, and it does not
 * stream anything: the audio always comes from the file the site owner uploads.
 * Uses the "client credentials" flow, so no visitor ever logs in to Spotify.
 */

export type SpotifyMatch = {
  spotifyId: string;
  spotifyUrl: string;
  title: string;
  artist: string;
  album: string;
  /** "2020", "2020-05" or "2020-05-01", as Spotify gives it. */
  releaseDate: string;
  durationMs: number;
  artworkUrl: string | null;
};

export class SpotifyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const spotifyConfigured = () => Boolean(config.SPOTIFY_CLIENT_ID && config.SPOTIFY_CLIENT_SECRET);

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (!spotifyConfigured()) {
    throw new SpotifyError(501, "Spotify isn't set up yet. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to server/.env.");
  }
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const basic = Buffer.from(`${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  let response: Response;
  try {
    response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new SpotifyError(502, "Couldn't reach Spotify. Check the internet connection and try again.");
  }
  if (!response.ok) {
    throw new SpotifyError(502, "Spotify rejected the Client ID and Secret in server/.env. Check them in the Spotify dashboard.");
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function api<T>(path: string): Promise<T> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new SpotifyError(502, "Couldn't reach Spotify. Check the internet connection and try again.");
  }
  if (response.status === 404) throw new SpotifyError(404, "Spotify has no track at that link.");
  if (response.status === 429) throw new SpotifyError(429, "Spotify says to slow down. Try again in a minute.");
  if (!response.ok) throw new SpotifyError(502, `Spotify answered with an error (${response.status}).`);
  return (await response.json()) as T;
}

type RawTrack = {
  id: string;
  name: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
  artists?: { name: string }[];
  album?: { name?: string; release_date?: string; images?: { url: string; width: number }[] };
};

function toMatch(raw: RawTrack): SpotifyMatch {
  // Images come largest first; a 640px cover is plenty for a 56px thumbnail and the card.
  const images = raw.album?.images ?? [];
  return {
    spotifyId: raw.id,
    spotifyUrl: raw.external_urls?.spotify ?? `https://open.spotify.com/track/${raw.id}`,
    title: raw.name,
    artist: (raw.artists ?? []).map((a) => a.name).join(", "),
    album: raw.album?.name ?? "",
    releaseDate: raw.album?.release_date ?? "",
    durationMs: raw.duration_ms,
    artworkUrl: images[0]?.url ?? null,
  };
}

/** The best few Spotify matches for a title and artist (or any search words). */
export async function searchTracks(query: string): Promise<SpotifyMatch[]> {
  const data = await api<{ tracks?: { items?: (RawTrack | null)[] } }>(
    `/search?type=track&limit=5&q=${encodeURIComponent(query)}`
  );
  return (data.tracks?.items ?? []).filter((t): t is RawTrack => Boolean(t)).map(toMatch);
}

/** Pulls the 22-character track id out of a Spotify link, URI or bare id. */
export function parseTrackId(input: string): string | null {
  const text = input.trim();
  const found =
    /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})/.exec(text) ??
    /^spotify:track:([A-Za-z0-9]{22})$/.exec(text) ??
    /^([A-Za-z0-9]{22})$/.exec(text);
  return found?.[1] ?? null;
}

export async function getTrack(id: string): Promise<SpotifyMatch> {
  return toMatch(await api<RawTrack>(`/tracks/${id}`));
}
