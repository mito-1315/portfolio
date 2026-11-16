import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "./config.js";

/**
 * Admin sign-in. The browser holds a signed session in an HttpOnly cookie, so
 * page scripts can never read it. Google sign-in is the main way in; the
 * password is only a fallback while Google is not set up (or if explicitly kept).
 */

export const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Sent by the admin page on every write; a form on another site cannot add it. */
export const CSRF_HEADER = "x-admin-request";

const allowedEmails = (config.ADMIN_GOOGLE_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const googleEnabled = Boolean(config.GOOGLE_CLIENT_ID && allowedEmails.length > 0);
export const passwordAllowed = !googleEnabled || config.ALLOW_PASSWORD_LOGIN === "1";

type Session = { exp: number; email: string; via: "google" | "password" };

function sign(payload: string): string {
  return createHmac("sha256", config.ADMIN_TOKEN_SECRET).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkAdminPassword(password: string): boolean {
  return passwordAllowed && safeEqual(password, config.ADMIN_PASSWORD);
}

const googleClient = new OAuth2Client();

/** Checks a Google ID token and returns the verified email, if that account may sign in. */
export async function verifyGoogleCredential(credential: string): Promise<string | null> {
  if (!googleEnabled || !config.GOOGLE_CLIENT_ID) return null;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    if (!email || payload?.email_verified !== true) return null;
    return allowedEmails.includes(email) ? email : null;
  } catch {
    return null;
  }
}

function makeToken(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token: string): Session | null {
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    return typeof session.exp === "number" && session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

const cookieFlags = () =>
  `Path=/api; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

export function startSession(res: Response, email: string, via: Session["via"]) {
  const token = makeToken({ exp: Date.now() + SESSION_TTL_MS, email, via });
  res.append("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieFlags()}`);
}

export function endSession(res: Response) {
  res.append("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; ${cookieFlags()}`);
}

/** Who is signed in on this request, or null. */
export function currentSession(req: Request): Session | null {
  return readToken(readCookie(req, COOKIE_NAME));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = currentSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Anything that changes data must come from the admin page itself.
  const safeMethod = req.method === "GET" || req.method === "HEAD";
  if (!safeMethod && req.headers[CSRF_HEADER] !== "1") {
    res.status(403).json({ error: "Request not allowed" });
    return;
  }
  next();
}
