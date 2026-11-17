import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { Project } from "./projectsData";
import ProjectVisual from "./ProjectVisual";

type Page = { id: string; label: string; body: ReactNode };

/** Immersive case file: one idea per page, so nothing is a wall of text. */
function ProjectCaseFile({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  const pages = useMemo<Page[]>(() => {
    const lead = (text: string) => <p className="case-lead">{text}</p>;

    const list: Page[] = [
      { id: "overview", label: "Overview", body: lead(project.story[0]) },
      {
        id: "story",
        label: "How I approached it",
        body: (
          <div className="case-prose">
            {project.story.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ),
      },
      {
        id: "features",
        label: "Key features",
        body: (
          <ul className="case-features">
            {project.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ),
      },
      {
        id: "architecture",
        label: "Architecture",
        body: (
          <ol className="case-flow">
            {project.flow.map((step, i) => (
              <li key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        ),
      },
      {
        id: "tech",
        label: "Technology",
        body: (
          <ul className="case-chips">
            {project.tech.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ),
      },
      { id: "mine", label: "My contribution", body: lead(project.contribution) },
    ];

    if (project.links.length) {
      list.push({
        id: "links",
        label: "Links",
        body: (
          <div className="case-links">
            {project.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        ),
      });
    }

    return list;
  }, [project]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setIndex((i) => Math.min(pages.length - 1, i + 1));
      }
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, [onClose, pages.length]);

  const page = pages[index];
  return createPortal(
    <div
      className="case-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title} case file`}
    >
      <div className="case-file">
        <header className="case-header">
          <span className="explorer-brand">
            MT<span>.</span> / CASE FILE {project.numeral}
          </span>
          <button
            ref={closeRef}
            type="button"
            className="explorer-close"
            onClick={onClose}
            aria-label="Close case file"
          >
            <span>ESC</span>
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="case-body">
          <aside className="case-rail">
            <h2>{project.title}</h2>
            <span className="case-sub">{project.subtitle}</span>
            <ol>
              {pages.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={i === index ? "current" : ""}
                    onClick={() => setIndex(i)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {p.label}
                  </button>
                </li>
              ))}
            </ol>
            <div className="case-rail-visual">
              <ProjectVisual kind={project.kind} />
            </div>
          </aside>

          <div className="case-stage">
            <span className="case-page-label">{page.label.toUpperCase()}</span>
            <div key={page.id} className="case-page">
              {page.body}
            </div>
          </div>
        </div>

        <footer className="case-footer">
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous page"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Prev
          </button>
          <span>
            {index + 1} / {pages.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex(index + 1)}
            disabled={index === pages.length - 1}
            aria-label="Next page"
          >
            Next <ArrowRight size={15} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export default ProjectCaseFile;
