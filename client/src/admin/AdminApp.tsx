import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, call, checkHealth, getToken, setToken, type ApiHealth } from "./adminApi";
import "./Admin.css";

type Row = Record<string, unknown> & { id: number };
type FieldType = "text" | "textarea" | "select" | "number" | "checkbox" | "playlist";
type Field = { key: string; label: string; type: FieldType; required?: boolean; options?: string[] };

type Resource = {
  label: string;
  /** Endpoint used to list rows (admin where it exists). */
  listPath: string;
  /** Endpoint used to create/update/delete rows. */
  writePath: string;
  fields: Field[];
  /** Column(s) shown in the list. */
  summary: (row: Row) => string;
};

const resources: Record<string, Resource> = {
  tracks: {
    label: "Tracks",
    listPath: "/admin/tracks",
    writePath: "/admin/tracks",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "artist", label: "Artist", type: "text", required: true },
      { key: "audioUrl", label: "Audio URL or /path", type: "text", required: true },
      { key: "coverUrl", label: "Cover image URL", type: "text" },
      { key: "playlistId", label: "Playlist", type: "playlist" },
      { key: "sortOrder", label: "Order", type: "number" },
      { key: "published", label: "Published", type: "checkbox" },
    ],
    summary: (r) => `${r.title} — ${r.artist}${r.published === false ? "  (hidden)" : ""}`,
  },
  movies: {
    label: "Movies",
    listPath: "/admin/movies",
    writePath: "/admin/movies",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "year", label: "Year", type: "number" },
      { key: "director", label: "Director", type: "text" },
      { key: "posterUrl", label: "Poster URL or /path", type: "text" },
      { key: "note", label: "Your note", type: "text" },
      { key: "sortOrder", label: "Order", type: "number" },
      { key: "published", label: "Published", type: "checkbox" },
    ],
    summary: (r) =>
      `${r.title}${r.year ? ` (${r.year})` : ""}${r.posterUrl ? "" : "  — no poster"}${
        r.published === false ? "  (hidden)" : ""
      }`,
  },
  melodies: {
    label: "Melodies",
    listPath: "/admin/melodies",
    writePath: "/admin/melodies",
    fields: [
      { key: "title", label: "Song title", type: "text", required: true },
      { key: "composer", label: "Composer or artist", type: "text", required: true },
      { key: "difficulty", label: "Difficulty (1 easy, 2 medium, 3 hard)", type: "number" },
      { key: "notes", label: "Notes, e.g. C4:1 D4:1 E4:2 (R = rest)", type: "text", required: true },
      { key: "published", label: "Published", type: "checkbox" },
    ],
    summary: (r) => `${r.title} — ${r.composer}  (level ${r.difficulty ?? 2})${r.published === false ? "  (hidden)" : ""}`,
  },
  playlists: {
    label: "Playlists",
    listPath: "/music/playlists",
    writePath: "/admin/playlists",
    fields: [
      { key: "slug", label: "Slug (a-z, 0-9, -)", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "text" },
      { key: "sortOrder", label: "Order", type: "number" },
    ],
    summary: (r) => `${r.name}  /${r.slug}`,
  },
};

const TABS = [...Object.keys(resources), "recommendations", "settings"] as const;
type Tab = (typeof TABS)[number];

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/* ---------- Login ---------- */

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<ApiHealth>("checking");

  const recheck = useCallback(() => {
    setHealth("checking");
    checkHealth().then(setHealth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await call<{ token: string }>("POST", "/admin/login", { password });
      setToken(token);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <span className="admin-label">ADMIN</span>
        <h1>Sign in</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <button type="submit" disabled={busy || health === "offline"}>
          {busy ? "Checking…" : "Enter"}
        </button>
        {error && <p className="admin-error" role="alert">{error}</p>}

        <p className={`admin-health ${health}`} role="status">
          <span aria-hidden="true" />
          {health === "checking" && "Checking the API…"}
          {health === "up" && "API and database are running"}
          {health === "database-down" && "The API is running but the database is not. Start PostgreSQL."}
          {health === "offline" && "The API is not running. Start it with npm run dev."}
          {health !== "checking" && health !== "up" && (
            <button type="button" onClick={recheck}>
              Check again
            </button>
          )}
        </p>
      </form>
    </main>
  );
}

/* ---------- Generic list + form for tracks / movies / playlists ---------- */

function ResourceManager({ name, onAuthError }: { name: string; onAuthError: () => void }) {
  const resource = resources[name]!;
  const [rows, setRows] = useState<Row[]>([]);
  const [playlists, setPlaylists] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState("");

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    },
    [onAuthError]
  );

  const load = useCallback(async () => {
    try {
      setRows(await call<Row[]>("GET", resource.listPath));
      if (name === "tracks") setPlaylists(await call<Row[]>("GET", "/music/playlists"));
    } catch (e) {
      fail(e);
    }
  }, [resource.listPath, name, fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const open = (row: Row | "new") => {
    const next: Record<string, string | boolean> = {};
    for (const f of resource.fields) {
      const current = row === "new" ? undefined : row[f.key];
      next[f.key] =
        f.type === "checkbox"
          ? current === undefined
            ? true
            : Boolean(current)
          : current === null || current === undefined
          ? ""
          : f.key === "entryDate"
          ? String(current).slice(0, 10)
          : String(current);
    }
    setValues(next);
    setEditing(row);
    setMessage("");
  };

  const payload = () => {
    const body: Record<string, unknown> = {};
    for (const f of resource.fields) {
      const v = values[f.key];
      if (f.type === "checkbox") body[f.key] = Boolean(v);
      else if (f.type === "number" || f.type === "playlist") {
        body[f.key] = v === "" || v === undefined ? (f.type === "number" && !f.required ? undefined : null) : Number(v);
      } else {
        const text = String(v ?? "").trim();
        body[f.key] = text === "" ? (f.required ? text : null) : text;
      }
    }
    return body;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing === "new") await call("POST", resource.writePath, payload());
      else if (editing) await call("PUT", `${resource.writePath}/${editing.id}`, payload());
      setEditing(null);
      setMessage("Saved.");
      await load();
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete "${resource.summary(row).trim()}"? This cannot be undone.`)) return;
    try {
      await call("DELETE", `${resource.writePath}/${row.id}`);
      setMessage("Deleted.");
      await load();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <section>
      <div className="admin-bar">
        <h2>{resource.label}</h2>
        <button type="button" onClick={() => open("new")}>+ Add</button>
      </div>
      {message && <p className="admin-note" role="status">{message}</p>}

      {editing && (
        <form className="admin-form" onSubmit={save}>
          {resource.fields.map((f) => (
            <label key={f.key} className={f.type === "checkbox" ? "check" : ""}>
              <span>{f.label}</span>
              {f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  rows={5}
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : f.type === "select" ? (
                <select
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {(f.options ?? []).map((option) => (
                    <option key={option} value={option}>{option.toLowerCase()}</option>
                  ))}
                </select>
              ) : f.type === "playlist" ? (
                <select
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                >
                  <option value="">None</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>{String(p.name)}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={String(values[f.key] ?? "")}
                  required={f.required}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <div className="admin-actions">
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="admin-list">
        {rows.length === 0 && <li className="empty">Nothing here yet.</li>}
        {rows.map((row) => (
          <li key={row.id}>
            <span>{resource.summary(row)}</span>
            <div>
              <button type="button" className="ghost" onClick={() => open(row)}>Edit</button>
              <button type="button" className="ghost danger" onClick={() => remove(row)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Recommendation moderation ---------- */

function Recommendations({ onAuthError }: { onAuthError: () => void }) {
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await call<Row[]>("GET", `/admin/recommendations?status=${status}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    }
  }, [status, onAuthError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setMessage(errorMessage(e));
    }
  };

  return (
    <section>
      <div className="admin-bar">
        <h2>Recommendations</h2>
        <div className="admin-filter">
          {["PENDING", "APPROVED", "REJECTED"].map((s) => (
            <button key={s} type="button" className={s === status ? "on" : "ghost"} onClick={() => setStatus(s)}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {message && <p className="admin-error" role="alert">{message}</p>}
      <ul className="admin-list">
        {rows.length === 0 && <li className="empty">No {status.toLowerCase()} recommendations.</li>}
        {rows.map((r) => (
          <li key={r.id} className="rec">
            <div>
              <strong>{String(r.title)}</strong> <em>({String(r.kind).toLowerCase()})</em>
              <p>{String(r.reason)}</p>
              <small>
                from {String(r.name)}
                {r.link ? (
                  <>
                    {" · "}
                    <a href={String(r.link)} target="_blank" rel="noreferrer noopener">{String(r.link)}</a>
                  </>
                ) : null}
              </small>
            </div>
            <div>
              {status !== "APPROVED" && (
                <button type="button" onClick={() => act(() => call("PATCH", `/admin/recommendations/${r.id}`, { status: "APPROVED" }))}>
                  Approve
                </button>
              )}
              {status !== "REJECTED" && (
                <button type="button" className="ghost" onClick={() => act(() => call("PATCH", `/admin/recommendations/${r.id}`, { status: "REJECTED" }))}>
                  Reject
                </button>
              )}
              <button
                type="button"
                className="ghost danger"
                onClick={() => window.confirm("Delete permanently?") && act(() => call("DELETE", `/admin/recommendations/${r.id}`))}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Site settings ---------- */

function Settings({ onAuthError }: { onAuthError: () => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setSettings(await call<Record<string, string>>("GET", "/settings"));
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = async (key: string, value: string) => {
    try {
      await call("PUT", `/admin/settings/${key}`, { value });
      setMessage(`Saved ${key}.`);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    }
  };

  const keys = Object.keys(settings);

  return (
    <section>
      <div className="admin-bar"><h2>Site settings</h2></div>
      {message && <p className="admin-note" role="status">{message}</p>}
      <div className="admin-form">
        {keys.map((key) => (
          <label key={key}>
            <span>{key}</span>
            <input
              type="text"
              value={settings[key] ?? ""}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              onBlur={(e) => save(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          <span>Add a setting (key: a-z, 0-9, _ . -)</span>
          <input
            type="text"
            value={newKey}
            placeholder="new_key"
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newKey.trim()) {
                e.preventDefault();
                save(newKey.trim(), "");
                setNewKey("");
              }
            }}
          />
        </label>
        <p className="admin-hint">Changes save when you leave a field.</p>
      </div>
    </section>
  );
}

/* ---------- Shell ---------- */

function AdminApp() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken()));
  const [tab, setTab] = useState<Tab>("movies");

  useEffect(() => {
    document.title = "Admin";
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setSignedIn(false);
  }, []);

  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;

  return (
    <div className="admin">
      <header>
        <span className="admin-label">PORTFOLIO · ADMIN</span>
        <nav aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} type="button" className={t === tab ? "on" : "ghost"} onClick={() => setTab(t)}>
              {t === "recommendations" ? "Recommendations" : t === "settings" ? "Settings" : resources[t]!.label}
            </button>
          ))}
        </nav>
        <div>
          <a href="/">View site</a>
          <button type="button" className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main>
        {tab === "recommendations" ? (
          <Recommendations onAuthError={signOut} />
        ) : tab === "settings" ? (
          <Settings onAuthError={signOut} />
        ) : (
          <ResourceManager key={tab} name={tab} onAuthError={signOut} />
        )}
      </main>
    </div>
  );
}

export default AdminApp;
