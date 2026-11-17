import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Skill, SkillCategory } from "./skillsData";

type SkillExplorerProps = {
  categories: SkillCategory[];
  selectedSkill: Skill;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
};

function SkillExplorer({
  categories,
  selectedSkill,
  onSelect,
  onClose,
}: SkillExplorerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  // Categories alternate between columns, so new ones balance automatically.
  const columns = [
    categories.filter((_, i) => i % 2 === 0),
    categories.filter((_, i) => i % 2 !== 0),
  ];

  return createPortal(
    <div
      className="skill-explorer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="skill-explorer"
        role="dialog"
        aria-modal="true"
        aria-label="Technology explorer"
      >
        <header className="explorer-header">
          <span className="explorer-brand">
            MT<span>.</span> / TOOLKIT
          </span>

          <button
            ref={closeRef}
            type="button"
            className="explorer-close"
            onClick={onClose}
            aria-label="Close technology explorer"
          >
            <span>ESC</span>
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="explorer-columns">
          {columns.map((items, columnIndex) => (
            <div
              key={columnIndex}
              className={`explorer-column ${
                columnIndex === 0 ? "align-end" : "align-start"
              }`}
            >
              {items.map((category) => (
                <section className="explorer-category" key={category.name}>
                  <h3>{category.name}</h3>
                  <div className="explorer-skill-list">
                    {category.skills.map((skill) => {
                      const isSelected = selectedSkill.name === skill.name;
                      return (
                        <button
                          key={skill.name}
                          type="button"
                          className={`explorer-skill ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => onSelect(skill)}
                          aria-pressed={isSelected}
                        >
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ))}
        </div>

        <footer className="explorer-description" aria-live="polite">
          <span className="explorer-category-label">
            <span className="explorer-active-dot" />
            {selectedSkill.category}
          </span>
          <h2>{selectedSkill.name}</h2>
          <p>{selectedSkill.description}</p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export default SkillExplorer;
