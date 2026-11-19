import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import "./Intro.css";

type Props = {
  /** The mood page (its .mood-screen) to cut in half. */
  source: HTMLElement;
  /** The page behind has been cut open: mount the hero now. */
  onMount: () => void;
  onDone: () => void;
};

const INK = "#14110e";

/**
 * Built from the mood page itself. The musical note drifting on the right
 * darkens, glides to the middle and unspools into a ribbon that whips out to
 * both edges, pulls taut into a single line and cuts the page in half. The two
 * halves slide away and the hero is waiting behind them.
 */
function CutTransition({ source, onMount, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const cb = useRef({ onMount, onDone });
  cb.current = { onMount, onDone };

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cy = h / 2;
    const cx = w / 2;

    // The right-most drifting note is the one that leaves.
    const notes = Array.from(source.querySelectorAll<HTMLElement>(".mood-note"));
    const lead = notes.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
    const lr = lead?.getBoundingClientRect();
    const glyph = el.querySelector(".cut-note") as HTMLElement;
    const startSize = lead ? parseFloat(getComputedStyle(lead).fontSize) : 40;
    glyph.textContent = lead?.textContent ?? "♫";
    gsap.set(glyph, {
      x: lr ? lr.left + lr.width / 2 : w * 0.88,
      y: lr ? lr.top + lr.height / 2 : h * 0.2,
      fontSize: startSize,
      color: getComputedStyle(lead ?? document.body).color,
      opacity: 0.25,
    });

    // Two copies of the page, each clipped to one half of the screen.
    const top = el.querySelector(".cut-top") as HTMLElement;
    const bottom = el.querySelector(".cut-bottom") as HTMLElement;
    [top, bottom].forEach((half) => {
      const copy = source.cloneNode(true) as HTMLElement;
      copy.querySelectorAll(".mood-note").forEach((n) => {
        if (n.textContent === lead?.textContent && (n as HTMLElement).style.left === lead?.style.left) {
          (n as HTMLElement).style.visibility = "hidden";
        }
      });
      copy.setAttribute("aria-hidden", "true");
      copy.querySelectorAll("button").forEach((b) => b.setAttribute("tabindex", "-1"));
      half.prepend(copy);
    });
    // The real page is now free to go; the copies look exactly like it.
    source.style.visibility = "hidden";

    // The ribbon: a wavy band from the middle out to both edges.
    const band = el.querySelector(".cut-band") as SVGPathElement;
    const glow = el.querySelector(".cut-glow") as SVGPathElement;
    const wave = { amp: 0, reach: 0, phase: 0, width: 20 };
    const draw = () => {
      const half = (w / 2) * wave.reach;
      let d = "";
      for (let i = -60; i <= 60; i++) {
        const t = i / 60;
        const x = cx + t * half;
        const env = Math.sin(Math.min(1, Math.abs(t) * 1.2) * Math.PI * 0.5);
        const y = cy + Math.sin(t * Math.PI * 3.2 + wave.phase) * wave.amp * env;
        d += `${i === -60 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      band.setAttribute("d", d);
      glow.setAttribute("d", d);
      band.style.strokeWidth = String(wave.width);
      glow.style.strokeWidth = String(Math.max(1.5, wave.width * 0.22));
    };
    draw();
    gsap.set([band, glow], { opacity: 0 });
    gsap.set([top, bottom], { y: 0 });

    const edge = (el.querySelectorAll(".cut-edge") as NodeListOf<HTMLElement>);
    gsap.set(edge, { opacity: 0 });

    const tl = gsap.timeline({ onComplete: () => cb.current.onDone() });

    // 1 — the note darkens, swells and drifts to the middle in an arc.
    tl.to(glyph, { opacity: 1, color: INK, duration: 0.7, ease: "power2.out" }, 0)
      .to(glyph, { fontSize: 150, duration: 1.0, ease: "power3.inOut" }, 0)
      .to(glyph, { x: cx, duration: 1.0, ease: "power3.inOut" }, 0)
      .to(glyph, { y: cy, duration: 1.0, ease: "power2.inOut" }, 0)
      .to(glyph, { rotate: -360, duration: 1.0, ease: "power2.inOut" }, 0)
      // the page quietly dims around it
      .to([top, bottom], { filter: "brightness(0.9)", duration: 0.9 }, 0.1)

      // 2 — it unspools: the ribbon whips out to both edges, loose and wavy
      .set([band, glow], { opacity: 1 }, 1.0)
      .to(wave, { reach: 1, duration: 0.7, ease: "power3.out", onUpdate: draw }, 1.0)
      .to(wave, { amp: 110, duration: 0.5, ease: "power2.out", onUpdate: draw }, 1.0)
      .to(wave, { phase: Math.PI * 4, duration: 1.2, ease: "none", onUpdate: draw }, 1.0)
      .to(glyph, { scale: 0.05, opacity: 0, duration: 0.45, ease: "power3.in" }, 1.0)
      .add(() => cb.current.onMount(), 1.2)

      // 3 — it pulls taut: the wave flattens and the band thins to a blade
      .to(wave, { amp: 0, duration: 0.7, ease: "power3.inOut", onUpdate: draw }, 1.7)
      .to(wave, { width: 3, duration: 0.7, ease: "power3.inOut", onUpdate: draw }, 1.7)
      .to([top, bottom], { filter: "brightness(1)", duration: 0.4 }, 1.9)

      // 4 — the cut: the page parts along the line, the hero behind it
      .set(edge, { opacity: 1 }, 2.4)
      .set([band, glow], { opacity: 0 }, 2.4)
      .to(top, { y: -h * 0.52, duration: 0.95, ease: "power4.inOut" }, 2.4)
      .to(bottom, { y: h * 0.52, duration: 0.95, ease: "power4.inOut" }, 2.4);

    return () => {
      tl.kill();
    };
  }, [source]);

  return (
    <div ref={root} className="cut" aria-hidden="true">
      <div className="cut-half cut-top">
        <i className="cut-edge cut-edge-top" />
      </div>
      <div className="cut-half cut-bottom">
        <i className="cut-edge cut-edge-bottom" />
      </div>
      <svg className="cut-svg" width="100%" height="100%">
        <path className="cut-band" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path className="cut-glow" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="cut-note" />
    </div>
  );
}

export default CutTransition;
