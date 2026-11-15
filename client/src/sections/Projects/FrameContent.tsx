import type { Project } from "./projectsData";
import ProjectVisual from "./ProjectVisual";

type ContentProps = {
  project: Project;
  onOpen: (project: Project) => void;
};

/** Level 0: what the project is. */
export function OverviewContent({ project }: ContentProps) {
  return (
    <div className="fc fc-overview">
      <div className="fc-copy">
        <span className="fc-eyebrow">PROJECT {project.numeral}</span>
        <h3>{project.title}</h3>
        <span className="fc-sub">{project.subtitle}</span>
        <p>{project.blurb}</p>
        <ul className="fc-chips" aria-label="Technology">
          {project.tech.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="fc-visual">
        <ProjectVisual kind={project.kind} />
      </div>
    </div>
  );
}

/** Level 1: the story and what it can do. */
export function StoryContent({ project }: ContentProps) {
  return (
    <div className="fc fc-story">
      <div className="fc-copy">
        <span className="fc-eyebrow">THE STORY</span>
        {project.story.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="fc-features">
        <span className="fc-eyebrow">WHAT IT DOES</span>
        <ul>
          {project.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Level 2: how it works and what I did. */
export function BuildContent({ project, onOpen }: ContentProps) {
  return (
    <div className="fc fc-build">
      <span className="fc-eyebrow">HOW IT WORKS</span>

      <ol className="fc-flow" aria-label="Architecture">
        {project.flow.map((step, i) => (
          <li key={step}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {step}
          </li>
        ))}
        <i className="fc-pulse" aria-hidden="true" />
      </ol>

      <div className="fc-build-grid">
        <div>
          <span className="fc-eyebrow">MY CONTRIBUTION</span>
          <p>{project.contribution}</p>
        </div>
        <div>
          <span className="fc-eyebrow">BUILT WITH</span>
          <ul className="fc-chips">
            {project.tech.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="fc-actions">
        <button type="button" className="fc-open" onClick={() => onOpen(project)}>
          Open case file <span aria-hidden="true">↗</span>
        </button>
        {project.links.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer noopener">
            {link.label} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
