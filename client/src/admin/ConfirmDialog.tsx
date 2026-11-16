/* eslint-disable react-refresh/only-export-components -- the hook and its dialog belong together */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Options = {
  title: string;
  message: string;
  /** Text on the main button, e.g. "Delete". */
  confirmLabel?: string;
  /** Styles the main button as a destructive action. */
  danger?: boolean;
};

type Pending = Options & { resolve: (ok: boolean) => void };

function Dialog({ pending, onAnswer }: { pending: Pending; onAnswer: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    // Start on the safe choice, so an accidental Enter cannot delete anything.
    cancelRef.current?.focus();
    const previous = returnTo.current;
    return () => {
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onAnswer(false);
      } else if (event.key === "Tab") {
        // Keep Tab inside the dialog: it only has two buttons.
        const buttons = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        const first = buttons[0]!;
        const last = buttons[buttons.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  return createPortal(
    <div className="admin-dialog" role="presentation">
      <div className="admin-dialog-scrim" onClick={() => onAnswer(false)} />
      <div className="admin-dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title" aria-describedby="admin-dialog-text">
        <h2 id="admin-dialog-title">{pending.title}</h2>
        <p id="admin-dialog-text">{pending.message}</p>
        <div className="admin-dialog-actions">
          <button ref={cancelRef} type="button" className="ghost" onClick={() => onAnswer(false)}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className={pending.danger ? "danger-solid" : ""} onClick={() => onAnswer(true)}>
            {pending.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * A page-styled replacement for the browser's confirm box.
 * `const ok = await confirm({ title, message })`, and render `dialog` anywhere in the component.
 */
export function useConfirm(): { confirm: (options: Options) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: Options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  const answer = useCallback(
    (ok: boolean) => {
      setPending((current) => {
        current?.resolve(ok);
        return null;
      });
    },
    []
  );

  return { confirm, dialog: pending ? <Dialog pending={pending} onAnswer={answer} /> : null };
}
