import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "./Paint.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Two hand-drawn splash edges. They are drawn bleeding upward from a flat
 * bottom edge, so placed at the top of a section they look like that
 * section's colour splashing up over the one before it.
 */
const EDGES = [
  "M0 160 V104 C40 98 70 120 120 108 C170 96 200 52 262 64 C300 71 318 98 360 92 L378 40 C384 22 396 22 400 42 L412 96 C470 112 520 88 580 70 C620 58 640 24 668 30 C690 34 692 62 710 82 C760 112 840 96 900 80 C950 66 980 26 1020 38 C1048 46 1040 84 1080 98 C1140 118 1200 96 1250 78 L1268 34 C1274 18 1288 20 1290 38 L1300 86 C1340 104 1390 112 1440 98 V160 Z",
  "M0 160 V84 C50 92 80 60 140 50 C176 44 190 70 230 86 L246 30 C252 12 266 14 268 34 L276 92 C340 120 410 104 470 84 C530 64 560 100 620 106 C690 114 724 70 786 56 C830 46 850 76 890 92 L906 46 C912 28 926 28 928 46 L934 100 C1000 126 1080 100 1140 74 C1190 54 1230 70 1290 92 C1340 108 1400 96 1440 70 V160 Z",
];

/** Droplets thrown off above the edge: x, y, radius. */
const DROPS: [number, number, number][][] = [
  [[392, 4, 9], [640, -6, 6], [1022, 8, 7], [1284, 0, 10], [220, 30, 5]],
  [[258, -2, 8], [920, 2, 9], [520, 40, 5], [1180, 24, 6], [60, 40, 6]],
];

type PaintSplashProps = {
  /** 0 or 1: which edge to draw. */
  variant?: number;
  /** Draw the splash mirrored, for variety. */
  flip?: boolean;
};

/**
 * Sits at the top of a coloured section. It fills with that section's
 * background colour (read from the theme), has an accent-coloured rim, and
 * splashes up as you scroll toward the section.
 */
function PaintSplash({ variant = 0, flip = false }: PaintSplashProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const edge = EDGES[variant % EDGES.length] as string;
  const drops = DROPS[variant % DROPS.length] as [number, number, number][];

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const trigger = {
        trigger: rootRef.current,
        start: "top 100%",
        end: "bottom 45%",
        scrub: 0.7,
      };

      // The paint rises from the section edge.
      gsap.fromTo(
        ".paint-body",
        { scaleY: 0.04, transformOrigin: "50% 100%" },
        { scaleY: 1, ease: "power2.out", scrollTrigger: trigger }
      );
      gsap.fromTo(
        ".paint-rim",
        { scaleY: 0.04, transformOrigin: "50% 100%" },
        { scaleY: 1, ease: "power2.out", scrollTrigger: { ...trigger, scrub: 1.1 } }
      );
      // The droplets fly up a little later than the paint.
      gsap.fromTo(
        ".paint-drop",
        { scale: 0, y: 60, transformOrigin: "50% 50%" },
        {
          scale: 1,
          y: 0,
          ease: "back.out(2)",
          stagger: 0.08,
          scrollTrigger: { ...trigger, start: "top 90%", end: "bottom 60%", scrub: 0.9 },
        }
      );
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className={`paint-splash ${flip ? "flip" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none">
        {/* The rim sits slightly higher than the body, in the accent colour. */}
        <path className="paint-rim" d={edge} transform="translate(0 -22)" />
        <path className="paint-body" d={edge} />
        {drops.map(([x, y, r], i) => (
          <circle key={i} className="paint-drop" cx={x} cy={y - 14} r={r * 1.5} />
        ))}
      </svg>
    </div>
  );
}

export default PaintSplash;
