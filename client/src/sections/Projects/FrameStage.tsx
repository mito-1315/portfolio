import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useSound } from "../../audio/SoundContext";
import { projects, type Project } from "./projectsData";
import { BuildContent, OverviewContent, StoryContent } from "./FrameContent";
import {
  CHILD_OFFSET,
  CHILD_SCALE,
  FRAME_H,
  FRAME_W,
  LEVEL_TILT,
  LEVEL_TITLES,
  WORLD_TILT,
  blend,
  buildViews,
  cameraTransform,
  worldCentre,
  type View,
} from "./frameCamera";

gsap.registerPlugin(ScrollTrigger);

type Focus = { project: number; level: number } | null;

type FrameProps = {
  project: Project;
  index: number;
  level: number;
  focus: Focus;
  onOpen: (project: Project) => void;
};

/** One frame, holding the next level down as a smaller frame in its corner. */
function Frame({ project, index, level, focus, onOpen }: FrameProps) {
  const focused = focus?.project === index && focus.level === level;
  // A parent of the frame the camera is on: its own text steps back.
  const behind = focus?.project === index && focus.level > level;
  const Content = level === 0 ? OverviewContent : level === 1 ? StoryContent : BuildContent;

  return (
    <div
      className={`frame level-${level} ${focused ? "focus" : ""} ${behind ? "behind" : ""}`}
      style={{ width: FRAME_W, height: FRAME_H }}
    >
      <div className="frame-bar" aria-hidden="true">
        <span>{LEVEL_TITLES[level]}</span>
        <span>
          {String(level + 1).padStart(2, "0")} / 03
        </span>
      </div>

      {/* Only the frame the camera is on can be reached by keyboard or pointer. */}
      <div className="frame-content" inert={!focused}>
        <Content project={project} onOpen={onOpen} />
      </div>

      {level < 2 && (
        <div
          className="frame-child"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            transform: `translate(${CHILD_OFFSET.x}px, ${CHILD_OFFSET.y}px) rotate(${
              LEVEL_TILT[level + 1] ?? 0
            }deg) scale(${CHILD_SCALE})`,
          }}
        >
          <Frame
            project={project}
            index={index}
            level={level + 1}
            focus={focus}
            onOpen={onOpen}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The pinned stage. Scrolling flies a camera through the frames: into each
 * project's nested layers, then diagonally across to the next project.
 */
function FrameStage({ onOpen }: { onOpen: (project: Project) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<Focus>({ project: 0, level: 0 });
  // The last frame the camera rested on, so the readout stays meaningful in flight.
  const [lastFocus, setLastFocus] = useState<Focus>({ project: 0, level: 0 });
  const focusRef = useRef<Focus>({ project: 0, level: 0 });
  const { play, playMotif } = useSound();

  useGSAP(
    () => {
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      const ground = groundRef.current;
      if (!stage || !canvas || !ground) return;

      const proxy = { t: 0 };
      let views: View[] = [];

      const apply = () => {
        const vw = stage.clientWidth;
        const vh = stage.clientHeight;
        views = buildViews(projects.length, vw, vh);

        const last = views.length - 1;
        const t = Math.min(Math.max(proxy.t, 0), last);
        const j = Math.min(Math.floor(t), last - 1);
        const a = views[j]!;
        const b = views[j + 1]!;
        const view = blend(a, b, t - j);

        canvas.style.transform = cameraTransform(view, vw, vh);
        // The ground drifts more slowly than the frames, for depth.
        ground.style.backgroundPosition = `${-view.cx * 0.22}px ${-view.cy * 0.22}px`;

        // Which frame is the camera resting on?
        const nearest = Math.round(t);
        const rest = views[nearest];
        const next: Focus =
          rest && rest.project !== null && rest.level !== null && Math.abs(t - nearest) < 0.14
            ? { project: rest.project, level: rest.level }
            : null;
        const prev = focusRef.current;
        if (next?.project !== prev?.project || next?.level !== prev?.level) {
          focusRef.current = next;
          setFocus(next);
          if (next) {
            setLastFocus(next);
            const entered = projects[next.project];
            if (next.level === 0 && entered) playMotif(entered.motif);
            else play(["C5", "E5", "G5"][next.level] ?? "C5");
          }
        }
      };

      // Views are built from the stage's current size, so the tween only
      // needs to know how many stops there are.
      const stops = buildViews(projects.length, 1000, 600);
      const last = stops.length - 1;

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * 0.55 * totalUnits(stops))}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: apply,
      });

      for (let j = 0; j < last; j++) {
        const isFlight = stops[j]!.project === null || stops[j + 1]!.project === null;
        timeline.fromTo(
          proxy,
          { t: j },
          { t: j + 1, duration: isFlight ? 0.8 : 1, ease: "power2.inOut" }
        );
        // Rest on each frame for a moment so it can be read.
        if (stops[j + 1]!.project !== null) timeline.to({}, { duration: 0.4 });
      }

      apply();
      const onResize = () => apply();
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    },
    { scope: stageRef }
  );

  const shown = focus ?? lastFocus;

  return (
    <div ref={stageRef} className="frame-stage">
      <div ref={groundRef} className="frame-ground" aria-hidden="true" />

      <div ref={canvasRef} className="frame-canvas">
        {projects.map((project, index) => {
          const centre = worldCentre(index);
          return (
            <div
              key={project.id}
              className="frame-world"
              style={{
                left: centre.x - FRAME_W / 2,
                top: centre.y - FRAME_H / 2,
                transform: `rotate(${WORLD_TILT[index % WORLD_TILT.length] ?? 0}deg)`,
              }}
            >
              <Frame project={project} index={index} level={0} focus={focus} onOpen={onOpen} />
            </div>
          );
        })}
      </div>

      <div className="frame-hud">
        <span>
          PROJECT {shown ? projects[shown.project]?.numeral : "—"} / IV
        </span>
        <span className="frame-dots" aria-hidden="true">
          {[0, 1, 2].map((level) => (
            <i key={level} className={focus?.level === level ? "on" : ""} />
          ))}
        </span>
        <span>{focus ? LEVEL_TITLES[focus.level]?.toUpperCase() : "IN FLIGHT"}</span>
      </div>

      <a className="frame-skip" href="#experience">
        Skip the tour ↓
      </a>
    </div>
  );
}

/** Total length of the camera timeline, in the same units as the tweens above. */
function totalUnits(stops: View[]): number {
  let units = 0;
  for (let j = 0; j < stops.length - 1; j++) {
    const isFlight = stops[j]!.project === null || stops[j + 1]!.project === null;
    units += isFlight ? 0.8 : 1;
    if (stops[j + 1]!.project !== null) units += 0.4;
  }
  return units;
}

export default FrameStage;
