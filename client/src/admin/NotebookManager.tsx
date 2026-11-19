import { useCallback, useEffect, useState } from "react";
import { ApiError, call } from "./adminApi";

const MAX_PAGES = 12;
const MAX_CHARS = 1500;
const key = (n: number) => `notebook_page_${n}`;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Edits the notebook that peeks up near the end of the site: its title and its pages. */
function NotebookManager({ onAuthError }: { onAuthError: () => void }) {
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ title: string; pages: string[] }>({ title: "", pages: [] });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await call<Record<string, string>>("GET", "/settings");
      const list: string[] = [];
      for (let i = 1; i <= MAX_PAGES; i++) {
        const page = all[key(i)]?.trim();
        if (page) list.push(page);
      }
      const t = all.notebook_title ?? "";
      setTitle(t);
      setPages(list);
      setSaved({ title: t, pages: list });
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const dirty = title !== saved.title || JSON.stringify(pages) !== JSON.stringify(saved.pages);

  const edit = (index: number, text: string) => setPages(pages.map((p, i) => (i === index ? text : p)));
  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= pages.length) return;
    const next = [...pages];
    [next[index], next[to]] = [next[to], next[index]];
    setPages(next);
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const clean = pages.map((p) => p.trim()).filter(Boolean);
      await call("PUT", "/admin/settings/notebook_title", { value: title.trim() });
      // Pages are stored one per key, so every slot is written; unused ones are emptied.
      for (let i = 1; i <= MAX_PAGES; i++) {
        await call("PUT", `/admin/settings/${key(i)}`, { value: clean[i - 1] ?? "" });
      }
      setMessage("Saved. The notebook on the site now shows these pages.");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError();
      else setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="admin-bar">
        <h2>Notebook</h2>
        <div className="admin-bar-buttons">
          <button type="button" onClick={() => setPages([...pages, ""])} disabled={pages.length >= MAX_PAGES}>
            Add a page
          </button>
          <button type="button" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save notebook"}
          </button>
        </div>
      </div>
      {message && <p className="admin-note" role="status">{message}</p>}

      <div className="admin-form">
        <label>
          <span>Title on the cover</span>
          <input type="text" value={title} maxLength={40} placeholder="Notebook" onChange={(e) => setTitle(e.target.value)} />
        </label>

        {pages.map((page, index) => (
          <label key={index}>
            <span>
              Page {index + 1}  ·  {page.length}/{MAX_CHARS}
            </span>
            <textarea
              rows={5}
              value={page}
              maxLength={MAX_CHARS}
              placeholder="Write this page…"
              onChange={(e) => edit(index, e.target.value)}
            />
            <span className="admin-actions">
              <button type="button" className="ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                Move up
              </button>
              <button type="button" className="ghost" onClick={() => move(index, 1)} disabled={index === pages.length - 1}>
                Move down
              </button>
              <button type="button" className="ghost" onClick={() => setPages(pages.filter((_, i) => i !== index))}>
                Remove page
              </button>
            </span>
          </label>
        ))}

        {pages.length === 0 && <p className="admin-hint">No pages yet. Add one and the notebook will show it.</p>}
        <p className="admin-hint">Up to {MAX_PAGES} pages. Nothing changes on the site until you press Save notebook.</p>
      </div>
    </section>
  );
}

export default NotebookManager;
