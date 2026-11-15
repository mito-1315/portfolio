import { useMemo } from "react";

/** Small seeded random numbers, so a splat looks the same every time. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Splatter = {
  body: string;
  drops: { x: number; y: number; r: number }[];
};

/**
 * A paint splat: a smooth blob with spiky arms thrown out, plus a few
 * droplets flung away from it. Drawn in a 200 x 200 box.
 */
function makeSplat(seed: number): Splatter {
  const rand = seeded(seed * 9973 + 17);
  const arms = 11 + Math.floor(rand() * 4);
  const points: [number, number][] = [];

  for (let i = 0; i < arms * 2; i++) {
    const angle = (i / (arms * 2)) * Math.PI * 2 + rand() * 0.15;
    // Every other point is the tip of an arm; the ones between are the blob's body.
    const tip = i % 2 === 0;
    const radius = tip ? 62 + rand() * 38 : 34 + rand() * 12;
    points.push([100 + Math.cos(angle) * radius, 100 + Math.sin(angle) * radius]);
  }

  // Smooth closed curve through the midpoints, using each point as a control point.
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const first = mid(points[points.length - 1]!, points[0]!);
  let body = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const m = mid(p, points[(i + 1) % points.length]!);
    body += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  body += "Z";

  const drops = Array.from({ length: 5 + Math.floor(rand() * 4) }, () => {
    const angle = rand() * Math.PI * 2;
    const distance = 96 + rand() * 40;
    return {
      x: 100 + Math.cos(angle) * distance,
      y: 100 + Math.sin(angle) * distance,
      r: 2.5 + rand() * 6,
    };
  });

  return { body, drops };
}

type SplatProps = {
  seed?: number;
  className?: string;
};

/** A decorative splat that takes its colour from the text colour it sits in (set `color`). */
function Splat({ seed = 1, className = "" }: SplatProps) {
  const splat = useMemo(() => makeSplat(seed), [seed]);

  return (
    <svg className={`splat ${className}`} viewBox="-30 -30 260 260" aria-hidden="true">
      <path d={splat.body} fill="currentColor" />
      {splat.drops.map((drop, i) => (
        <circle key={i} cx={drop.x} cy={drop.y} r={drop.r} fill="currentColor" />
      ))}
    </svg>
  );
}

export default Splat;
