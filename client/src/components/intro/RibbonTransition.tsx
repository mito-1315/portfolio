import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import "./Intro.css";

type Props = {
  origin: { x: number; y: number };
  /** The dark cover is complete: swap the page underneath now. */
  onCover: () => void;
  onDone: () => void;
};

const RIBBONS = [
  { phase: 0, width: 26, color: "var(--color-orange)" },
  { phase: 2.1, width: 16, color: "rgb(var(--glow-rgb))" },
  { phase: 4.2, width: 8, color: "var(--color-text)" },
];

function spiral(cx: number, cy: number, maxR: number, phase: number) {
  const turns = 2.4;
  let d = "";
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const a = phase + t * turns * Math.PI * 2;
    const r = maxR * Math.pow(t, 0.92);
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r * 0.82).toFixed(1)} `;
  }
  return d;
}

/**
 * A note leaves the Enter button, glides to the middle of the screen and winds
 * out into a ribbon that spirals across the page. A dark disc then grows out of
 * the ribbon's centre, the page is swapped underneath, and the cover lifts.
 */
function RibbonTransition({ origin, onCover, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const cb = useRef({ onCover, onDone });
  cb.current = { onCover, onDone };

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(w, h) * 0.55;

    const paths = Array.from(el.querySelectorAll<SVGPathElement>("path.rb-path"));
    const lens = paths.map((p, i) => {
      p.setAttribute("d", spiral(cx, cy, maxR, RIBBONS[i].phase));
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      return len;
    });
    const orb = el.querySelector(".rb-orb") as HTMLElement;
    const disc = el.querySelector(".rb-disc") as SVGCircleElement;
    gsap.set(disc, { attr: { cx, cy, r: 0 } });
    gsap.set(orb, { x: origin.x, y: origin.y, scale: 0.4, autoAlpha: 0 });

    const head = { v: 0 };
    const tl = gsap.timeline();
    tl.to(orb, { autoAlpha: 1, scale: 1, duration: 0.2 })
      // Different easings on x and y bend the flight into an arc.
      .to(orb, { x: cx, duration: 0.8, ease: "power2.inOut" }, 0)
      .to(orb, { y: cy, duration: 0.8, ease: "power3.out" }, 0)
      .to(
        head,
        {
          v: 1,
          duration: 1.3,
          ease: "power2.in",
          onUpdate: () => {
            paths.forEach((p, i) => {
              p.style.strokeDashoffset = String(lens[i] * (1 - head.v));
            });
            const pt = paths[0].getPointAtLength(head.v * lens[0]);
            gsap.set(orb, { x: pt.x, y: pt.y, rotate: head.v * 720 });
          },
        },
        0.8,
      )
      .to(disc, { attr: { r: maxR * 1.3 }, duration: 0.65, ease: "power3.in" }, 1.8)
      .to(orb, { autoAlpha: 0, duration: 0.2 }, 2.3)
      .add(() => cb.current.onCover(), 2.45)
      .to(el, { autoAlpha: 0, duration: 0.7, ease: "power2.out", onComplete: () => cb.current.onDone() }, 2.85);

    return () => {
      tl.kill();
    };
  }, [origin.x, origin.y]);

  return (
    <div ref={root} className="rb" aria-hidden="true">
      <svg className="rb-svg" width="100%" height="100%">
        {RIBBONS.map((r) => (
          <path
            key={r.phase}
            className="rb-path"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: r.color, strokeWidth: r.width, opacity: 0.92 }}
          />
        ))}
        <circle className="rb-disc" style={{ fill: "var(--color-text)" }} />
      </svg>
      <span className="rb-orb">♪</span>
    </div>
  );
}

export default RibbonTransition;
