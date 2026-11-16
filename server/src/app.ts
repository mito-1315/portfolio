import { createHash } from "node:crypto";
import cors from "cors";
import express from "express";
import type { ErrorRequestHandler, Request } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import {
  checkAdminPassword,
  currentSession,
  endSession,
  googleEnabled,
  passwordAllowed,
  requireAdmin,
  startSession,
  verifyGoogleCredential,
} from "./auth.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { parseBuffer } from "music-metadata";
import { MAX_UPLOAD_BYTES, removeUpload, saveUpload, sniff, UPLOAD_DIR } from "./uploads.js";
import { mountQuiz } from "./quiz/routes.js";
import { getTrack, parseTrackId, searchTracks, SpotifyError, spotifyConfigured } from "./spotify.js";

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), "Must be an http(s) URL or a site path");

/** The five moods of the entry screen. Every track belongs to one. */
const moodName = z.enum(["Calm", "Focused", "Energetic", "Nostalgic", "Curious"]);

const trackInput = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  audioUrl: httpUrl,
  coverUrl: httpUrl.nullish(),
  mood: moodName,
  description: z.string().trim().max(500).nullish(),
  album: z.string().trim().max(200).nullish(),
  releaseDate: z.string().trim().max(10).nullish(),
  spotifyId: z.string().trim().regex(/^[A-Za-z0-9]{22}$/).nullish(),
  spotifyUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => /^https:\/\/open\.spotify\.com\//.test(v), "Must be an open.spotify.com link")
    .nullish(),
  durationMs: z.number().int().min(0).max(36_000_000).nullish(),
  clipStart: z.number().int().min(0).max(3600).optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
  playlistId: z.number().int().nullish(),
});

const playlistInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  coverUrl: httpUrl.nullish(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * Deletes an uploaded file once nothing uses it any more. The same picture can
 * be a song's artwork and a playlist's poster, so it must not go while either
 * still points at it. Call this after the row that held the file was changed.
 */
async function releaseUpload(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const [tracks, playlists, movies] = await Promise.all([
    prisma.track.count({ where: { OR: [{ audioUrl: url }, { coverUrl: url }] } }),
    prisma.playlist.count({ where: { coverUrl: url } }),
    prisma.movie.count({ where: { posterUrl: url } }),
  ]);
  if (tracks + playlists + movies === 0) await removeUpload(url);
}

/** A url-safe name for a playlist, made unique by adding a number if needed. */
async function uniqueSlug(name: string, ignoreId?: number): Promise<string> {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "playlist";
  for (let n = 1; n < 200; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await prisma.playlist.findUnique({ where: { slug } });
    if (!clash || clash.id === ignoreId) return slug;
  }
  return `${base}-${Date.now()}`;
}

const movieInput = z.object({
  title: z.string().trim().min(1).max(200),
  year: z.number().int().min(1888).max(2100).nullish(),
  director: z.string().trim().max(120).nullish(),
  posterUrl: httpUrl.nullish(),
  note: z.string().trim().max(400).nullish(),
  placement: z.enum(["auto", "about", "skills", "projects", "experience", "leadership", "music", "recommend", "contact"]).optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

const recommendationInput = z.object({
  kind: z.enum(["SONG", "MOVIE", "OTHER"]),
  name: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(3).max(300),
  link: z
    .string()
    .trim()
    .max(300)
    .refine((v) => /^https?:\/\//i.test(v), "Link must start with http:// or https://")
    .optional(),
  /** Honeypot. Real visitors never see or fill this field. */
  website: z.string().max(0).optional(),
});

const idParam = z.coerce.number().int().positive();

function hashIp(req: Request): string {
  return createHash("sha256")
    .update(`${config.IP_HASH_SALT}:${req.ip ?? ""}`)
    .digest("hex");
}

/** Strip `undefined` so Prisma's exactOptionalPropertyTypes stays happy. */
function clean<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as T;
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  // One line per API call: method, path, status and time. Easy to see what the site is asking for.
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (!req.originalUrl.startsWith("/api")) return;
      const ms = Date.now() - started;
      const line = `${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${ms}ms`;
      if (res.statusCode >= 500) console.error(line);
      else if (res.statusCode >= 400) console.warn(line);
      else if (process.env.LOG_REQUESTS === "1") console.log(line);
    });
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  // Small bodies everywhere, except the quiz admin routes, which take whole song files and set their own limit.
  const smallJson = express.json({ limit: "20kb" });
  app.use((req, res, next) => (req.path.startsWith("/api/admin/quiz") ? next() : smallJson(req, res, next)));

  // Files uploaded from the admin page.
  // "private": browsers cache these, but a CDN in front (Vercel) must not store partial (Range) replies and serve them for every request.
  app.use("/uploads", express.static(UPLOAD_DIR, { index: false, cacheControl: false, setHeaders: (res) => res.setHeader("Cache-Control", "private, max-age=604800") }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

  const submitLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many submissions. Please try again later." },
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    message: { error: "Too many attempts. Please try again later." },
  });

  // ---------- Public ----------

  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "up" });
    } catch {
      res.status(503).json({ status: "degraded", database: "down" });
    }
  });

  // The owner's playlists for the secret window. Visitors only get the ones marked visible;
  // the signed-in owner gets all of them, including songs switched off on the site.
  app.get("/api/music/playlists", async (req, res) => {
    const owner = Boolean(currentSession(req));
    const lists = await prisma.playlist.findMany({
      where: owner ? {} : { published: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        items: {
          orderBy: { position: "asc" },
          where: owner ? {} : { track: { published: true } },
          include: { track: true },
        },
      },
    });
    res.json(
      lists.map(({ items, ...list }) => ({
        ...list,
        private: !list.published,
        tracks: items.map((item) => item.track),
      }))
    );
  });

  app.get("/api/music/tracks", async (req, res) => {
    const mood = moodName.safeParse(req.query.mood);
    res.json(
      await prisma.track.findMany({
        where: {
          published: true,
          ...(mood.success ? { mood: mood.data } : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      })
    );
  });

  app.get("/api/movies", async (_req, res) => {
    res.json(
      await prisma.movie.findMany({
        where: { published: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      })
    );
  });

  app.get("/api/settings", async (_req, res) => {
    const rows = await prisma.siteSetting.findMany();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  });

  // Only approved items, and never the IP hash.
  app.get("/api/recommendations", async (_req, res) => {
    res.json(
      await prisma.recommendation.findMany({
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, kind: true, name: true, title: true, reason: true, link: true, createdAt: true },
      })
    );
  });

  app.post("/api/recommendations", submitLimiter, async (req, res) => {
    // Bots that fill the hidden field get a fake success and nothing is stored.
    if (typeof req.body?.website === "string" && req.body.website.length > 0) {
      res.status(201).json({ message: "Thanks! Your recommendation will appear once it is approved." });
      return;
    }
    const parsed = recommendationInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid submission", issues: parsed.error.flatten().fieldErrors });
      return;
    }
    const { website: _honeypot, ...data } = parsed.data;
    await prisma.recommendation.create({ data: { ...clean(data), ipHash: hashIp(req) } });
    res.status(201).json({ message: "Thanks! Your recommendation will appear once it is approved." });
  });

  // ---------- Admin ----------

  // Who is signed in, and which sign-in methods the login page should offer.
  // Public on purpose: the login page needs it, and the site uses it to know if the owner is browsing.
  app.get("/api/admin/session", (req, res) => {
    const session = currentSession(req);
    res.json({
      authenticated: Boolean(session),
      email: session?.email ?? null,
      google: googleEnabled ? { clientId: config.GOOGLE_CLIENT_ID } : null,
      password: passwordAllowed,
    });
  });

  app.post("/api/admin/google", loginLimiter, async (req, res) => {
    const parsed = z.object({ credential: z.string().min(20).max(5000) }).safeParse(req.body);
    const email = parsed.success ? await verifyGoogleCredential(parsed.data.credential) : null;
    if (!email) {
      res.status(401).json({ error: "That Google account isn't allowed to sign in here" });
      return;
    }
    startSession(res, email, "google");
    res.json({ email });
  });

  app.post("/api/admin/login", loginLimiter, (req, res) => {
    const parsed = z.object({ password: z.string().max(200) }).safeParse(req.body);
    if (!passwordAllowed) {
      res.status(403).json({ error: "Password sign-in is switched off. Use Google." });
      return;
    }
    if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    startSession(res, "password", "password");
    res.json({ email: "password" });
  });

  app.post("/api/admin/logout", (req, res) => {
    // A cross-site page must not be able to sign the owner out.
    if (req.headers["x-admin-request"] !== "1") {
      res.status(403).json({ error: "Request not allowed" });
      return;
    }
    endSession(res);
    res.status(204).end();
  });

  const admin = express.Router();
  admin.use(requireAdmin);

  // One file per request, sent as the raw request body. The kind of file is checked
  // from its own bytes, not from its name.
  admin.post(
    "/upload",
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES.audio }),
    async (req, res) => {
      const { kind, filename } = z
        .object({ kind: z.enum(["audio", "image"]), filename: z.string().max(200).default("file") })
        .parse(req.query);
      const body: unknown = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "No file was received" });
        return;
      }
      const found = sniff(body);
      if (!found || found.kind !== kind) {
        res.status(415).json({
          error:
            kind === "audio"
              ? "That is not a supported audio file (use MP3, M4A, WAV, OGG or FLAC)"
              : "That is not a supported image (use JPG, PNG, WebP, GIF or AVIF)",
        });
        return;
      }
      if (body.length > MAX_UPLOAD_BYTES[kind]) {
        res.status(413).json({ error: `That file is too large (limit ${MAX_UPLOAD_BYTES[kind] / 1024 / 1024} MB)` });
        return;
      }
      const url = await saveUpload(body, found.ext, kind, filename);

      // Songs often carry their own title and artist. Read them so the admin can look the song up.
      let tags: { title?: string; artist?: string; album?: string; year?: number; durationMs?: number } | undefined;
      if (kind === "audio") {
        try {
          const { common, format } = await parseBuffer(body);
          tags = {
            ...(common.title ? { title: common.title } : {}),
            ...(common.artist ? { artist: common.artist } : {}),
            ...(common.album ? { album: common.album } : {}),
            ...(common.year ? { year: common.year } : {}),
            ...(format.duration ? { durationMs: Math.round(format.duration * 1000) } : {}),
          };
        } catch {
          // No readable tags: the admin can still search by hand.
        }
      }
      res.status(201).json({ url, ...(tags ? { tags } : {}) });
    }
  );

  // Spotify song lookup: search by words, or paste a track link.
  admin.get("/spotify/status", (_req, res) => {
    res.json({ configured: spotifyConfigured() });
  });
  admin.get("/spotify/search", async (req, res) => {
    const q = z.string().trim().min(2).max(200).parse(req.query.q);
    // A pasted link is looked up directly; anything else is a search.
    const id = parseTrackId(q);
    res.json(id ? [await getTrack(id)] : await searchTracks(q));
  });

  admin.get("/recommendations", async (req, res) => {
    const status = z.enum(["PENDING", "APPROVED", "REJECTED"]).safeParse(req.query.status);
    res.json(
      await prisma.recommendation.findMany({
        where: status.success ? { status: status.data } : {},
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    );
  });

  admin.patch("/recommendations/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { status } = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]) }).parse(req.body);
    res.json(await prisma.recommendation.update({ where: { id }, data: { status } }));
  });

  admin.delete("/recommendations/:id", async (req, res) => {
    await prisma.recommendation.delete({ where: { id: idParam.parse(req.params.id) } });
    res.status(204).end();
  });

  // Each song says whether it is liked, which means it is in the Favourites playlist.
  admin.get("/tracks", async (_req, res) => {
    const [tracks, favourites] = await Promise.all([
      prisma.track.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      prisma.playlistItem.findMany({ where: { playlist: { slug: "favourites" } }, select: { trackId: true } }),
    ]);
    const liked = new Set(favourites.map((f) => f.trackId));
    res.json(tracks.map((t) => ({ ...t, liked: liked.has(t.id) })));
  });
  // Liking a song puts it at the end of the Favourites playlist (made on first use); unliking takes it out.
  admin.put("/tracks/:id/favourite", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { liked } = z.object({ liked: z.boolean() }).parse(req.body);
    await prisma.track.findUniqueOrThrow({ where: { id } });
    const list = await prisma.playlist.upsert({
      where: { slug: "favourites" },
      update: {},
      create: { slug: "favourites", name: "Favourites", description: "Songs I liked.", published: false },
    });
    if (liked) {
      const last = await prisma.playlistItem.aggregate({ where: { playlistId: list.id }, _max: { position: true } });
      await prisma.playlistItem.upsert({
        where: { playlistId_trackId: { playlistId: list.id, trackId: id } },
        update: {},
        create: { playlistId: list.id, trackId: id, position: (last._max.position ?? -1) + 1 },
      });
    } else {
      await prisma.playlistItem.deleteMany({ where: { playlistId: list.id, trackId: id } });
    }
    res.json({ liked });
  });
  admin.post("/tracks", async (req, res) => {
    res.status(201).json(await prisma.track.create({ data: clean(trackInput.parse(req.body)) }));
  });
  admin.put("/tracks/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const data = clean(trackInput.partial().parse(req.body));
    const before = await prisma.track.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.track.update({ where: { id }, data });
    // A replaced audio file or cover is no longer needed: free the disk space.
    if (data.audioUrl && data.audioUrl !== before.audioUrl) await releaseUpload(before.audioUrl);
    if (data.coverUrl !== undefined && data.coverUrl !== before.coverUrl) await releaseUpload(before.coverUrl);
    res.json(updated);
  });
  admin.delete("/tracks/:id", async (req, res) => {
    const deleted = await prisma.track.delete({ where: { id: idParam.parse(req.params.id) } });
    await releaseUpload(deleted.audioUrl);
    await releaseUpload(deleted.coverUrl);
    res.status(204).end();
  });
  // Saves a new order: the ids, first to last.
  admin.post("/tracks/reorder", async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.number().int().positive()).max(500) }).parse(req.body);
    await prisma.$transaction(ids.map((id, index) => prisma.track.update({ where: { id }, data: { sortOrder: index } })));
    res.status(204).end();
  });

  const withTrackIds = async (id: number) => {
    const list = await prisma.playlist.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { position: "asc" }, select: { trackId: true } } },
    });
    const { items, ...rest } = list;
    return { ...rest, trackIds: items.map((i) => i.trackId) };
  };

  admin.get("/playlists", async (_req, res) => {
    const lists = await prisma.playlist.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { items: { orderBy: { position: "asc" }, select: { trackId: true } } },
    });
    res.json(lists.map(({ items, ...rest }) => ({ ...rest, trackIds: items.map((i) => i.trackId) })));
  });
  admin.post("/playlists", async (req, res) => {
    const data = clean(playlistInput.parse(req.body));
    const created = await prisma.playlist.create({ data: { ...data, slug: await uniqueSlug(data.name) } });
    res.status(201).json(await withTrackIds(created.id));
  });
  admin.put("/playlists/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const data = clean(playlistInput.partial().parse(req.body));
    const before = await prisma.playlist.findUniqueOrThrow({ where: { id } });
    await prisma.playlist.update({
      where: { id },
      data: { ...data, ...(data.name ? { slug: await uniqueSlug(data.name, id) } : {}) },
    });
    if (data.coverUrl !== undefined && data.coverUrl !== before.coverUrl) await releaseUpload(before.coverUrl);
    res.json(await withTrackIds(id));
  });
  // Replaces the songs in a playlist, in the order given.
  admin.put("/playlists/:id/tracks", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { trackIds } = z.object({ trackIds: z.array(z.number().int().positive()).max(500) }).parse(req.body);
    const unique = [...new Set(trackIds)];
    const known = await prisma.track.findMany({ where: { id: { in: unique } }, select: { id: true } });
    const valid = new Set(known.map((t) => t.id));
    await prisma.$transaction([
      prisma.playlistItem.deleteMany({ where: { playlistId: id } }),
      prisma.playlistItem.createMany({
        data: unique.filter((t) => valid.has(t)).map((trackId, position) => ({ playlistId: id, trackId, position })),
      }),
    ]);
    res.json(await withTrackIds(id));
  });
  admin.delete("/playlists/:id", async (req, res) => {
    const deleted = await prisma.playlist.delete({ where: { id: idParam.parse(req.params.id) } });
    await releaseUpload(deleted.coverUrl);
    res.status(204).end();
  });

  admin.get("/movies", async (_req, res) => {
    res.json(await prisma.movie.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }));
  });
  admin.post("/movies", async (req, res) => {
    res.status(201).json(await prisma.movie.create({ data: clean(movieInput.parse(req.body)) }));
  });
  admin.put("/movies/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const data = clean(movieInput.partial().parse(req.body));
    const before = await prisma.movie.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.movie.update({ where: { id }, data });
    if (data.posterUrl !== undefined && data.posterUrl !== before.posterUrl) await releaseUpload(before.posterUrl);
    res.json(updated);
  });
  admin.post("/movies/reorder", async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.number().int().positive()).max(500) }).parse(req.body);
    await prisma.$transaction(ids.map((id, index) => prisma.movie.update({ where: { id }, data: { sortOrder: index } })));
    res.status(204).end();
  });
  admin.delete("/movies/:id", async (req, res) => {
    const deleted = await prisma.movie.delete({ where: { id: idParam.parse(req.params.id) } });
    await releaseUpload(deleted.posterUrl);
    res.status(204).end();
  });

  admin.put("/settings/:key", async (req, res) => {
    const key = z.string().regex(/^[a-z0-9_.-]{1,60}$/).parse(req.params.key);
    const { value } = z.object({ value: z.string().max(500) }).parse(req.body);
    res.json(
      await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    );
  });

  // Switched off for now: with GUESS_THE_SONG unset there are no quiz routes at all, public or admin.
  if (config.GUESS_THE_SONG === "1") mountQuiz(app, admin);

  app.use("/api/admin", admin);

  // ---------- Errors ----------

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", issues: err.flatten().fieldErrors });
      return;
    }

    if (err instanceof SpotifyError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
    const type = typeof err === "object" && err && "type" in err ? String(err.type) : "";
    const name = typeof err === "object" && err && "name" in err ? String(err.name) : "";

    // Body-parser problems: a bad client, not a broken server.
    if (type === "entity.parse.failed") {
      res.status(400).json({ error: "The request body is not valid JSON" });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ error: "The request body is too large" });
      return;
    }

    // Prisma: record not found, and a duplicate of something that must be unique.
    if (code === "P2025") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (code === "P2002") {
      res.status(409).json({ error: "That already exists" });
      return;
    }

    // The database is down or unreachable: say so, instead of a vague 500.
    // Prisma reports its own codes (P10xx) or the raw network / PostgreSQL code (ECONNREFUSED,
    // 08xxx connection errors, 57Pxx server shutdown, 28P01 bad credentials, 3D000 missing database).
    const databaseDown =
      ["P1001", "P1002", "P1008", "P1017", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH", "28P01", "3D000"].includes(code) ||
      code.startsWith("08") ||
      code.startsWith("57P") ||
      name === "PrismaClientInitializationError";
    if (databaseDown) {
      console.error(`[db] ${req.method} ${req.originalUrl}: database unavailable`);
      res.status(503).json({ error: "The database is unavailable. Please try again shortly." });
      return;
    }

    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ error: "Something went wrong" });
  };
  app.use(onError);

  return app;
}
