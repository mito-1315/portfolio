import { useCallback, useEffect, useRef } from "react";
import { useSound } from "../../audio/SoundContext";

const SIZE = 46;
const HOME_MARGIN = 26;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_SPEED = 2400;
const MAX_SPIN = 1400;

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  dragging: boolean;
  grabX: number;
  grabY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  raf: number;
  lastFrame: number;
};

/**
 * A guitar pick you can pick up and throw. It slides, spins, bounces off the
 * edges of the window, and plinks a piano note when it hits hard.
 */
function GuitarPick({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const body = useRef<Body>({
    x: HOME_MARGIN,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -18,
    spin: 0,
    dragging: false,
    grabX: 0,
    grabY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    raf: 0,
    lastFrame: 0,
  });
  const { play } = useSound();
  const playRef = useRef(play);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const paint = useCallback(() => {
    const b = body.current;
    const el = ref.current;
    if (el) el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${b.angle}deg)`;
  }, []);

  const home = useCallback(() => {
    const b = body.current;
    b.x = HOME_MARGIN;
    b.y = window.innerHeight - SIZE - 34;
    b.vx = 0;
    b.vy = 0;
    b.angle = -18;
    b.spin = 0;
    paint();
  }, [paint]);

  const stop = useCallback(() => {
    cancelAnimationFrame(body.current.raf);
    body.current.raf = 0;
  }, []);

  const hit = (note: string, speed: number) => {
    if (speed > 260) playRef.current(note);
  };

  const step = useCallback(
    function tick(time: number) {
      const b = body.current;
      const dt = Math.min(0.05, Math.max(0.001, (time - b.lastFrame) / 1000));
      b.lastFrame = time;

      // Friction: the pick slows to a stop on its own.
      const drag = Math.pow(0.1, dt);
      b.vx *= drag;
      b.vy *= drag;
      b.spin *= Math.pow(0.25, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;

      const maxX = window.innerWidth - SIZE;
      const maxY = window.innerHeight - SIZE;
      if (b.x < 0) { b.x = 0; hit("C5", Math.abs(b.vx)); b.vx = -b.vx * 0.62; b.spin += b.vy * 0.2; }
      if (b.x > maxX) { b.x = maxX; hit("G5", Math.abs(b.vx)); b.vx = -b.vx * 0.62; b.spin -= b.vy * 0.2; }
      if (b.y < 0) { b.y = 0; hit("E5", Math.abs(b.vy)); b.vy = -b.vy * 0.62; b.spin += b.vx * 0.2; }
      if (b.y > maxY) { b.y = maxY; hit("A4", Math.abs(b.vy)); b.vy = -b.vy * 0.62; b.spin -= b.vx * 0.2; }

      paint();
      if (Math.hypot(b.vx, b.vy) < 6 && Math.abs(b.spin) < 8) {
        b.raf = 0;
        return;
      }
      b.raf = requestAnimationFrame(tick);
    },
    [paint]
  );

  const launch = useCallback(() => {
    const b = body.current;
    cancelAnimationFrame(b.raf);
    b.lastFrame = performance.now();
    b.raf = requestAnimationFrame(step);
  }, [step]);

  // Back to its corner whenever its section comes back into view.
  useEffect(() => {
    if (visible) home();
    else stop();
  }, [visible, home, stop]);

  useEffect(() => {
    const b = body.current;
    const onResize = () => {
      b.x = Math.min(b.x, window.innerWidth - SIZE);
      b.y = Math.min(b.y, window.innerHeight - SIZE);
      paint();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(b.raf);
    };
  }, [paint]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const b = body.current;
    stop();
    b.dragging = true;
    b.grabX = event.clientX - b.x;
    b.grabY = event.clientY - b.y;
    b.lastX = event.clientX;
    b.lastY = event.clientY;
    b.lastT = performance.now();
    b.vx = 0;
    b.vy = 0;
    b.spin = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const b = body.current;
    if (!b.dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - b.lastT) / 1000;
    // Smoothed velocity, so a throw carries the speed of the hand.
    b.vx = b.vx * 0.5 + ((event.clientX - b.lastX) / dt) * 0.5;
    b.vy = b.vy * 0.5 + ((event.clientY - b.lastY) / dt) * 0.5;
    b.lastX = event.clientX;
    b.lastY = event.clientY;
    b.lastT = now;
    b.x = event.clientX - b.grabX;
    b.y = event.clientY - b.grabY;
    b.angle += b.vx * 0.004;
    paint();
  };

  const onPointerUp = () => {
    const b = body.current;
    if (!b.dragging) return;
    b.dragging = false;
    // Holding still before letting go means no throw.
    if (performance.now() - b.lastT > 90) {
      b.vx = 0;
      b.vy = 0;
    }
    // With reduced motion the pick simply stays where it is dropped.
    if (reduced()) {
      b.vx = 0;
      b.vy = 0;
      b.spin = 0;
      return;
    }
    // A hard flick has a speed limit, so the pick stays readable.
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
      b.vx *= MAX_SPEED / speed;
      b.vy *= MAX_SPEED / speed;
    }
    b.spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, b.vx * 0.35));
    if (Math.hypot(b.vx, b.vy) > 20) launch();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (reduced()) {
      playRef.current("C5");
      return;
    }
    const b = body.current;
    b.vx = 520 + Math.random() * 300;
    b.vy = -(420 + Math.random() * 300);
    b.spin = 360;
    launch();
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`egg egg-pick ${visible ? "on" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      tabIndex={visible ? 0 : -1}
      aria-label="A guitar pick. Drag it and throw it, or press Enter to flick it."
    >
      <svg viewBox="0 0 46 46" aria-hidden="true">
        <path
          d="M23 3 C36 3 43 13 41 24 C39 34 30 43 23 43 C16 43 7 34 5 24 C3 13 10 3 23 3 Z"
          fill="currentColor"
        />
        <path d="M14 18 C18 14 28 14 32 18" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default GuitarPick;
