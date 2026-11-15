const TOKEN_KEY = "portfolio-admin-token";

export const getToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session just won't persist across reloads */
  }
};

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
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    if ((response.status === 502 || response.status === 503 || response.status === 504) && !data?.error?.includes?.("database")) {
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
