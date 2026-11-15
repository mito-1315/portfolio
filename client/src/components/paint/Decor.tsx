import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Splat from "./Splat";

gsap.registerPlugin(ScrollTrigger);

export type DecorItem = {
  /** Vertical position as a percentage of the section's height. */
  top: number;
  /** Horizontal position: a percentage from the left edge (can be negative to bleed off). */
  left: number;
  /** Width in px. */
  size: number;
  seed: number;
  rotate?: number;
  /** "accent" or "ink". */
  tone?: "accent" | "ink";
  /** How far it drifts against the scroll, in px, for depth. */
  drift?: number;
  opacity?: number;
};

/**
 * A scatter of paint splats behind a section's content. They sit in the
 * margins, drift at their own speed as you scroll, and never take the pointer.
 */
function Decor({ items }: { items: DecorItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.utils.toArray<HTMLElement>(".decor-item").forEach((el) => {
        const drift = Number(el.dataset.drift ?? 0);
        const spin = Number(el.dataset.spin ?? 0);
        gsap.fromTo(
          el,
          { y: -drift, rotate: spin - 12 },
          {
            y: drift,
            rotate: spin + 12,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.8 },
          }
        );
      });
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className="decor" aria-hidden="true">
      {items.map((item, i) => (
        <div
          key={i}
          className={`decor-item tone-${item.tone ?? "accent"}`}
          data-drift={item.drift ?? 60}
          data-spin={item.rotate ?? 0}
          style={{
            top: `${item.top}%`,
            left: `${item.left}%`,
            width: item.size,
            opacity: item.opacity ?? 0.14,
          }}
        >
          <Splat seed={item.seed} />
        </div>
      ))}
    </div>
  );
}

export default Decor;
