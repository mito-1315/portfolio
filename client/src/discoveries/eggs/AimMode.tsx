import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { useSound } from "../../audio/SoundContext";
import { fallbackSettings, useApi, type Settings } from "../../services/api";

type Target = { id: number; x: number; y: number };

const TARGET_LIFETIME = 2600;
const HIT_RADIUS = 30;

/**
 * A small crosshair tucked in the margin. Clicking it turns the page into an
 * aim trainer: the cursor becomes a crosshair, orbs drift up, and clicks fire
 * at them. Escape (or the ring) puts everything back.
 */
function AimMode({ visible }: { visible: boolean }) {
  const [aiming, setAiming] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [hits, setHits] = useState(0);
  const [shots, setShots] = useState(0);

  const crosshair = useRef<HTMLDivElement>(null);
  const targetsRef = useRef<Target[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const { play } = useSound();
  const playRef = useRef(play);
  const { data: settings } = useApi<Settings>("/settings", fallbackSettings);
  const tag = settings.valorant_tag ?? fallbackSettings.valorant_tag;

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const exit = useCallback(() => {
    setAiming(false);
    setTargets([]);
    targetsRef.current = [];
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  // Leaving the section ends the session.
  useEffect(() => {
    if (visible || !aiming) return;
    const id = window.setTimeout(exit, 0);
    return () => window.clearTimeout(id);
  }, [visible, aiming, exit]);

  useEffect(() => {
    if (!aiming) return;

    document.documentElement.classList.add("aim-mode");

    const move = (event: PointerEvent) => {
      if (crosshair.current) {
        crosshair.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }
    };

    const fire = (event: MouseEvent) => {
      const el = event.target as HTMLElement | null;
      // The exit controls keep working normally.
      if (el?.closest("[data-aim-keep]")) return;
      event.preventDefault();
      event.stopPropagation();

      setShots((s) => s + 1);
      // Orbs drift as they fade, so test against where each one is drawn right now.
      let hitId: number | null = null;
      document.querySelectorAll<HTMLElement>(".aim-target").forEach((orb) => {
        const rect = orb.getBoundingClientRect();
        const reach = Math.max(HIT_RADIUS, rect.width / 2 + 8);
        const distance = Math.hypot(
          rect.left + rect.width / 2 - event.clientX,
          rect.top + rect.height / 2 - event.clientY
        );
        if (distance <= reach) hitId = Number(orb.dataset.id);
      });
      if (hitId !== null) {
        targetsRef.current = targetsRef.current.filter((t) => t.id !== hitId);
        setTargets(targetsRef.current);
        setHits((h) => h + 1);
        playRef.current("E6");
      } else {
        playRef.current("A3");
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit();
    };

    // Orbs drift in at random spots for as long as the mode is on.
    const spawn = window.setInterval(() => {
      const target: Target = {
        id: nextId.current++,
        x: 80 + Math.random() * (window.innerWidth - 160),
        y: 150 + Math.random() * (window.innerHeight - 300),
      };
      targetsRef.current = [...targetsRef.current, target];
      setTargets(targetsRef.current);
      timers.current.push(
        window.setTimeout(() => {
          targetsRef.current = targetsRef.current.filter((t) => t.id !== target.id);
          setTargets(targetsRef.current);
        }, TARGET_LIFETIME)
      );
    }, 1000);

    window.addEventListener("pointermove", move);
    window.addEventListener("click", fire, true);
    window.addEventListener("keydown", onKey);

    return () => {
      document.documentElement.classList.remove("aim-mode");
      window.clearInterval(spawn);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("click", fire, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [aiming, exit]);

  const toggle = () => {
    if (aiming) {
      exit();
      return;
    }
    setHits(0);
    setShots(0);
    setAiming(true);
  };

  return (
    <>
      <button
        type="button"
        data-aim-keep
        className={`egg egg-aim ${visible || aiming ? "on" : ""}`}
        onClick={toggle}
        tabIndex={visible ? 0 : -1}
        aria-pressed={aiming}
        aria-label={aiming ? "Leave aim mode" : "A small crosshair in the margin. Start aim mode."}
      >
        <Crosshair size={20} strokeWidth={1.5} />
      </button>

      {aiming && (
        <>
          <div className="aim-hud" data-aim-keep role="status">
            <span>AIM</span>
            <b>{tag}</b>
            <span>
              HITS {hits} / {shots}
            </span>
            <button type="button" data-aim-keep onClick={exit}>
              ESC
            </button>
          </div>

          {targets.map((target) => (
            <i key={target.id} data-id={target.id} className="aim-target" style={{ left: target.x, top: target.y }} aria-hidden="true" />
          ))}

          <div ref={crosshair} className="aim-crosshair" aria-hidden="true">
            <i /> <i /> <i /> <i />
          </div>
        </>
      )}
    </>
  );
}

export default AimMode;
