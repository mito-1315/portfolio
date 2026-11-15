import { useEffect, useState } from "react";

/**
 * The id of whichever listed section is crossing the middle of the screen,
 * or null (e.g. while a pinned stage sits between sections). Read straight
 * from the layout so it can never go stale.
 */
export function useCurrentSection(ids: string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    const list = key.split("|");
    const update = () => {
      const middle = window.innerHeight / 2;
      const hit = list.find((id) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return rect !== undefined && rect.top <= middle && rect.bottom > middle;
      });
      setCurrent(hit ?? null);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [key]);

  return current;
}
