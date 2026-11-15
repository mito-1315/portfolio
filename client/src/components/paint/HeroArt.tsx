import { useEffect, useRef } from "react";
import gsap from "gsap";
import Splat from "./Splat";

/**
 * The artwork on the hero's empty right side: the tagline's ampersand
 * ("Between Logic & Melody") over a paint splat, with notes drifting around
 * it. The layers move a little differently as the pointer moves.
 */
function HeroArt() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const layers = [...root.querySelectorAll<HTMLElement>("[data-depth]")];
    const setters = layers.map((layer) => ({
      x: gsap.quickTo(layer, "x", { duration: 0.9, ease: "power3.out" }),
      y: gsap.quickTo(layer, "y", { duration: 0.9, ease: "power3.out" }),
      depth: Number(layer.dataset.depth),
    }));

    const onMove = (event: PointerEvent) => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      setters.forEach(({ x, y, depth }) => {
        x(nx * depth);
        y(ny * depth);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={rootRef} className="hero-art" aria-hidden="true">
      <div className="hero-art-layer" data-depth="-26">
        <Splat seed={7} className="hero-splat accent" />
      </div>
      <div className="hero-art-layer" data-depth="18">
        <Splat seed={21} className="hero-splat ink" />
      </div>
      <div className="hero-art-layer hero-amp" data-depth="46">
        <span>&amp;</span>
      </div>
      <div className="hero-art-layer" data-depth="70">
        <span className="hero-note n1">♪</span>
        <span className="hero-note n2">♫</span>
        <span className="hero-note n3">♩</span>
        <span className="hero-note n4">♬</span>
      </div>
    </div>
  );
}

export default HeroArt;
