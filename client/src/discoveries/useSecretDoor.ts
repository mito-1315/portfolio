import { useCallback, useEffect, useRef } from "react";

/**
 * A secret way to open a window: type a word anywhere outside a text field, or
 * a named event is fired (by a long press or a link). Both call `onOpen`.
 */
export function useSecretDoor(word: string, eventName: string, onOpen: () => void) {
  const callback = useRef(onOpen);
  useEffect(() => {
    callback.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    let typed = "";
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      typed = (typed + event.key.toLowerCase()).slice(-word.length);
      if (typed === word) {
        typed = "";
        callback.current();
      }
    };
    const onEvent = () => callback.current();
    window.addEventListener("keydown", onKey);
    window.addEventListener(eventName, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(eventName, onEvent);
    };
  }, [word, eventName]);
}

/**
 * Press-and-hold: `start` on pointer down, `end` on release or leave. After
 * `ms` it fires the named event. `wasHold()` tells the click that follows a
 * long press to stand down, so the press does only one thing.
 */
export function useHold(eventName: string, ms = 900) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const end = useCallback(() => window.clearTimeout(timer.current), []);
  const start = useCallback(() => {
    held.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      held.current = true;
      window.dispatchEvent(new Event(eventName));
    }, ms);
  }, [eventName, ms]);
  const wasHold = useCallback(() => {
    const result = held.current;
    held.current = false;
    return result;
  }, []);

  return { start, end, wasHold };
}
