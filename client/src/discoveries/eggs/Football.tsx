import { useCallback, useEffect, useRef, useState } from "react";
import { useSound } from "../../audio/SoundContext";

const SIZE = 58;
const GRAVITY = 1700;
const KICK = 640;
/** A little tune the ball plays as the juggle count climbs. */
const LADDER = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5"];

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  active: boolean;
  raf: number;
  lastFrame: number;
};

/**
 * A football tucked in the corner. Click it to kick it up, and keep it in the
 * air by clicking again. Every juggle plays the next note of a rising tune.
 */
function Football({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const ball = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, active: false, raf: 0, lastFrame: 0 });
  const juggles = useRef(0);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef(0);
  const { play } = useSound();
  const playRef = useRef(play);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const ground = () => window.innerHeight - SIZE - 6;

  const paint = useCallback(() => {
    const b = ball.current;
    if (ref.current) ref.current.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${b.angle}deg)`;
  }, []);

  /** Rest half hidden in the bottom-right corner. */
  const home = useCallback(() => {
    const b = ball.current;
    b.x = window.innerWidth - SIZE * 0.55;
    b.y = ground();
    b.vx = 0;
    b.vy = 0;
    b.angle = 0;
    b.spin = 0;
    b.active = false;
    paint();
  }, [paint]);

  const finish = useCallback(() => {
    const b = ball.current;
    b.active = false;
    b.raf = 0;
    const total = juggles.current;
    if (total > 0) {
      setMessage(total === 1 ? "1 juggle" : `${total} juggles`);
      window.clearTimeout(messageTimer.current);
      messageTimer.current = window.setTimeout(() => setMessage(null), 2600);
    }
    juggles.current = 0;
    setCount(0);
  }, []);

  const step = useCallback(
    function tick(time: number) {
      const b = ball.current;
      const dt = Math.min(0.04, Math.max(0.001, (time - b.lastFrame) / 1000));
      b.lastFrame = time;

      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;

      const maxX = window.innerWidth - SIZE;
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * 0.7; }

      const floor = ground();
      if (b.y >= floor) {
        b.y = floor;
        if (Math.abs(b.vy) < 150) {
          // It has settled: the juggle is over.
          b.vy = 0;
          b.vx *= 0.5;
          paint();
          finish();
          return;
        }
        b.vy = -b.vy * 0.5;
        b.vx *= 0.8;
        b.spin *= 0.8;
      }

      paint();
      b.raf = requestAnimationFrame(tick);
    },
    [paint, finish]
  );

  useEffect(() => {
    if (visible) home();
    else {
      cancelAnimationFrame(ball.current.raf);
      ball.current.active = false;
      juggles.current = 0;
      setCount(0);
      setMessage(null);
    }
  }, [visible, home]);

  useEffect(
    () => () => {
      cancelAnimationFrame(ball.current.raf);
      window.clearTimeout(messageTimer.current);
    },
    []
  );

  const kick = () => {
    const b = ball.current;

    // With reduced motion the ball stays put: each click still counts and plays its note.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      juggles.current += 1;
      setCount(juggles.current);
      playRef.current(LADDER[(juggles.current - 1) % LADDER.length] ?? "C4");
      window.clearTimeout(messageTimer.current);
      messageTimer.current = window.setTimeout(finish, 1600);
      return;
    }

    // The first kick starts a juggle; later ones only count while the ball is in the air.
    const airborne = b.active && b.y < ground() - 8;
    if (b.active && !airborne) return;

    juggles.current += 1;
    setCount(juggles.current);
    playRef.current(LADDER[(juggles.current - 1) % LADDER.length] ?? "C4");

    if (!b.active) {
      b.active = true;
      // Bring a half-hidden ball into view on the first kick.
      b.vx = -220;
      b.lastFrame = performance.now();
      b.raf = requestAnimationFrame(step);
    }
    // Aim loosely toward the middle of the screen, with some wobble.
    const toCentre = window.innerWidth / 2 - b.x;
    b.vx = Math.sign(toCentre) * (60 + Math.random() * 120) + (Math.random() - 0.5) * 80;
    b.vy = -(KICK + Math.random() * 120);
    b.spin = (Math.random() - 0.5) * 900;
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`egg egg-ball ${visible ? "on" : ""}`}
        onClick={kick}
        tabIndex={visible ? 0 : -1}
        aria-label="A football, number ten. Click to kick it up, and keep it in the air."
      >
        <svg viewBox="0 0 58 58" aria-hidden="true">
          <circle cx="29" cy="29" r="27" fill="#fffdf9" stroke="currentColor" strokeWidth="2" />
          <path d="M29 17 L39 24 L35 36 H23 L19 24 Z" fill="currentColor" />
          <path d="M29 17 V4 M39 24 L51 20 M35 36 L43 47 M23 36 L15 47 M19 24 L7 20" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        <span className="egg-ball-ten">10</span>
      </button>
      {(count > 0 || message) && visible && (
        <div className="egg-score" role="status" aria-live="polite">
          {count > 0 ? <b>{count}</b> : null}
          {count > 0 ? (count === 1 ? " JUGGLE" : " JUGGLES") : message?.toUpperCase()}
        </div>
      )}
    </>
  );
}

export default Football;
