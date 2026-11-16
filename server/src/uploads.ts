import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Uploaded files live here, next to the server code, and are served at /uploads. */
export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");

export type UploadKind = "audio" | "image";

export const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  audio: 40 * 1024 * 1024,
  image: 8 * 1024 * 1024,
};

type Sniffed = { kind: UploadKind; ext: string } | null;

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

/**
 * Works out what a file really is from its first bytes, ignoring the name and
 * the type the browser claimed. Only the audio and image formats the site can
 * use are accepted.
 */
export function sniff(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;

  // Images
  if (buf[0] === 0x89 && ascii(buf, 1, 4) === "PNG") return { kind: "image", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "image", ext: "jpg" };
  if (ascii(buf, 0, 4) === "GIF8") return { kind: "image", ext: "gif" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { kind: "image", ext: "webp" };
  if (ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12);
    if (brand === "avif" || brand === "avis") return { kind: "image", ext: "avif" };
    // Everything else with an ftyp box is treated as an MP4-family audio file (m4a, mp4 audio).
    return { kind: "audio", ext: "m4a" };
  }

  // Audio
  if (ascii(buf, 0, 3) === "ID3") return { kind: "audio", ext: "mp3" };
  if (buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0) return { kind: "audio", ext: "mp3" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WAVE") return { kind: "audio", ext: "wav" };
  if (ascii(buf, 0, 4) === "OggS") return { kind: "audio", ext: "ogg" };
  if (ascii(buf, 0, 4) === "fLaC") return { kind: "audio", ext: "flac" };

  return null;
}

/** A tidy, safe file name stem taken from what the visitor uploaded. */
function stem(original: string): string {
  const base = path.basename(original).replace(/\.[^.]*$/, "");
  const slug = base
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  return slug || "file";
}

/** Saves the bytes and returns the site path they are served from. */
export async function saveUpload(buf: Buffer, ext: string, kind: UploadKind, originalName: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, kind === "audio" ? "audio" : "images");
  await mkdir(dir, { recursive: true });
  const name = `${stem(originalName)}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${kind === "audio" ? "audio" : "images"}/${name}`;
}

const UPLOADED_PATH = /^\/uploads\/(audio|images)\/[\w.-]+$/;

/** Deletes an uploaded file from disk. Ignores anything that is not one of our uploads. */
export async function removeUpload(url: string | null | undefined): Promise<void> {
  if (!url || !UPLOADED_PATH.test(url) || url.includes("..")) return;
  try {
    await unlink(path.join(UPLOAD_DIR, url.replace("/uploads/", "")));
  } catch {
    // Already gone: nothing to do.
  }
}
