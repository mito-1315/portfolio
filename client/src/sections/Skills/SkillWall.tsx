import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Skill } from "./skillsData";

type SkillWallProps = {
  skills: Skill[];
  onSelect: (skill: Skill) => void;
  onHover: (skill: Skill) => void;
  onHoverEnd: () => void;
};

const INNER_LANES = 5;
const LANE_SPEEDS = [24, 30, 21, 33, 26, 29, 22]; // px per second
const LANE_COUNT = 7;
const LAST_LANE = LANE_COUNT - 1;
const NORMAL_WIDTH = 430;
const EXPANDED_WIDTH = 560;
const VIEWPORT_PAD = 8;
const COLLAPSE_DELAY = 140;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const estimateWidth = (skill: Skill) => skill.name.length * 6.1 + 38 + 8;

// One loop "set" must be wider than the widest wall so two copies always
// cover the lane. Estimate is conservative (real widths are close to it).
const MIN_SET_WIDTH = 700;

/**
 * Builds seven lanes. Skills are dealt from a shuffled deck, so a lane never
 * repeats a skill inside its own loop, neighbouring lanes get different
 * skills, and across the wall skills repeat naturally to keep every lane full.
 */
function buildLanes(skills: Skill[]): Skill[][] {
  let deck = shuffle(skills);

  return Array.from({ length: LANE_COUNT }, () => {
    const lane: Skill[] = [];
    let width = 0;

    while (width < MIN_SET_WIDTH && lane.length < skills.length) {
      if (deck.length === 0) deck = shuffle(skills);
      const next = deck.pop() as Skill;
      if (lane.some((s) => s.name === next.name)) continue;
      lane.push(next);
      width += estimateWidth(next);
    }

    return lane;
  });
}

function SkillWall({ skills, onSelect, onHover, onHoverEnd }: SkillWallProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const isExpanded = hovered || pinned || keyboardFocus;

  const stageRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  // One progress value per lane; the tween drives it, render() maps it to x.
  const drivers = useRef(
    Array.from({ length: LANE_COUNT }, () => ({
      p: 0.5,
      tween: null as gsap.core.Tween | null,
    }))
  );
  const renderAllRef = useRef<() => void>(() => {});
  const syncSizesRef = useRef<(animate: boolean) => void>(() => {});
  const expandedRef = useRef(isExpanded);
  const readyRef = useRef(false);
  const collapseTimer = useRef(0);
  const lastPointer = useRef("mouse");

  const lanes = useMemo(() => buildLanes(skills), [skills]);

  // ---- setup: lane drivers, sizing, resize handling --------------------
  useEffect(() => {
    const stage = stageRef.current;
    const wall = wallRef.current;
    const viewport = viewportRef.current;
    const stack = stackRef.current;
    if (!stage || !wall || !viewport || !stack) return;

    const laneDrivers = drivers.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const outerLanes = () =>
      [laneRefs.current[0], laneRefs.current[LAST_LANE]].filter(
        Boolean
      ) as HTMLDivElement[];

    // Seamless loop: the track holds two identical sets. Even lanes
    // (1st, 3rd, …) travel right → left, odd lanes left → right; x wraps by
    // exactly one set width, so the join is invisible.
    const renderLane = (index: number) => {
      const track = trackRefs.current[index];
      const set = track?.firstElementChild as HTMLElement | null;
      if (!track || !set) return;

      const setWidth = set.offsetWidth;
      const p = drivers.current[index].p;
      const x = index % 2 === 0 ? -p * setWidth : (p - 1) * setWidth;
      gsap.set(track, { x });
    };

    const renderAll = () => {
      for (let i = 0; i < LANE_COUNT; i++) renderLane(i);
    };
    renderAllRef.current = renderAll;

    const ctx = gsap.context(() => {
      if (!reduceMotion) {
        drivers.current.forEach((driver, index) => {
          const set = trackRefs.current[index]?.firstElementChild;
          const setWidth = (set as HTMLElement | null)?.offsetWidth || 700;

          driver.p = Math.random();
          driver.tween = gsap.to(driver, {
            p: 1,
            duration: setWidth / LANE_SPEEDS[index],
            ease: "none",
            repeat: -1,
            onUpdate: () => renderLane(index),
          });
          driver.tween.progress(driver.p);
        });
      }
    }, stage);

    const measure = () => {
      const lane = laneRefs.current[0];
      const pillHeight = lane?.offsetHeight ?? 34;
      const rowGap = parseFloat(getComputedStyle(stack).rowGap);
      const gap = Number.isNaN(rowGap) ? 0 : rowGap;
      const zone =
        parseFloat(getComputedStyle(wall).getPropertyValue("--wall-zone")) ||
        64;
      const viewportHeight = (n: number) =>
        n * pillHeight + (n - 1) * gap + VIEWPORT_PAD * 2;
      const stageWidth = stage.clientWidth;

      return {
        width: Math.min(NORMAL_WIDTH, stageWidth),
        expandedWidth: Math.min(EXPANDED_WIDTH, stageWidth),
        viewport: viewportHeight(INNER_LANES),
        expandedViewport: viewportHeight(LANE_COUNT),
        zone,
      };
    };

    const syncSizes = (animate: boolean) => {
      const m = measure();
      const open = expandedRef.current;
      const vars = {
        width: open ? m.expandedWidth : m.width,
        height: (open ? m.expandedViewport : m.viewport) + m.zone * 2,
      };
      const viewportVars = {
        height: open ? m.expandedViewport : m.viewport,
      };
      const outerVars = {
        opacity: open ? 1 : 0,
        scale: open ? 1 : 0.92,
      };

      stage.style.height = `${m.expandedViewport + m.zone * 2}px`;
      gsap.killTweensOf([wall, viewport, ...outerLanes()]);

      if (!animate) {
        gsap.set(wall, vars);
        gsap.set(viewport, viewportVars);
        gsap.set(outerLanes(), outerVars);
        renderAll();
        return;
      }

      const ease = "power3.inOut";
      gsap.to(wall, {
        ...vars,
        duration: 0.85,
        ease,
        onUpdate: renderAll,
        onComplete: renderAll,
      });
      gsap.to(viewport, { ...viewportVars, duration: 0.85, ease });
      gsap.to(outerLanes(), {
        ...outerVars,
        duration: open ? 0.6 : 0.4,
        delay: open ? 0.2 : 0,
        ease: "power2.out",
        stagger: 0.05,
      });
    };
    syncSizesRef.current = (animate) => ctx.add(() => syncSizes(animate));

    syncSizes(false);
    readyRef.current = true;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!gsap.isTweening(wall)) syncSizes(false);
        renderAll();
      });
    });
    observer.observe(stage);

    return () => {
      readyRef.current = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(collapseTimer.current);
      observer.disconnect();
      ctx.revert();
      laneDrivers.forEach((d) => (d.tween = null));
    };
  }, [lanes]);

  // ---- expand / collapse ----------------------------------------------
  useEffect(() => {
    expandedRef.current = isExpanded;
    if (readyRef.current) syncSizesRef.current(true);
  }, [isExpanded]);

  // ---- hover handling ------------------------------------------------
  const isMouse = (event: React.PointerEvent) => event.pointerType === "mouse";

  const openWall = () => {
    window.clearTimeout(collapseTimer.current);
    setHovered(true);
  };

  const closeWall = () => {
    window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(
      () => setHovered(false),
      COLLAPSE_DELAY
    );
  };

  const setLaneSpeed = useCallback((index: number, scale: number) => {
    const tween = drivers.current[index]?.tween;
    if (!tween) return;
    gsap.killTweensOf(tween);
    gsap.to(tween, {
      timeScale: scale,
      duration: scale === 0 ? 0.45 : 0.7,
      ease: "power2.out",
    });
  }, []);

  return (
    <div ref={stageRef} className="skill-wall-stage">
      <div
        ref={wallRef}
        className={`skill-wall ${isExpanded ? "expanded" : ""}`}
        onPointerEnter={(e) => isMouse(e) && openWall()}
        onPointerLeave={(e) => {
          if (isMouse(e)) {
            closeWall();
            onHoverEnd();
          }
        }}
        onFocus={(e) => {
          if (e.target.matches(":focus-visible")) setKeyboardFocus(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setKeyboardFocus(false);
          }
        }}
      >
        <button
          type="button"
          className="skill-wall-caption skill-wall-caption-top"
          onClick={() => setPinned((value) => !value)}
          aria-expanded={isExpanded}
        >
          <span>AN INTERACTIVE TOOLKIT</span>
          <span className="skill-wall-caption-action" aria-hidden="true">
            {isExpanded ? "−" : "+"}
          </span>
        </button>

        <div ref={viewportRef} className="skill-wall-viewport">
          <div ref={stackRef} className="skill-wall-stack">
            {lanes.map((lane, index) => {
              const isOuter = index === 0 || index === LAST_LANE;

              return (
                <div
                  key={index}
                  ref={(el) => {
                    laneRefs.current[index] = el;
                  }}
                  className={`skill-wall-lane ${isOuter ? "is-outer" : ""}`}
                  inert={isOuter && !isExpanded}
                  onPointerEnter={(e) => isMouse(e) && setLaneSpeed(index, 0)}
                  onPointerLeave={(e) => isMouse(e) && setLaneSpeed(index, 1)}
                >
                  <div
                    ref={(el) => {
                      trackRefs.current[index] = el;
                    }}
                    className="skill-wall-track"
                  >
                    {[0, 1].map((copy) => (
                      <div
                        key={copy}
                        className="skill-wall-set"
                        inert={copy === 1}
                        aria-hidden={copy === 1}
                      >
                        {lane.map((skill) => (
                          <button
                        key={skill.name}
                        type="button"
                        className="skill-wall-pill"
                        onPointerDown={(e) => {
                          lastPointer.current = e.pointerType;
                        }}
                        onPointerEnter={(e) => isMouse(e) && onHover(skill)}
                        onFocus={(e) => {
                          if (e.target.matches(":focus-visible")) {
                            onHover(skill);
                          }
                        }}
                        onClick={() => {
                          if (lastPointer.current !== "mouse") onHover(skill);
                          onSelect(skill);
                        }}
                        aria-label={`Explore ${skill.name}`}
                      >
                        <span>{skill.name}</span>
                        <span className="skill-wall-note" aria-hidden="true">
                          ♪
                        </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="skill-wall-caption skill-wall-caption-bottom"
          onClick={() => onSelect(skills[0])}
        >
          <span>EXPLORE ↗</span>
        </button>
      </div>
    </div>
  );
}

export default SkillWall;
