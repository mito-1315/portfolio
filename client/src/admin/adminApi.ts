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

/** JSON request to the API. Sends the admin token when there is one. */
export async function call<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      data?.issues && typeof data.issues === "object"
        ? Object.entries(data.issues)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
            .join("; ")
        : "";
    throw new ApiError(response.status, [data?.error, detail].filter(Boolean).join(" — ") || "Request failed");
  }
  return data as T;
}
