/**
 * A grand piano, built as a cloud of points.
 *
 * Nothing here is a downloaded model: the shapes are described with a few
 * measurements, and points are scattered over their surfaces. The keyboard
 * runs along X with the player at +Z, the tail of the piano reaching toward
 * -Z, and Y is up. One unit is roughly a metre.
 */

export type PianoCloud = {
  count: number;
  /** Where each point ends up (x, y, z). */
  target: Float32Array;
  /** Where each point begins: along five staff lines (x, y, z). */
  start: Float32Array;
  /** 0..1, per point: timing offsets and variety. */
  rand: Float32Array;
  /** Piano key index 0..87 for points on a key, otherwise -1. */
  key: Float32Array;
};

type Vec2 = [number, number];

/** Small seeded random numbers, so the piano is identical every visit. */
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

/* ---------- Measurements ---------- */

const HALF_WIDTH = 0.75;
const BODY_BOTTOM = 0.7;
const RIM_TOP = 0.93;
const KEY_TOP = 0.8;
const KEYS_HALF_WIDTH = 0.65;

/** The case seen from above: straight bass side, rounded tail, curved bent side. */
function bezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, steps: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return points;
}

function outline(): Vec2[] {
  const A: Vec2 = [-HALF_WIDTH, 0];
  const B: Vec2 = [-HALF_WIDTH, -1.55];
  const C: Vec2 = [0.0, -2.05];
  const D: Vec2 = [HALF_WIDTH, -0.5];
  const E: Vec2 = [HALF_WIDTH, 0];
  return [
    A,
    B,
    // the rounded tail
    ...bezier(B, [-HALF_WIDTH, -2.05], [-0.38, -2.15], C, 14),
    // the bent side, sweeping back up to the straight treble side
    ...bezier(C, [0.4, -1.95], [0.7, -1.3], D, 18),
    E,
  ];
}

const OUTLINE = outline();

function pointInPolygon(x: number, z: number, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]!;
    const [xj, zj] = polygon[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** The furthest back (most negative z) the case reaches at a given x. */
function tailAt(x: number): number {
  let min = 0;
  for (let i = 0; i < OUTLINE.length; i++) {
    const [x1, z1] = OUTLINE[i]!;
    const [x2, z2] = OUTLINE[(i + 1) % OUTLINE.length]!;
    if ((x1 <= x && x <= x2) || (x2 <= x && x <= x1)) {
      if (x1 === x2) continue;
      const z = z1 + ((x - x1) / (x2 - x1)) * (z2 - z1);
      if (z < min) min = z;
    }
  }
  return min;
}

/* ---------- Keys ---------- */

type KeySpec = { midi: number; x: number; black: boolean };

function keyboard(): KeySpec[] {
  const whites: KeySpec[] = [];
  const blacks: KeySpec[] = [];
  const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
  const whiteWidth = (KEYS_HALF_WIDTH * 2) / 52;
  let whiteIndex = -1;

  for (let midi = 21; midi <= 108; midi++) {
    if (blackPitchClasses.has(midi % 12)) {
      // Sits on the boundary after the previous white key.
      const x = -KEYS_HALF_WIDTH + (whiteIndex + 1) * whiteWidth;
      blacks.push({ midi, x, black: true });
    } else {
      whiteIndex++;
      whites.push({ midi, x: -KEYS_HALF_WIDTH + (whiteIndex + 0.5) * whiteWidth, black: false });
    }
  }
  return [...whites, ...blacks];
}

/* ---------- Building the cloud ---------- */

type Part = { weight: number; fill: (rand: () => number, out: number[]) => void };

export function buildPiano(count: number): PianoCloud {
  const rand = seeded(2026);
  const target = new Float32Array(count * 3);
  const start = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  const keyAttr = new Float32Array(count).fill(-1);

  const edge = (() => {
    // Walk the outline once to pick points along it evenly.
    const lengths: number[] = [];
    let total = 0;
    for (let i = 0; i < OUTLINE.length; i++) {
      const [x1, z1] = OUTLINE[i]!;
      const [x2, z2] = OUTLINE[(i + 1) % OUTLINE.length]!;
      total += Math.hypot(x2 - x1, z2 - z1);
      lengths.push(total);
    }
    return (t: number): Vec2 => {
      const d = t * total;
      let i = lengths.findIndex((l) => l >= d);
      if (i < 0) i = lengths.length - 1;
      const prev = i === 0 ? 0 : lengths[i - 1]!;
      const f = (d - prev) / (lengths[i]! - prev || 1);
      const [x1, z1] = OUTLINE[i]!;
      const [x2, z2] = OUTLINE[(i + 1) % OUTLINE.length]!;
      return [x1 + (x2 - x1) * f, z1 + (z2 - z1) * f];
    };
  })();

  const insidePoint = (): Vec2 => {
    for (let tries = 0; tries < 40; tries++) {
      const x = -HALF_WIDTH + rand() * HALF_WIDTH * 2;
      const z = -2.1 + rand() * 2.1;
      if (pointInPolygon(x, z, OUTLINE)) return [x, z];
    }
    return [0, -0.5];
  };

  // Set by key parts, read back by the loop below, so key points know which key they belong to.
  const keyScratch = { midi: -1 };

  const keys = keyboard();
  const whiteKeys = keys.filter((k) => !k.black);
  const blackKeys = keys.filter((k) => k.black);
  const whiteWidth = (KEYS_HALF_WIDTH * 2) / 52;

  // Lid: the case outline, hinged on the bass side and propped open.
  const lidAngle = 0.62;
  const lidPoint = (x: number, z: number, y = RIM_TOP): [number, number, number] => {
    const u = x + HALF_WIDTH;
    return [-HALF_WIDTH + u * Math.cos(lidAngle), y + u * Math.sin(lidAngle), z];
  };

  const parts: Part[] = [
    // The case's side wall (the rim)
    {
      weight: 0.17,
      fill: (r, out) => {
        const [x, z] = edge(r());
        out.push(x, BODY_BOTTOM + r() * (RIM_TOP - BODY_BOTTOM), z);
      },
    },
    // The underside of the case, so it reads as a solid body from low angles
    {
      weight: 0.04,
      fill: (_r, out) => {
        const [x, z] = insidePoint();
        out.push(x, BODY_BOTTOM, z);
      },
    },
    // The open lid: its edge (dense) and its surface
    {
      weight: 0.1,
      fill: (r, out) => {
        const [x, z] = edge(r());
        out.push(...lidPoint(x, z));
      },
    },
    {
      weight: 0.07,
      fill: (_r, out) => {
        const [x, z] = insidePoint();
        out.push(...lidPoint(x, z));
      },
    },
    // Strings and soundboard inside the case
    {
      weight: 0.1,
      fill: (r, out) => {
        const lines = 64;
        const line = Math.floor(r() * lines);
        const x = -0.6 + (line / (lines - 1)) * 1.2;
        const zEnd = tailAt(x) + 0.1;
        const z = -0.22 + r() * (zEnd + 0.22);
        out.push(x, RIM_TOP - 0.08, z);
      },
    },
    {
      weight: 0.04,
      fill: (_r, out) => {
        const [x, z] = insidePoint();
        out.push(x, RIM_TOP - 0.1, z);
      },
    },
    // White keys
    {
      weight: 0.14,
      fill: (r, out) => {
        const k = whiteKeys[Math.floor(r() * whiteKeys.length)]!;
        out.push(k.x + (r() - 0.5) * (whiteWidth * 0.86), KEY_TOP, 0.02 + r() * 0.3);
        keyScratch.midi = k.midi;
      },
    },
    // Black keys
    {
      weight: 0.07,
      fill: (r, out) => {
        const k = blackKeys[Math.floor(r() * blackKeys.length)]!;
        out.push(k.x + (r() - 0.5) * 0.012, KEY_TOP + 0.045, 0.04 + r() * 0.16);
        keyScratch.midi = k.midi;
      },
    },
    // Key bed and the blocks at each end of the keyboard
    {
      weight: 0.04,
      fill: (r, out) => {
        const side = r() < 0.5 ? -1 : 1;
        out.push(side * (KEYS_HALF_WIDTH + 0.03 + r() * 0.03), BODY_BOTTOM + r() * 0.16, r() * 0.34);
      },
    },
    {
      weight: 0.03,
      fill: (r, out) => {
        out.push((r() - 0.5) * KEYS_HALF_WIDTH * 2, BODY_BOTTOM + 0.07 + r() * 0.03, 0.3 + r() * 0.04);
      },
    },
    // Three legs
    {
      weight: 0.1,
      fill: (r, out) => {
        const legs: Vec2[] = [
          [-0.68, -0.06],
          [0.68, -0.06],
          [-0.15, -1.78],
        ];
        const [lx, lz] = legs[Math.floor(r() * 3)]!;
        const y = r() * BODY_BOTTOM;
        const radius = 0.032 + (0.05 - 0.032) * (y / BODY_BOTTOM);
        const angle = r() * Math.PI * 2;
        out.push(lx + Math.cos(angle) * radius, y, lz + Math.sin(angle) * radius);
      },
    },
    // Casters under the legs
    {
      weight: 0.01,
      fill: (r, out) => {
        const legs: Vec2[] = [
          [-0.68, -0.06],
          [0.68, -0.06],
          [-0.15, -1.78],
        ];
        const [lx, lz] = legs[Math.floor(r() * 3)]!;
        const angle = r() * Math.PI * 2;
        out.push(lx + Math.cos(angle) * 0.045, 0.02, lz + Math.sin(angle) * 0.045);
      },
    },
    // The pedal lyre: two posts and three pedals
    {
      weight: 0.03,
      fill: (r, out) => {
        if (r() < 0.65) {
          out.push((r() < 0.5 ? -0.11 : 0.11) + (r() - 0.5) * 0.015, 0.06 + r() * (BODY_BOTTOM - 0.06), 0.2);
        } else {
          const pedal = Math.floor(r() * 3) - 1;
          out.push(pedal * 0.075 + (r() - 0.5) * 0.04, 0.05, 0.16 + r() * 0.16);
        }
      },
    },
    // The music stand: a tilted frame with staff lines on it
    {
      weight: 0.06,
      fill: (r, out) => {
        const tilt = -0.32;
        const w = 0.6;
        const h = 0.34;
        let u: number;
        let v: number;
        const pick = r();
        if (pick < 0.4) {
          // frame
          const side = Math.floor(r() * 4);
          if (side === 0) { u = (r() - 0.5) * w; v = 0; }
          else if (side === 1) { u = (r() - 0.5) * w; v = h; }
          else if (side === 2) { u = -w / 2; v = r() * h; }
          else { u = w / 2; v = r() * h; }
        } else {
          // five staff lines of sheet music
          const line = Math.floor(r() * 5);
          u = (r() - 0.5) * (w - 0.08);
          v = h * 0.35 + line * 0.035;
        }
        out.push(u, RIM_TOP + 0.1 + v * Math.cos(tilt), -0.1 + v * Math.sin(tilt));
      },
    },
  ];

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);

  let index = 0;
  const buffer: number[] = [];

  parts.forEach((part, partIndex) => {
    const isLast = partIndex === parts.length - 1;
    const share = isLast ? count - index : Math.round((part.weight / totalWeight) * count);
    for (let n = 0; n < share && index < count; n++) {
      buffer.length = 0;
      keyScratch.midi = -1;
      part.fill(rand, buffer);
      target[index * 3] = buffer[0]!;
      target[index * 3 + 1] = buffer[1]!;
      target[index * 3 + 2] = buffer[2]!;
      if (keyScratch.midi >= 0) keyAttr[index] = keyScratch.midi - 21;
      index++;
    }
  });

  // Starting positions: five staff lines drifting across the room.
  for (let i = 0; i < count; i++) {
    const line = Math.floor(rand() * 5);
    start[i * 3] = (rand() - 0.5) * 7.2;
    start[i * 3 + 1] = 1.15 + (line - 2) * 0.075;
    start[i * 3 + 2] = (rand() - 0.5) * 0.9 - 0.7;
    randoms[i] = rand();
  }

  return { count, target, start, rand: randoms, key: keyAttr };
}
