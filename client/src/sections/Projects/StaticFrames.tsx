import { projects, type Project } from "./projectsData";
import { BuildContent, OverviewContent, StoryContent } from "./FrameContent";

/**
 * The same frames-within-frames idea without the camera: for phones, tablets
 * and visitors who prefer reduced motion. Each project is simply three
 * nested frames, all readable at once.
 */
function StaticFrames({ onOpen }: { onOpen: (project: Project) => void }) {
  return (
    <div className="static-frames">
      {projects.map((project) => (
        <article key={project.id} className="static-frame">
          <OverviewContent project={project} onOpen={onOpen} />
          <div className="static-frame">
            <StoryContent project={project} onOpen={onOpen} />
            <div className="static-frame">
              <BuildContent project={project} onOpen={onOpen} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default StaticFrames;
