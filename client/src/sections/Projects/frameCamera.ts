/**
 * Geometry for "frames within frames".
 *
 * Every project is a world: a large frame (level 0) that holds a smaller
 * frame (level 1), which holds a smaller one again (level 2). The worlds sit
 * along a diagonal on one big canvas, and a camera flies between frames:
 * zooming into the next layer, then across the diagonal to the next project.
 *
 * Frames are authored at one natural size and shown scaled down inside their
 * parent, so the same content is readable at every level once the camera is
 * on it. The numbers here must match the CSS in Frames.css.
 */

export const FRAME_W = 1000;
export const FRAME_H = 640;

/** A child frame is shown at this scale inside its parent. */
export const CHILD_SCALE = 0.46;

/** Where a child frame's centre sits, relative to its parent's centre (parent px). */
export const CHILD_OFFSET = { x: 230, y: 132 };

/** Extra tilt of each deeper level, relative to its parent, in degrees. */
export const LEVEL_TILT = [0, -5, 6];

/** Tilt of each project's outer frame, in degrees: the diagonal feel. */
export const WORLD_TILT = [-4, 3, -3, 4];

/** Distance between neighbouring worlds along the diagonal, in canvas px. */
export const WORLD_STEP = { x: 1500, y: 880 };

export type FrameWorld = {
  cx: number;
  cy: number;
  scale: number;
  rot: number;
};

export type View = {
  cx: number;
  cy: number;
  /** Camera zoom. */
  z: number;
  /** Camera roll, in degrees (the frame's own tilt, so it ends up upright). */
  theta: number;
  /** Which project and frame level this view rests on; null for fly-over views. */
  project: number | null;
  level: number | null;
};

export const worldCentre = (project: number) => ({
  x: project * WORLD_STEP.x,
  y: project * WORLD_STEP.y,
});

/** Position, scale and tilt of a project's frames at each of the three levels. */
export function framesOf(project: number): FrameWorld[] {
  const centre = worldCentre(project);
  const frames: FrameWorld[] = [
    { cx: centre.x, cy: centre.y, scale: 1, rot: WORLD_TILT[project % WORLD_TILT.length] ?? 0 },
  ];

  for (let level = 1; level <= 2; level++) {
    const parent = frames[level - 1]!;
    const rad = (parent.rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    frames.push({
      cx: parent.cx + parent.scale * (CHILD_OFFSET.x * cos - CHILD_OFFSET.y * sin),
      cy: parent.cy + parent.scale * (CHILD_OFFSET.x * sin + CHILD_OFFSET.y * cos),
      scale: parent.scale * CHILD_SCALE,
      rot: parent.rot + (LEVEL_TILT[level] ?? 0),
    });
  }
  return frames;
}

/** The zoom at which a frame's natural width fills the viewport comfortably. */
function zoomToFit(frame: FrameWorld, vw: number, vh: number): number {
  const fitWidth = Math.min(vw * 0.9, vh * 0.86 * (FRAME_W / FRAME_H));
  return fitWidth / (FRAME_W * frame.scale);
}

/**
 * The camera's stops, in order: for each project its three frames, with a
 * high fly-over view between projects so the diagonal journey is visible.
 */
export function buildViews(projectCount: number, vw: number, vh: number): View[] {
  const views: View[] = [];

  for (let p = 0; p < projectCount; p++) {
    const frames = framesOf(p);

    frames.forEach((frame, level) => {
      views.push({
        cx: frame.cx,
        cy: frame.cy,
        z: zoomToFit(frame, vw, vh),
        theta: frame.rot,
        project: p,
        level,
      });
    });

    if (p < projectCount - 1) {
      const last = frames[2]!;
      const nextFirst = framesOf(p + 1)[0]!;
      const span = Math.hypot(nextFirst.cx - last.cx, nextFirst.cy - last.cy);
      views.push({
        cx: (last.cx + nextFirst.cx) / 2,
        cy: (last.cy + nextFirst.cy) / 2,
        // Wide enough to see both worlds at once.
        z: Math.min(vw / (span * 0.95 + FRAME_W * 0.8), 0.9),
        theta: (last.rot + nextFirst.rot) / 2,
        project: null,
        level: null,
      });
    }
  }
  return views;
}

/** Blend between two views: centre and roll linearly, zoom exponentially. */
export function blend(a: View, b: View, u: number): Omit<View, "project" | "level"> {
  return {
    cx: a.cx + (b.cx - a.cx) * u,
    cy: a.cy + (b.cy - a.cy) * u,
    z: a.z * Math.pow(b.z / a.z, u),
    theta: a.theta + (b.theta - a.theta) * u,
  };
}

/** CSS transform that places the canvas so the given view is centred on screen. */
export function cameraTransform(
  view: Pick<View, "cx" | "cy" | "z" | "theta">,
  vw: number,
  vh: number
): string {
  return (
    `translate(${vw / 2}px, ${vh / 2}px) rotate(${-view.theta}deg) ` +
    `scale(${view.z}) translate(${-view.cx}px, ${-view.cy}px)`
  );
}

/** Names of the three frame levels, shown in the stage readout. */
export const LEVEL_TITLES = ["Overview", "The story", "How it works"];
