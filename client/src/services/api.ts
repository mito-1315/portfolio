import { useEffect, useState } from "react";
import type { MoodName } from "../audio/musicTheory";

export type Movie = {
  id: number;
  title: string;
  year: number | null;
  director: string | null;
  posterUrl: string | null;
  note: string | null;
  /** "auto", or the id of the section where this film's hidden hint lives. */
  placement?: string;
};

export type Track = {
  id: number;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string | null;
  /** One of the five moods of the entry screen. */
  mood: MoodName;
  description: string | null;
  album: string | null;
  spotifyUrl: string | null;
};

export type Playlist = { id: number; slug: string; name: string };

export type Settings = Record<string, string>;

/**
 * Local copies of the content, shown when the API is unreachable so the
 * public site never depends on the server being up.
 */
export const fallbackMovies: Movie[] = [
  { id: -1, title: "OK Kanmani", year: 2015, director: "Mani Ratnam", posterUrl: null, note: null },
  { id: -2, title: "Alaipayuthey", year: 2000, director: "Mani Ratnam", posterUrl: null, note: null },
  { id: -3, title: "Thuppakki", year: 2012, director: "A. R. Murugadoss", posterUrl: null, note: null },
  { id: -4, title: "Oh My Kadavule", year: 2020, director: "Ashwath Marimuthu", posterUrl: null, note: null },
  { id: -5, title: "Eeram", year: 2009, director: "Arivazhagan", posterUrl: null, note: null },
];

export const fallbackSettings: Settings = { valorant_tag: "aintNoMito#Love" };

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

/** Loads `path`, returning `fallback` if the request fails. */
export function useApi<T>(path: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getJson<T>(path, controller.signal)
      .then((result) => {
        setData(result);
        setLive(true);
      })
      .catch(() => {
        /* keep the fallback */
      });
    return () => controller.abort();
    // `fallback` is a stable module-level constant at every call site.
  }, [path]);

  return { data, live };
}
