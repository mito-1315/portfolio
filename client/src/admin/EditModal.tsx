import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** A window over the page for editing one item, so the form is always in view wherever the Edit button was. */
export default function EditModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const returnTo = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    card.current?.querySelector<HTMLElement>("input:not([type=file]), textarea, select")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      // Leave Escape to a confirmation box if one is open on top.
      if (event.key === "Escape" && !document.querySelector(".admin-dialog")) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (returnTo instanceof HTMLElement) returnTo.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="admin admin-modal" role="presentation">
      <div className="admin-modal-scrim" />
      <div ref={card} className="admin-modal-card" role="dialog" aria-modal="true" aria-label={title} data-lenis-prevent>
        <header>
          <h2>{title}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
