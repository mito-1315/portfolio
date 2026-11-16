import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

type Mood = "Calm" | "Focused" | "Energetic" | "Nostalgic" | "Curious";

type QuizSongDoc = {
  id: string;
  title: string;
  movie: string;
  difficulty: string;
  quiz: { enabled: boolean };
};

type SeedData = {
  tracks?: {
    title: string;
    artist: string;
    audioUrl: string;
    coverUrl: string | null;
    mood: Mood;
    description: string | null;
    album: string | null;
    releaseDate: string | null;
    spotifyId: string | null;
    spotifyUrl: string | null;
    durationMs: number | null;
    clipStart: number;
    sortOrder: number;
    published: boolean;
  }[];
  movies?: {
    title: string;
    year: number | null;
    director: string | null;
    posterUrl: string | null;
    note: string | null;
    placement: string;
    sortOrder: number;
    published: boolean;
  }[];
  playlists?: {
    slug: string;
    name: string;
    description: string | null;
    coverUrl: string | null;
    published: boolean;
    sortOrder: number;
    tracks: string[];
  }[];
  quizCollections?: {
    key: string;
    name: string;
    description: string;
    instrument: string;
    enabled: boolean;
    songs: QuizSongDoc[];
  }[];
  settings?: { key: string; value: string }[];
  recommendations?: { kind: "SONG" | "MOVIE" | "OTHER"; name: string; title: string; reason: string; link: string | null; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string }[];
};

const here = path.dirname(fileURLToPath(import.meta.url));

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(here, name), "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * The starting content: whatever `npm run db:export` last saved in
 * seed-data.json. Each kind of content is only added while its table is
 * empty, so running this again (every deploy does) never undoes edits made
 * in the admin or brings back anything that was deleted.
 */
async function main() {
  const data = (await readJson<SeedData>("seed-data.json")) ?? {};
  if (!Object.keys(data).length) console.log("No seed-data.json found: adding only the basics.");

  // Editable site text. Existing values are never overwritten.
  const settings = data.settings ?? [
    { key: "valorant_tag", value: "aintNoMito#Love" },
    { key: "github_url", value: "https://github.com/mito-1315" },
  ];
  for (const s of settings) {
    await prisma.siteSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  if ((await prisma.track.count()) === 0 && data.tracks?.length) {
    await prisma.track.createMany({ data: data.tracks });
    console.log(`Added ${data.tracks.length} songs.`);
  }

  if ((await prisma.movie.count()) === 0 && data.movies?.length) {
    await prisma.movie.createMany({ data: data.movies });
    console.log(`Added ${data.movies.length} movies.`);
  }

  if ((await prisma.playlist.count()) === 0) {
    const lists = data.playlists?.length
      ? data.playlists
      : [{ slug: "favourites", name: "Favourites", description: "Songs I liked.", coverUrl: null, published: false, sortOrder: 0, tracks: [] }];
    for (const list of lists) {
      const { tracks, ...fields } = list;
      const created = await prisma.playlist.create({ data: fields });
      const found = await prisma.track.findMany({ where: { audioUrl: { in: tracks } }, select: { id: true, audioUrl: true } });
      const idByFile = new Map(found.map((t) => [t.audioUrl, t.id]));
      const items = tracks
        .map((audioUrl, position) => ({ trackId: idByFile.get(audioUrl), position }))
        .filter((i): i is { trackId: number; position: number } => i.trackId !== undefined)
        .map((i) => ({ ...i, playlistId: created.id }));
      if (items.length) await prisma.playlistItem.createMany({ data: items });
    }
    console.log(`Added ${lists.length} playlists.`);
  }

  if ((await prisma.recommendation.count()) === 0 && data.recommendations?.length) {
    await prisma.recommendation.createMany({ data: data.recommendations.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })) });
    console.log(`Added ${data.recommendations.length} recommendations.`);
  }

  // Guess the Song. Saved collections come first; a fresh install gets the classic tunes and an empty Tamil collection.
  if ((await prisma.quizCollection.count()) === 0) {
    let collections = data.quizCollections;
    if (!collections?.length) {
      const classic = await readJson<{ collection: { id: string; name: string; description: string; instrument: string; songs: QuizSongDoc[] } }>("classic-tunes.json");
      collections = [
        { key: "tamil_song_challenge", name: "Tamil Song Challenge", description: "Tamil melody recognition quiz", instrument: "acoustic_piano", enabled: true, songs: [] },
        ...(classic
          ? [{ key: classic.collection.id, name: classic.collection.name, description: classic.collection.description, instrument: classic.collection.instrument, enabled: true, songs: classic.collection.songs }]
          : []),
      ];
    }
    for (const c of collections) {
      const { songs, ...fields } = c;
      const created = await prisma.quizCollection.create({ data: fields });
      if (songs.length) {
        await prisma.quizSong.createMany({
          data: songs.map((doc, sortOrder) => ({
            collectionId: created.id,
            songId: doc.id,
            title: doc.title,
            movie: doc.movie,
            difficulty: doc.difficulty,
            enabled: doc.quiz.enabled,
            sortOrder,
            data: doc as unknown as Prisma.InputJsonValue,
          })),
        });
      }
    }
    console.log(`Added ${collections.length} quiz collections.`);
  }
}

main().finally(() => prisma.$disconnect());
