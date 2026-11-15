import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", config.ADMIN_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkAdminPassword(password: string): boolean {
  return safeEqual(password, config.ADMIN_PASSWORD);
}

/** Token format: `<expiryMs>.<signature>`. Stateless, expires in 12 hours. */
export function issueAdminToken(): string {
  const expires = String(Date.now() + TOKEN_TTL_MS);
  return `${expires}.${sign(expires)}`;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [expires, signature] = token.split(".");

  const valid =
    expires !== undefined &&
    signature !== undefined &&
    safeEqual(signature, sign(expires)) &&
    Number(expires) > Date.now();

  if (!valid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
