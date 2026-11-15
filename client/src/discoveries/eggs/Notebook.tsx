import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { fallbackSettings, useApi, type Settings } from "../../services/api";

const BLANK = "This notebook is still waiting for its first page.";

/** Reads the notebook's pages from the site settings: notebook_page_1, _2, ... */
function pagesFrom(settings: Settings): string[] {
  const pages: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const page = settings[`notebook_page_${i}`]?.trim();
    if (page) pages.push(page);
  }
  return pages.length > 0 ? pages : [BLANK];
}

/** Text that types itself out, unless motion is reduced. */
function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const id = window.setTimeout(() => setShown(text.length), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 26);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <p className="nb-text" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <i aria-hidden="true" className={shown < text.length ? "typing" : ""} />
    </p>
  );
}

/** A closed notebook at the bottom of the page. Opens to a page you can turn. */
function Notebook({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const { data: settings } = useApi<Settings>("/settings", fallbackSettings);
  const pages = useMemo(() => pagesFrom(settings), [settings]);
  const title = settings.notebook_title?.trim() || "Notebook";
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowRight") setPage((p) => Math.min(p + 1, pages.length - 1));
      if (event.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pages.length]);

  return (
    <>
      <button
        type="button"
        className={`egg egg-notebook ${visible ? "on" : ""}`}
        onClick={() => {
          setPage(0);
          setOpen(true);
        }}
        tabIndex={visible ? 0 : -1}
        aria-label="A notebook peeking up from the bottom of the page. Open it."
      >
        <span className="nb-cover" aria-hidden="true">
          <i />
          <b>{title}</b>
        </span>
      </button>

      {open && (
        <div className="nb-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(false)}>
          <div className="nb-book" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="nb-close" onClick={() => setOpen(false)} aria-label="Close the notebook">
              <X size={15} />
            </button>
            <span className="nb-title">{title.toUpperCase()}</span>
            <div key={page} className="nb-page">
              <Typed text={pages[page] ?? BLANK} />
            </div>
            <div className="nb-turn">
              <button type="button" onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page === 0}>
                ← Back
              </button>
              <span>
                {page + 1} / {pages.length}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(p + 1, pages.length - 1))} disabled={page >= pages.length - 1}>
                Turn the page →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Notebook;
