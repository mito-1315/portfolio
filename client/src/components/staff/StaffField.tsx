import { useEffect, useRef } from "react";
import { useSound } from "../../audio/SoundContext";
import { readRgbToken } from "../../theme/theme";
import "./StaffField.css";

/**
 * The staff, as an instrument. A few separate groups of five lines drift at
 * different depths behind the hero and About. Each line is a vibrating
 * string: sweep the cursor across it and it plucks, ripples, and (if sound is
 * on) sounds a piano note. Small notes ride the vibrations.
 *
 * It lives only above the Skills section: the loop stops, and the canvas is
 * hidden, once the visitor has scrolled past it, and wakes again on the way
 * back up.
 */

type Group = {
  /** Vertical position in page pixels, as a multiple of the hero height. */
  y: number;
  /** Horizontal extent, as fractions of the viewport width. */
  x0: number;
  x1: number;
  /** Line spacing in px. */
  gap: number;
  /** 1 moves with the page; lower values lag behind it (further away). */
  depth: number;
  /** Notes sounded by the five lines, top to bottom. */
  pitches: string[];
};

const GROUPS: Group[] = [
  { y: 0.15, x0: -0.02, x1: 0.34, gap: 9, depth: 0.78, pitches: ["G5", "E5", "D5", "C5", "A4"] },
  { y: 0.2, x0: 0.5, x1: 1.02, gap: 11, depth: 0.86, pitches: ["G5", "E5", "D5", "C5", "A4"] },
  { y: 0.62, x0: 0.62, x1: 1.02, gap: 10, depth: 0.92, pitches: ["G4", "E4", "D4", "C4", "A3"] },
  { y: 1.3, x0: 0.7, x1: 1.02, gap: 10, depth: 0.9, pitches: ["G4", "E4", "D4", "C4", "A3"] },
  { y: 1.85, x0: -0.02, x1: 0.26, gap: 10, depth: 0.84, pitches: ["E4", "D4", "C4", "A3", "G3"] },
];

/** Only these on small screens, where there is less room around the text. */
const MOBILE_GROUPS = [1, 2, 4];

const NODE_SPACING = 10;
const STIFFNESS = 0.22;
const DAMPING = 0.018;

type Line = {
  group: number;
  index: number;
  x0: number;
  count: number;
  disp: Float32Array;
  vel: Float32Array;
  energy: number;
  lastPluck: number;
};

type Note = {
  line: Line;
  /** Position along the line, in px from x0. */
  pos: number;
  speed: number;
  /** 0 = on the line, 0.5 = in the space below it. */
  space: number;
};

function StaffField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { play } = useSound();
  const playRef = useRef(play);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const content = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !content || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let heroH = 0;
    let limit = Infinity; // scrollY beyond which the staff is gone
    let lines: Line[] = [];
    let groups: { def: Group; lines: Line[]; pageY: number }[] = [];
    let notes: Note[] = [];
    let frame = 0;
    let running = false;
    // Line and note colours come from the active theme.
    let ink: [number, number, number] = [40, 35, 30];
    let accent: [number, number, number] = [217, 120, 54];
    const readColours = () => {
      ink = readRgbToken(document.documentElement, "--ink-rgb", ink);
      accent = readRgbToken(document.documentElement, "--accent-rgb", accent);
    };
    readColours();
    let lastX = -1;
    let lastY = -1;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const hero = document.getElementById("home");
      const skills = document.getElementById("skills");
      heroH = hero?.offsetHeight ?? height;
      const contentTop = content.getBoundingClientRect().top + window.scrollY;
      const skillsTop = skills
        ? skills.getBoundingClientRect().top + window.scrollY - contentTop
        : heroH * 2.5;
      // The CSS fade finishes when Skills is 35% down the screen.
      limit = skillsTop - height * 0.3;

      const small = width < 700;
      const defs = small ? MOBILE_GROUPS.map((i) => GROUPS[i]!) : GROUPS;

      lines = [];
      groups = defs.map((def, g) => {
        const x0 = def.x0 * width;
        const count = Math.max(8, Math.ceil(((def.x1 - def.x0) * width) / NODE_SPACING));
        const groupLines = Array.from({ length: 5 }, (_, index): Line => {
          const line: Line = {
            group: g,
            index,
            x0,
            count,
            disp: new Float32Array(count),
            vel: new Float32Array(count),
            energy: 0,
            lastPluck: 0,
          };
          lines.push(line);
          return line;
        });
        return { def, lines: groupLines, pageY: def.y * heroH };
      });

      // A few notes drift along the lines (fewer on small screens).
      notes = [];
      if (!reduced) {
        const total = small ? 3 : 7;
        for (let i = 0; i < total; i++) {
          const line = lines[Math.floor(Math.random() * lines.length)]!;
          notes.push({
            line,
            pos: Math.random() * (line.count * NODE_SPACING),
            speed: 12 + Math.random() * 16,
            space: Math.random() < 0.5 ? 0 : 0.5,
          });
        }
      }
    };

    const lineY = (group: { def: Group; pageY: number }, index: number) =>
      group.pageY - window.scrollY * group.def.depth + index * group.def.gap;

    const pluck = (line: Line, localX: number, amplitude: number, direction: number) => {
      const centre = Math.round(localX / NODE_SPACING);
      for (let k = -4; k <= 4; k++) {
        const i = centre + k;
        if (i <= 0 || i >= line.count - 1) continue;
        line.vel[i]! += direction * amplitude * Math.exp(-(k * k) / 5);
      }
      line.energy = Math.min(1, line.energy + amplitude / 10);
    };

    const onPointerMove = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      if (lastX >= 0 && window.scrollY < limit) {
        const dy = y - lastY;
        if (Math.abs(dy) > 0.5) {
          const now = performance.now();
          for (const group of groups) {
            const gx0 = group.def.x0 * width;
            const gx1 = group.def.x1 * width;
            if (x < gx0 || x > gx1) continue;
            for (const line of group.lines) {
              const ly = lineY(group, line.index);
              // The pointer crossed this line since the last move.
              if ((lastY - ly) * (y - ly) < 0) {
                const speed = Math.min(Math.abs(dy), 40);
                pluck(line, x - line.x0, 1.2 + speed * 0.12, Math.sign(dy));
                if (now - line.lastPluck > 160) {
                  line.lastPluck = now;
                  playRef.current(group.def.pitches[line.index]!);
                }
              }
            }
          }
        }
      }
      lastX = x;
      lastY = y;
    };

    const onPointerLeave = () => {
      lastX = -1;
    };

    const step = (dt: number) => {
      for (const line of lines) {
        const { disp, vel, count } = line;
        let energy = 0;
        for (let i = 1; i < count - 1; i++) {
          vel[i]! += (disp[i - 1]! + disp[i + 1]! - 2 * disp[i]!) * STIFFNESS - vel[i]! * DAMPING;
        }
        for (let i = 1; i < count - 1; i++) {
          disp[i]! += vel[i]!;
          energy += Math.abs(disp[i]!);
        }
        line.energy = Math.min(1, energy / (count * 1.2));
      }
      for (const note of notes) {
        note.pos += note.speed * dt;
        if (note.pos > note.line.count * NODE_SPACING) {
          note.pos = 0;
          note.line = lines[Math.floor(Math.random() * lines.length)]!;
          note.space = Math.random() < 0.5 ? 0 : 0.5;
        }
      }
    };

    const drawNote = (x: number, y: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(${accent.join(",")}, ${alpha})`;
      ctx.strokeStyle = `rgba(${accent.join(",")}, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.6, 3.3, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4.1, -1);
      ctx.lineTo(4.1, -20);
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const group of groups) {
        for (const line of group.lines) {
          const y = lineY(group, line.index);
          if (y < -40 || y > height + 40) continue;

          const x0 = line.x0;
          const heat = Math.min(1, line.energy * 3);
          ctx.lineWidth = 1;
          ctx.strokeStyle =
            heat > 0.04
              ? `rgba(${accent.join(",")}, ${0.16 + heat * 0.5})`
              : `rgba(${ink.join(",")}, 0.1)`;

          ctx.beginPath();
          ctx.moveTo(x0, y);
          for (let i = 1; i < line.count; i++) {
            ctx.lineTo(x0 + i * NODE_SPACING, y + line.disp[i]!);
          }
          ctx.stroke();
        }
      }

      // Notes ride the lines, and the line's ripple lifts them.
      for (const note of notes) {
        const group = groups[note.line.group];
        if (!group) continue;
        const y = lineY(group, note.line.index);
        if (y < -40 || y > height + 40) continue;
        const i = Math.min(note.line.count - 1, Math.max(0, Math.round(note.pos / NODE_SPACING)));
        const length = note.line.count * NODE_SPACING;
        const edge = Math.min(note.pos, length - note.pos) / 60;
        const alpha = 0.5 * Math.min(1, edge);
        drawNote(
          note.line.x0 + note.pos,
          y + note.space * group.def.gap + note.line.disp[i]!,
          alpha
        );
      }
    };

    const inRange = () => window.scrollY < limit;

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      if (!inRange() || document.hidden) {
        running = false;
        canvas.style.visibility = "hidden";
        return;
      }
      step(dt);
      draw();
      frame = requestAnimationFrame(loop);
    };

    let lastTime = performance.now();

    const wake = () => {
      if (reduced) {
        canvas.style.visibility = inRange() ? "visible" : "hidden";
        if (inRange()) draw();
        return;
      }
      if (!inRange()) {
        canvas.style.visibility = "hidden";
        return;
      }
      canvas.style.visibility = "visible";
      if (!running) {
        running = true;
        lastTime = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };

    build();
    wake();

    const onResize = () => {
      build();
      wake();
    };

    const onTheme = () => {
      readColours();
      if (reduced) draw();
    };
    window.addEventListener("themechange", onTheme);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", wake);
    if (!reduced) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
    }

    // Layout above this point can still shift (fonts, images): re-measure once things settle.
    const settle = window.setTimeout(onResize, 1200);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(content);

    return () => {
      cancelAnimationFrame(frame);
      running = false;
      window.clearTimeout(settle);
      resizeObserver.disconnect();
      window.removeEventListener("themechange", onTheme);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="staff-field" aria-hidden="true" />;
}

export default StaffField;
