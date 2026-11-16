import express from "express";
import type { Express, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { blankTemplate, checkFile, checkSong, FORMAT_VERSION, orderedSong, songBeats } from "./format.js";
import type { QuizSongDoc } from "./format.js";
import { findNotes } from "./finder.js";

const idParam = z.coerce.number().int().positive();
const bigJson = express.json({ limit: "6mb" });

const collectionInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  instrument: z.string().trim().min(1).max(40).default("acoustic_piano"),
  enabled: z.boolean().optional(),
});

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "collection";

async function uniqueKey(base: string): Promise<string> {
  for (let n = 1; n < 200; n++) {
    const key = n === 1 ? base : `${base}_${n}`;
    if (!(await prisma.quizCollection.findUnique({ where: { key } }))) return key;
  }
  return `${base}_${Date.now()}`;
}

/** The few columns that mirror a song document, for listing and filtering. */
const rowOf = (doc: QuizSongDoc) => ({
  songId: doc.id,
  title: doc.title.trim(),
  movie: doc.movie.trim(),
  difficulty: doc.difficulty,
  enabled: doc.quiz.enabled,
  data: doc as unknown as Prisma.InputJsonValue,
});

const docOf = (value: unknown) => orderedSong(value);

const summarise = (row: { id: number; songId: string; title: string; movie: string; difficulty: string; enabled: boolean; sortOrder: number; updatedAt: Date; data: unknown }) => {
  const doc = docOf(row.data);
  return {
    id: row.id,
    songId: row.songId,
    title: row.title,
    movie: row.movie,
    difficulty: row.difficulty,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    tempo: doc.music.tempo,
    timeSignature: `${doc.music.timeSignature.numerator}/${doc.music.timeSignature.denominator}`,
    key: doc.music.key ?? "",
    noteCount: doc.notes.length,
    beats: songBeats(doc),
  };
};

async function collectionStats(id: number) {
  const songs = await prisma.quizSong.findMany({ where: { collectionId: id }, select: { difficulty: true, enabled: true, updatedAt: true } });
  const count = (d: string) => songs.filter((s) => s.difficulty === d).length;
  return {
    total: songs.length,
    enabledCount: songs.filter((s) => s.enabled).length,
    easy: count("easy"),
    medium: count("medium"),
    hard: count("hard"),
    lastSongUpdate: songs.reduce<Date | null>((latest, s) => (!latest || s.updatedAt > latest ? s.updatedAt : latest), null),
  };
}

export function mountQuiz(app: Express, admin: Router) {
  // Whole song files are bigger than the general 20 KB limit, so every quiz admin route reads its own.
  admin.use("/quiz", bigJson);

  // ---------- Public: what the game plays ----------

  app.get("/api/quiz/songs", async (req, res) => {
    const difficulty = z.enum(["easy", "medium", "hard"]).safeParse(req.query.difficulty);
    const rows = await prisma.quizSong.findMany({
      where: { enabled: true, collection: { enabled: true }, ...(difficulty.success ? { difficulty: difficulty.data } : {}) },
      orderBy: [{ collectionId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { data: true, collection: { select: { key: true, name: true } } },
    });
    res.json(rows.map((r) => ({ ...docOf(r.data), collection: r.collection })));
  });

  // ---------- Admin: collections ----------

  admin.get("/quiz/collections", async (_req, res) => {
    const collections = await prisma.quizCollection.findMany({ orderBy: { id: "asc" } });
    res.json(await Promise.all(collections.map(async (c) => ({ ...c, ...(await collectionStats(c.id)) }))));
  });

  admin.post("/quiz/collections", async (req, res) => {
    const data = collectionInput.parse(req.body);
    const created = await prisma.quizCollection.create({ data: { ...data, key: await uniqueKey(slugify(data.name)) } });
    res.status(201).json({ ...created, ...(await collectionStats(created.id)) });
  });

  admin.put("/quiz/collections/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const data = collectionInput.partial().parse(req.body);
    const updated = await prisma.quizCollection.update({ where: { id }, data: { ...data } });
    res.json({ ...updated, ...(await collectionStats(id)) });
  });

  admin.delete("/quiz/collections/:id", async (req, res) => {
    await prisma.quizCollection.delete({ where: { id: idParam.parse(req.params.id) } });
    res.status(204).end();
  });

  // The whole collection as one file in the quiz format.
  admin.get("/quiz/collections/:id/export", async (req, res) => {
    const c = await prisma.quizCollection.findUniqueOrThrow({
      where: { id: idParam.parse(req.params.id) },
      include: { songs: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
    });
    res.json({
      formatVersion: FORMAT_VERSION,
      collection: { id: c.key, name: c.name, description: c.description, instrument: c.instrument, songs: c.songs.map((s) => docOf(s.data)) },
    });
  });

  admin.get("/quiz/template", (_req, res) => {
    res.json(blankTemplate());
  });

  // ---------- Admin: songs ----------

  admin.get("/quiz/collections/:id/songs", async (req, res) => {
    const rows = await prisma.quizSong.findMany({
      where: { collectionId: idParam.parse(req.params.id) },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.json(rows.map(summarise));
  });

  // One song with its complete saved document: the viewer shows exactly this.
  admin.get("/quiz/songs/:rowId", async (req, res) => {
    const row = await prisma.quizSong.findUniqueOrThrow({ where: { id: idParam.parse(req.params.rowId) } });
    res.json({ ...summarise(row), data: docOf(row.data) });
  });

  admin.post("/quiz/validate-song", bigJson, (req, res) => {
    res.json(checkSong((req.body as { song?: unknown }).song, 0));
  });

  admin.post("/quiz/collections/:id/songs", bigJson, async (req, res) => {
    const collectionId = idParam.parse(req.params.id);
    const report = checkSong((req.body as { song?: unknown }).song, 0);
    if (!report.ok) {
      res.status(422).json({ error: "This song has problems that need fixing first.", report });
      return;
    }
    const doc = (req.body as { song: QuizSongDoc }).song;
    if (await prisma.quizSong.findUnique({ where: { collectionId_songId: { collectionId, songId: doc.id } } })) {
      res.status(409).json({ error: `A song with the id "${doc.id}" already exists in this collection.`, report });
      return;
    }
    const last = await prisma.quizSong.aggregate({ where: { collectionId }, _max: { sortOrder: true } });
    const row = await prisma.quizSong.create({ data: { collectionId, ...rowOf(doc), sortOrder: (last._max.sortOrder ?? -1) + 1 } });
    res.status(201).json({ ...summarise(row), report });
  });

  admin.put("/quiz/songs/:rowId", bigJson, async (req, res) => {
    const rowId = idParam.parse(req.params.rowId);
    const report = checkSong((req.body as { song?: unknown }).song, 0);
    if (!report.ok) {
      res.status(422).json({ error: "This song has problems that need fixing first.", report });
      return;
    }
    const doc = (req.body as { song: QuizSongDoc }).song;
    const current = await prisma.quizSong.findUniqueOrThrow({ where: { id: rowId } });
    const clash = await prisma.quizSong.findUnique({ where: { collectionId_songId: { collectionId: current.collectionId, songId: doc.id } } });
    if (clash && clash.id !== rowId) {
      res.status(409).json({ error: `Another song in this collection already has the id "${doc.id}".`, report });
      return;
    }
    const row = await prisma.quizSong.update({ where: { id: rowId }, data: rowOf(doc) });
    await prisma.quizCollection.update({ where: { id: current.collectionId }, data: {} });
    res.json({ ...summarise(row), report });
  });

  admin.patch("/quiz/songs/:rowId", async (req, res) => {
    const rowId = idParam.parse(req.params.rowId);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const current = await prisma.quizSong.findUniqueOrThrow({ where: { id: rowId } });
    const doc = docOf(current.data);
    // The flag lives in the document too, so an export always matches what visitors get.
    const updated = { ...doc, quiz: { ...doc.quiz, enabled } };
    const row = await prisma.quizSong.update({ where: { id: rowId }, data: { enabled, data: updated as unknown as Prisma.InputJsonValue } });
    res.json(summarise(row));
  });

  admin.delete("/quiz/songs/:rowId", async (req, res) => {
    await prisma.quizSong.delete({ where: { id: idParam.parse(req.params.rowId) } });
    res.status(204).end();
  });

  // ---------- Admin: checking and importing a file ----------

  // Reads a file and reports on every song, without saving anything.
  admin.post("/quiz/validate", bigJson, async (req, res) => {
    const body = req.body as { json?: unknown; collectionId?: unknown };
    const report = checkFile(body.json);
    const collectionId = Number(body.collectionId);
    let existing = new Set<string>();
    if (Number.isInteger(collectionId) && collectionId > 0) {
      const rows = await prisma.quizSong.findMany({ where: { collectionId }, select: { songId: true } });
      existing = new Set(rows.map((r) => r.songId));
    }
    res.json({ ...report, songs: report.songs.map((s) => ({ ...s, exists: existing.has(s.id) })) });
  });

  admin.post("/quiz/import", bigJson, async (req, res) => {
    const body = z
      .object({
        json: z.unknown(),
        target: z.union([z.literal("file"), z.number().int().positive()]),
        duplicates: z.enum(["skip", "replace", "new"]).default("skip"),
        songIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const report = checkFile(body.json);
    if (report.fileErrors.length > 0 || !report.collection) {
      res.status(422).json({ error: "The file itself has problems, so nothing was imported.", report });
      return;
    }
    const file = body.json as { collection: { songs: QuizSongDoc[] } };

    // Where the songs go: an existing collection, or the one the file describes (made if it is new).
    let collection;
    if (body.target === "file") {
      collection =
        (await prisma.quizCollection.findUnique({ where: { key: report.collection.id } })) ??
        (await prisma.quizCollection.create({
          data: { key: report.collection.id, name: report.collection.name, description: report.collection.description, instrument: report.collection.instrument },
        }));
    } else {
      collection = await prisma.quizCollection.findUniqueOrThrow({ where: { id: body.target } });
    }

    const chosen = body.songIds ? new Set(body.songIds) : null;
    const last = await prisma.quizSong.aggregate({ where: { collectionId: collection.id }, _max: { sortOrder: true } });
    let order = (last._max.sortOrder ?? -1) + 1;

    type Result = { index: number; id: string; title: string; action: "imported" | "replaced" | "skipped" | "failed"; newId?: string; reason?: string };
    const results: Result[] = [];

    for (const song of report.songs) {
      const base = { index: song.index, id: song.id, title: song.title };
      if (!song.ok) {
        results.push({ ...base, action: "failed", reason: song.errors[0] ? `${song.errors[0].path}: ${song.errors[0].message}` : "Did not validate." });
        continue;
      }
      if (chosen && !chosen.has(song.id)) {
        results.push({ ...base, action: "skipped", reason: "Not selected." });
        continue;
      }
      const doc = file.collection.songs[song.index]!;
      const existing = await prisma.quizSong.findUnique({ where: { collectionId_songId: { collectionId: collection.id, songId: doc.id } } });

      if (!existing) {
        await prisma.quizSong.create({ data: { collectionId: collection.id, ...rowOf(doc), sortOrder: order++ } });
        results.push({ ...base, action: "imported" });
      } else if (body.duplicates === "skip") {
        results.push({ ...base, action: "skipped", reason: "A song with this id already exists." });
      } else if (body.duplicates === "replace") {
        await prisma.quizSong.update({ where: { id: existing.id }, data: rowOf(doc) });
        results.push({ ...base, action: "replaced" });
      } else {
        // Keep both: the new one gets a fresh id.
        let n = 2;
        let newId = `${doc.id}_${n}`;
        while (await prisma.quizSong.findUnique({ where: { collectionId_songId: { collectionId: collection.id, songId: newId } } })) newId = `${doc.id}_${++n}`;
        await prisma.quizSong.create({ data: { collectionId: collection.id, ...rowOf({ ...doc, id: newId }), sortOrder: order++ } });
        results.push({ ...base, action: "imported", newId });
      }
    }
    await prisma.quizCollection.update({ where: { id: collection.id }, data: {} });

    const count = (a: Result["action"]) => results.filter((r) => r.action === a).length;
    res.json({
      collectionId: collection.id,
      summary: {
        validated: report.songs.filter((s) => s.ok).length,
        failedValidation: report.songs.filter((s) => !s.ok).length,
        imported: count("imported"),
        replaced: count("replaced"),
        skipped: count("skipped"),
      },
      results,
      report,
    });
  });

  // ---------- Admin: looking for notes online ----------

  const finderLimit = rateLimit({
    windowMs: 10 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "That's a lot of searches. Please wait a few minutes." },
  });

  admin.post("/quiz/find-notes", finderLimit, async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).max(200),
        movie: z.string().trim().max(200).default(""),
        url: z.string().trim().url().max(500).optional(),
      })
      .parse(req.body);
    try {
      res.json(await findNotes(body));
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : "The search failed." });
    }
  });
}
