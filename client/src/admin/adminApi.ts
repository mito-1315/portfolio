/**
 * The admin session lives in an HttpOnly cookie that the browser sends by
 * itself, so no script here ever holds a password or token. Writes carry a
 * header that other websites cannot add.
 */
const ADMIN_HEADER = { "X-Admin-Request": "1" };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** What the person at the keyboard should do, for each way the API can be unavailable. */
export const OFFLINE_MESSAGE =
  "Can't reach the API. Start it with `npm run dev` from the project folder (or `npm run dev` inside server/), then try again.";

/** JSON request to the API. Sends the admin token when there is one. */
export async function call<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...ADMIN_HEADER,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // The request never reached a server: offline, or the API is stopped.
    throw new ApiError(0, OFFLINE_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // The dev proxy (or a gateway) answered for an API that is not running.
    // Only the dev proxy's own answer (or an empty one) means the API is down; other messages are real.
    if ((response.status === 502 || response.status === 503 || response.status === 504) && (!data?.error || data.error === "The API is not running")) {
      throw new ApiError(response.status, OFFLINE_MESSAGE);
    }
    const detail =
      data?.issues && typeof data.issues === "object"
        ? Object.entries(data.issues)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
            .join("; ")
        : "";
    throw new ApiError(
      response.status,
      [data?.error, detail].filter(Boolean).join(" — ") || `The server answered ${response.status}`
    );
  }
  return (data ?? {}) as T;
}

export type ApiHealth = "checking" | "up" | "database-down" | "offline";

/** Asks the API how it is. Never throws. */
export async function checkHealth(): Promise<ApiHealth> {
  try {
    const response = await fetch("/api/health");
    const data = await response.json().catch(() => null);
    if (response.ok && data?.status === "ok") return "up";
    if (data?.database === "down") return "database-down";
    return "offline";
  } catch {
    return "offline";
  }
}

export type UploadKind = "audio" | "image";

/** What the audio file says about itself, when it carries tags. */
export type FileTags = { title?: string; artist?: string; album?: string; year?: number; durationMs?: number };

export type UploadResult = { url: string; tags?: FileTags };

/** A song found on Spotify's catalogue. */
export type SpotifyMatch = {
  spotifyId: string;
  spotifyUrl: string;
  title: string;
  artist: string;
  album: string;
  releaseDate: string;
  durationMs: number;
  artworkUrl: string | null;
};

/** Sends one file to the server and returns the site path it is now served from. */
export async function uploadFile(file: File, kind: UploadKind): Promise<UploadResult> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/upload?kind=${kind}&filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        ...ADMIN_HEADER,
        "Content-Type": "application/octet-stream",
      },
      body: file,
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if ((response.status === 502 || response.status === 503 || response.status === 504) && (!data?.error || data.error === "The API is not running")) {
      throw new ApiError(response.status, OFFLINE_MESSAGE);
    }
    throw new ApiError(response.status, data?.error ?? `The server answered ${response.status}`);
  }
  return { url: String(data?.url ?? ""), ...(data?.tags ? { tags: data.tags as FileTags } : {}) };
}

export type SessionInfo = {
  authenticated: boolean;
  email: string | null;
  /** Present when Google sign-in is set up. */
  google: { clientId: string } | null;
  /** Whether the password form should be offered. */
  password: boolean;
};

/** Who is signed in, and how the login page should offer to sign in. Null if the API is unreachable. */
export async function getSession(): Promise<SessionInfo | null> {
  try {
    const response = await fetch("/api/admin/session", { credentials: "same-origin" });
    if (!response.ok) return null;
    return (await response.json()) as SessionInfo;
  } catch {
    return null;
  }
}

export async function signOutRequest(): Promise<void> {
  try {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin", headers: ADMIN_HEADER });
  } catch {
    // Offline: the cookie simply expires on its own.
  }
}
