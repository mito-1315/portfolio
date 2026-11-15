
import { useCallback, useState } from "react";
import { useSound } from "../../audio/SoundContext";
import SkillWall from "./SkillWall";
import SkillExplorer from "./SkillExplorer";
import { allSkills, skillCategories, type Skill } from "./skillsData";
import "./Skills.css";

function Skills() {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const { play } = useSound();

  const openExplorer = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
  }, []);

  const closeExplorer = useCallback(() => {
    setSelectedSkill(null);
  }, []);

  return (
    <section
      className="skills-section page-container"
      id="skills"
    >
      <div className="skills-intro">
        <span className="section-label">THE TOOLKIT</span>

        <h2>
          The tools
          <br />
          behind the
          <br />
          <span>work.</span>
        </h2>

        <p className="skills-intro-copy">
          A collection of technologies I've explored,
          experimented with and used to bring ideas to life.
        </p>

        <div className="skills-hint">
          <span className="skills-hint-dot" />
          <span>MOVE THROUGH THE TOOLKIT</span>
          <span className="skills-hint-note">♪</span>
        </div>

        <div
          className={`skills-info ${hoveredSkill ? "active" : ""}`}
          aria-live="polite"
        >
          <div className="skills-info-label">
            <span className="skills-info-dot" />
            <span>{hoveredSkill ? hoveredSkill.category : "NOW PLAYING"}</span>
          </div>
          <h3>{hoveredSkill ? hoveredSkill.name : "Hover a technology"}</h3>
          <p>
            {hoveredSkill
              ? hoveredSkill.description
              : "Every pill is a note. Move across the wall to hear the toolkit and see how each tool is used."}
          </p>
        </div>
      </div>

      <div className="skills-wall-container">
        <SkillWall
          skills={allSkills}
          onSelect={openExplorer}
          onHover={(skill) => {
            setHoveredSkill(skill);
            play(skill.note);
          }}
          onHoverEnd={() => setHoveredSkill(null)}
        />
      </div>

      {selectedSkill && (
        <SkillExplorer
          categories={skillCategories}
          selectedSkill={selectedSkill}
          onSelect={setSelectedSkill}
          onClose={closeExplorer}
        />
      )}
    </section>
  );
}

export default Skills;
