import { lazy, Suspense, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import PianoFallback from "./PianoFallback";
import VirtualPiano from "./VirtualPiano";
import GuessSong from "./guess/GuessSong";
import type { PianoProgress } from "./ParticlePiano";
import "./MusicRoom.css";

gsap.registerPlugin(ScrollTrigger);

// The 3D piano and the track player are only downloaded when the section is near view.
const ParticlePiano = lazy(() => import("./ParticlePiano"));
const MusicPlayer = lazy(() => import("./MusicPlayer"));

type Mode = { use3D: boolean; particles: number };

/** Decides, once, whether this device gets the 3D piano and how dense it is. */
function chooseMode(): Mode {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let webgl: boolean;
  try {
    const probe = document.createElement("canvas");
    const gl = (probe.getContext("webgl2") ?? probe.getContext("webgl")) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    webgl = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }

  const width = window.innerWidth;
  let particles = width >= 1100 ? 18000 : width >= 700 ? 10000 : 5500;
  // Fewer particles on modest hardware.
  if ((navigator.hardwareConcurrency ?? 8) <= 4) particles = Math.round(particles * 0.7);

  return { use3D: webgl && !reduced, particles };
}

function MusicRoom() {
  const sectionRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const progress = useRef<PianoProgress>({ assemble: 0, orbit: 0 });

  const [mode] = useState(chooseMode);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);

  // Load the heavy parts shortly before they are needed, and run the 3D scene
  // only while it is on screen. IntersectionObserver is immune to layout shifts.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          preload.disconnect();
        }
      },
      { rootMargin: "80% 0px" }
    );
    const visible = new IntersectionObserver(([entry]) => setActive(Boolean(entry?.isIntersecting)), {
      rootMargin: "60px 0px",
    });
    preload.observe(hero);
    visible.observe(hero);
    return () => {
      preload.disconnect();
      visible.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      const hero = heroRef.current;
      if (!hero) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        progress.current.assemble = 1;
        progress.current.orbit = 0.5;
      } else {
        // Notes gather into the piano as it arrives, then the camera circles it.
        gsap.to(progress.current, {
          assemble: 1,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top 80%", end: "top 5%", scrub: 0.8 },
        });
        gsap.to(progress.current, {
          orbit: 1,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom bottom", scrub: 0.8 },
        });
        gsap.from(".music-overlay > *", {
          opacity: 0,
          y: 24,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: hero, start: "top 55%", once: true },
        });
      }

      gsap.from(".music-block", {
        opacity: 0,
        y: 28,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: ".music-instrument", start: "top 80%", once: true },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="music-section page-container" id="music">
      <div ref={heroRef} className="music-hero">
        <div className="music-sticky">
          <div className="music-canvas" data-active={active}>
            {mode.use3D && near ? (
              <Suspense fallback={<PianoFallback />}>
                <ParticlePiano count={mode.particles} progress={progress} active={active} />
              </Suspense>
            ) : (
              <PianoFallback />
            )}
          </div>

          <div className="music-overlay">
            <span className="section-label">THE MUSIC ROOM</span>
            <h2 className="music-title">
              Walk around
              <br />
              <span>the instrument.</span>
            </h2>
            <p className="music-lede">
              Scroll to circle the piano. Every note you play lights its key.
            </p>
          </div>
        </div>
      </div>

      <div className="music-instrument">
        <div className="music-block">
          <span className="section-label">PLAY IT YOURSELF</span>
          <VirtualPiano />
        </div>

        <div className="music-block">
          <span className="section-label">GUESS THE SONG</span>
          <GuessSong />
        </div>

        <div className="music-block">
          <span className="section-label">OR JUST LISTEN</span>
          {near ? (
            <Suspense fallback={<div className="player player-empty"><p>Loading…</p></div>}>
              <MusicPlayer />
            </Suspense>
          ) : (
            <div className="player player-empty" />
          )}
        </div>
      </div>
    </section>
  );
}

export default MusicRoom;
