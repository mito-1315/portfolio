import "dotenv/config";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

/**
 * Saves what is in the database right now (songs, movies, melodies, playlists
 * and site settings) as prisma/seed-data.json, and copies the audio and images
 * they use into seed/uploads. A fresh deployment starts from that.
 *
 *   npm run db:export
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = new Set<string>();

/** Remembers an uploaded file so it is copied along, and passes the address through. */
function keep(url: string | null | undefined): string | null {
  if (url?.startsWith("/uploads/")) files.add(url);
  return url ?? null;
}

async function main() {
  const [tracks, movies, quizCollections, playlists, settings, recommendations] = await Promise.all([
    prisma.track.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.movie.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.quizCollection.findMany({
      orderBy: { id: "asc" },
      include: { songs: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
    }),
    prisma.playlist.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { items: { orderBy: { position: "asc" }, include: { track: { select: { audioUrl: true } } } } },
    }),
    prisma.siteSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.recommendation.findMany({ orderBy: { id: "asc" } }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    tracks: tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      audioUrl: keep(t.audioUrl),
      coverUrl: keep(t.coverUrl),
      mood: t.mood,
      description: t.description,
      album: t.album,
      releaseDate: t.releaseDate,
      spotifyId: t.spotifyId,
      spotifyUrl: t.spotifyUrl,
      durationMs: t.durationMs,
      clipStart: t.clipStart,
      sortOrder: t.sortOrder,
      published: t.published,
    })),
    movies: movies.map((m) => ({
      title: m.title,
      year: m.year,
      director: m.director,
      posterUrl: keep(m.posterUrl),
      note: m.note,
      placement: m.placement,
      sortOrder: m.sortOrder,
      published: m.published,
    })),
    // Whole song documents, exactly as the admin shows and exports them.
    quizCollections: quizCollections.map((c) => ({
      key: c.key,
      name: c.name,
      description: c.description,
      instrument: c.instrument,
      enabled: c.enabled,
      songs: c.songs.map((s) => s.data),
    })),
    playlists: playlists.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      coverUrl: keep(p.coverUrl),
      published: p.published,
      sortOrder: p.sortOrder,
      // Songs are named by their audio file, which is unique to each one.
      tracks: p.items.map((i) => i.track.audioUrl),
    })),
    settings: settings.map((s) => ({ key: s.key, value: s.value })),
    // Visitor pins with their moderation status. The submitter's IP hash is not exported.
    recommendations: recommendations.map((r) => ({ kind: r.kind, name: r.name, title: r.title, reason: r.reason, link: r.link, status: r.status, createdAt: r.createdAt })),
  };

  await writeFile(path.join(serverRoot, "prisma", "seed-data.json"), `${JSON.stringify(data, null, 2)}\n`);

  // Start the copied files from scratch, so deleted songs do not linger.
  const target = path.join(serverRoot, "seed", "uploads");
  await rm(target, { recursive: true, force: true });
  let copied = 0;
  let missing = 0;
  for (const url of files) {
    const from = path.join(serverRoot, url);
    const to = path.join(serverRoot, "seed", url);
    try {
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);
      copied++;
    } catch {
      missing++;
      console.warn(`Missing file, skipped: ${url}`);
    }
  }

  console.log(
    `Exported ${data.tracks.length} songs, ${data.movies.length} movies, ${data.quizCollections.length} quiz collections, ` +
      `${data.playlists.length} playlists, ${data.settings.length} settings, ${data.recommendations.length} recommendations, and ${copied} files` +
      (missing ? ` (${missing} missing)` : "") +
      "."
  );
}

main().finally(() => prisma.$disconnect());
