import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(Number(process.env.PORT) || 4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_TOKEN_SECRET: z.string().min(16),
  IP_HASH_SALT: z.string().min(8),
  // Optional: only needed for the admin's Spotify song lookup.
  // Optional: Google sign-in for the admin page. Both are needed to turn it on.
  GOOGLE_CLIENT_ID: z.string().optional(),
  /** Comma-separated Google accounts allowed to sign in to the admin page. */
  ADMIN_GOOGLE_EMAILS: z.string().optional(),
  /** Set to "1" to keep the password login working next to Google. */
  ALLOW_PASSWORD_LOGIN: z.string().optional(),
  // Optional: a proper search service for the admin's "Find notes online". Without one, DuckDuckGo's results page is read.
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_CSE_KEY: z.string().optional(),
  GOOGLE_CSE_ID: z.string().optional(),
  // Guess the Song is built but switched off. Set to "1" to serve its routes again.
  GUESS_THE_SONG: z.string().optional(),
  // Optional: Cloudflare R2 for uploaded files (Heroku's disk is wiped on every restart). All five are needed.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  /** Public address of the bucket, e.g. https://files.example.com (no trailing slash). */
  R2_PUBLIC_URL: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`Invalid environment. Check these in server/.env: ${missing}`);
  process.exit(1);
}

export const config = parsed.data;
