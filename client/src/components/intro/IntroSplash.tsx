import { useEffect, useRef } from "react";
import gsap from "gsap";
import "./Intro.css";

const W = 1000;
const H = 220;
const MID = 110;
const WAVE = (() => {
  let d = `M0 ${MID}`;
  for (let x = 10; x <= W; x += 10) {
    const y = MID + Math.sin((x / W) * Math.PI * 4) * 52 * Math.sin((x / W) * Math.PI);
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return d;
})();

/**
 * First thing a visitor sees: a staff draws itself, a note travels along a wave
 * leaving a ribbon behind it, then the two halves of the screen part to reveal
 * the mood page. Waits for the web fonts so the page doesn't jump afterwards.
 */
function IntroSplash({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    const wave = el.querySelector("path.intro-wave") as SVGPathElement;
    const lines = el.querySelectorAll(".intro-staff line");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.to(el, { autoAlpha: 0, duration: 0.3, onComplete: () => done.current() });
      return;
    }

    const len = wave.getTotalLength();
    gsap.set(wave, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set(lines, { strokeDasharray: W, strokeDashoffset: W });
    gsap.set(q(".intro-note"), { autoAlpha: 0 });

    const p = { v: 0 };
    const move = () => {
      const pt = wave.getPointAtLength(p.v * len);
      const box = wave.ownerSVGElement!.getBoundingClientRect();
      gsap.set(q(".intro-note"), {
        x: pt.x * (box.width / W) + box.left,
        y: pt.y * (box.height / H) + box.top,
      });
      wave.style.strokeDashoffset = String(len * (1 - p.v));
    };

    let tl: gsap.core.Timeline | undefined;
    let dead = false;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    // Never hold the visitor for more than a moment if a font is slow.
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(() => {
      if (dead) return;
      tl = gsap.timeline({ onComplete: () => done.current() });
      tl.from(q(".intro-mark"), { autoAlpha: 0, y: 14, duration: 0.6, ease: "power3.out" })
        .to(lines, { strokeDashoffset: 0, duration: 0.8, ease: "power2.out", stagger: 0.07 }, 0.1)
        .set(q(".intro-note"), { autoAlpha: 1 }, 0.55)
        .to(p, { v: 1, duration: 1.1, ease: "power1.inOut", onUpdate: move }, 0.55)
        .to([q(".intro-note"), q(".intro-staff"), q(".intro-mark")], { autoAlpha: 0, duration: 0.3 }, 1.7)
        .to(q(".intro-top"), { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, 1.9)
        .to(q(".intro-bottom"), { yPercent: 100, duration: 0.9, ease: "power4.inOut" }, 1.9);
    });

    return () => {
      dead = true;
      tl?.kill();
    };
  }, []);

  return (
    <div ref={root} className="intro" aria-hidden="true">
      <div className="intro-half intro-top" />
      <div className="intro-half intro-bottom" />
      <span className="intro-mark">
        MT<i>.</i>
      </span>
      <svg className="intro-staff" viewBox={`0 0 ${W} ${H}`}>
        {[66, 88, 110, 132, 154].map((y) => (
          <line key={y} x1="0" x2={W} y1={y} y2={y} />
        ))}
        <path className="intro-wave" d={WAVE} />
      </svg>
      <span className="intro-note" />
    </div>
  );
}

export default IntroSplash;
