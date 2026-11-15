import { createHash } from "node:crypto";
import cors from "cors";
import express from "express";
import type { ErrorRequestHandler, Request } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { checkAdminPassword, issueAdminToken, requireAdmin } from "./auth.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), "Must be an http(s) URL or a site path");

const trackInput = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  audioUrl: httpUrl,
  coverUrl: httpUrl.nullish(),
  clipStart: z.number().int().min(0).max(3600).optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
  playlistId: z.number().int().nullish(),
});

const playlistInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(60),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  sortOrder: z.number().int().optional(),
});

const movieInput = z.object({
  title: z.string().trim().min(1).max(200),
  year: z.number().int().min(1888).max(2100).nullish(),
  director: z.string().trim().max(120).nullish(),
  posterUrl: httpUrl.nullish(),
  note: z.string().trim().max(400).nullish(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

/** Notes text such as "C4:1 D#4:0.5 R:1": note name, colon, beats. */
const notesText = z
  .string()
  .trim()
  .min(3)
  .max(1200)
  .refine(
    (value) => value.split(/\s+/).every((token) => /^(R|[A-G][#b]?\d):\d+(\.\d+)?$/.test(token)),
    "Use note:beats pairs like C4:1 D#4:0.5 R:1"
  );

const melodyInput = z.object({
  title: z.string().trim().min(1).max(120),
  composer: z.string().trim().min(1).max(120),
  difficulty: z.number().int().min(1).max(3).optional(),
  notes: notesText,
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
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "20kb" }));
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

  app.get("/api/music/playlists", async (_req, res) => {
    res.json(
      await prisma.playlist.findMany({ orderBy: { sortOrder: "asc" } })
    );
  });

  app.get("/api/music/tracks", async (req, res) => {
    const playlist = typeof req.query.playlist === "string" ? req.query.playlist : undefined;
    res.json(
      await prisma.track.findMany({
        where: { published: true, ...(playlist ? { playlist: { slug: playlist } } : {}) },
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

  app.get("/api/melodies", async (_req, res) => {
    res.json(
      await prisma.melody.findMany({
        where: { published: true },
        orderBy: { id: "asc" },
        select: { id: true, title: true, composer: true, difficulty: true, notes: true },
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

  app.post("/api/admin/login", loginLimiter, (req, res) => {
    const parsed = z.object({ password: z.string().max(200) }).safeParse(req.body);
    if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.json({ token: issueAdminToken() });
  });

  const admin = express.Router();
  admin.use(requireAdmin);

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

  admin.get("/tracks", async (_req, res) => {
    res.json(await prisma.track.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }));
  });
  admin.post("/tracks", async (req, res) => {
    res.status(201).json(await prisma.track.create({ data: clean(trackInput.parse(req.body)) }));
  });
  admin.put("/tracks/:id", async (req, res) => {
    const data = clean(trackInput.partial().parse(req.body));
    res.json(await prisma.track.update({ where: { id: idParam.parse(req.params.id) }, data }));
  });
  admin.delete("/tracks/:id", async (req, res) => {
    await prisma.track.delete({ where: { id: idParam.parse(req.params.id) } });
    res.status(204).end();
  });

  admin.post("/playlists", async (req, res) => {
    res.status(201).json(await prisma.playlist.create({ data: clean(playlistInput.parse(req.body)) }));
  });
  admin.put("/playlists/:id", async (req, res) => {
    const data = clean(playlistInput.partial().parse(req.body));
    res.json(await prisma.playlist.update({ where: { id: idParam.parse(req.params.id) }, data }));
  });
  admin.delete("/playlists/:id", async (req, res) => {
    await prisma.playlist.delete({ where: { id: idParam.parse(req.params.id) } });
    res.status(204).end();
  });

  admin.get("/movies", async (_req, res) => {
    res.json(await prisma.movie.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }));
  });
  admin.post("/movies", async (req, res) => {
    res.status(201).json(await prisma.movie.create({ data: clean(movieInput.parse(req.body)) }));
  });
  admin.put("/movies/:id", async (req, res) => {
    const data = clean(movieInput.partial().parse(req.body));
    res.json(await prisma.movie.update({ where: { id: idParam.parse(req.params.id) }, data }));
  });
  admin.delete("/movies/:id", async (req, res) => {
    await prisma.movie.delete({ where: { id: idParam.parse(req.params.id) } });
    res.status(204).end();
  });

  admin.get("/melodies", async (_req, res) => {
    res.json(await prisma.melody.findMany({ orderBy: { id: "asc" } }));
  });
  admin.post("/melodies", async (req, res) => {
    res.status(201).json(await prisma.melody.create({ data: clean(melodyInput.parse(req.body)) }));
  });
  admin.put("/melodies/:id", async (req, res) => {
    const data = clean(melodyInput.partial().parse(req.body));
    res.json(await prisma.melody.update({ where: { id: idParam.parse(req.params.id) }, data }));
  });
  admin.delete("/melodies/:id", async (req, res) => {
    await prisma.melody.delete({ where: { id: idParam.parse(req.params.id) } });
    res.status(204).end();
  });

  admin.put("/settings/:key", async (req, res) => {
    const key = z.string().regex(/^[a-z0-9_.-]{1,60}$/).parse(req.params.key);
    const { value } = z.object({ value: z.string().max(500) }).parse(req.body);
    res.json(
      await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    );
  });

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
