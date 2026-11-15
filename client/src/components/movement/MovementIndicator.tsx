import { useEffect, useState } from "react";
import { movements } from "./movements";
import "./Movement.css";

/**
 * A small "now playing" marker: which movement of the piece the visitor is in.
 * Purely informational, so it is hidden from assistive technology.
 */
function MovementIndicator() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Whichever section is crossing the middle of the screen decides the movement.
    // Read from the layout directly, so it can never go stale.
    const update = () => {
      const middle = window.innerHeight / 2;
      for (let i = 0; i < movements.length; i++) {
        const hit = movements[i]!.sections.some((id) => {
          const rect = document.getElementById(id)?.getBoundingClientRect();
          return rect !== undefined && rect.top <= middle && rect.bottom > middle;
        });
        if (hit) {
          setActive(i);
          return;
        }
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const current = movements[active] ?? movements[0]!;

  return (
    <div className="movement-indicator" aria-hidden="true">
      <span className="movement-ticks">
        {movements.map((m, i) => (
          <i key={m.numeral} className={i === active ? "on" : i < active ? "past" : ""} />
        ))}
      </span>
      <span className="movement-name">
        <b>{current.numeral}</b> {current.name}
      </span>
    </div>
  );
}

export default MovementIndicator;
