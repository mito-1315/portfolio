import { useCallback, useEffect, useState } from "react";
import type { Project } from "./projectsData";
import FrameStage from "./FrameStage";
import StaticFrames from "./StaticFrames";
import ProjectCaseFile from "./ProjectCaseFile";
import "./Projects.css";
import "./Frames.css";

/** The camera tour needs room and motion; everyone else gets the static frames. */
const IMMERSIVE_QUERY =
  "(min-width: 900px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)";

function useImmersive(): boolean {
  const [immersive, setImmersive] = useState(() => window.matchMedia(IMMERSIVE_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(IMMERSIVE_QUERY);
    const onChange = () => setImmersive(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return immersive;
}

function Projects() {
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const immersive = useImmersive();

  const closeCaseFile = useCallback(() => setOpenProject(null), []);

  return (
    <section className="projects-section page-container" id="projects">
      <div className="projects-heading">
        <span className="section-label">THE FRAMES · SELECTED WORKS</span>
        <h2>
          Things I&apos;ve
          <br />
          <span>brought to life.</span>
        </h2>
        <p>
          {immersive
            ? "Four builds, each a frame inside a frame. Scroll to fly in — through the story, down to how it works — and then across to the next one."
            : "Four builds, each a frame inside a frame: the overview, the story behind it, and how it works."}
        </p>
      </div>

      {immersive ? (
        <FrameStage onOpen={setOpenProject} />
      ) : (
        <StaticFrames onOpen={setOpenProject} />
      )}

      {openProject && (
        <ProjectCaseFile project={openProject} onClose={closeCaseFile} />
      )}
    </section>
  );
}

export default Projects;
