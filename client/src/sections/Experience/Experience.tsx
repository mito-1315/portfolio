import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useSound } from "../../audio/SoundContext";
import { chapters, education, professionalSummary, untimedWork } from "./experienceData";
import ExperienceGlyph from "./ExperienceGlyph";
import ResumeButton from "../../components/resume/ResumeButton";
import "./Experience.css";

gsap.registerPlugin(ScrollTrigger);

function Experience() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { play } = useSound();

  // Which chapter is current is read from the live layout on every scroll, so it can never
  // drift out of step the way positions measured once can.
  useEffect(() => {
    let last = -1;
    const update = () => {
      const mark = window.innerHeight * 0.55;
      let index = -1;
      document.querySelectorAll<HTMLElement>("#experience .chapter").forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= mark && rect.bottom > mark) index = i;
      });
      if (index === last) return;
      const forward = index > last;
      last = index;
      setActiveId(index >= 0 ? chapters[index]?.id ?? null : null);
      // Each chapter sounds its note as you arrive at it, not when you scroll back.
      if (index >= 0 && forward) play(chapters[index]!.pitch);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [play]);

  useGSAP(
    () => {
      const line = sectionRef.current?.querySelector<HTMLElement>(".journey");
      if (!line) return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      // The orange melody line draws itself down the page as you scroll.
      if (!reduced) {
        gsap.fromTo(
          ".journey-line-fill",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            transformOrigin: "top center",
            scrollTrigger: {
              trigger: line,
              start: "top 55%",
              end: "bottom 55%",
              scrub: 0.6,
            },
          }
        );
      }

      gsap.utils.toArray<HTMLElement>(".chapter").forEach((chapter) => {
        if (!reduced) {
          gsap.from(chapter.querySelectorAll(".reveal"), {
            opacity: 0,
            y: 24,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.07,
            scrollTrigger: { trigger: chapter, start: "top 80%", once: true },
          });
        }
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="experience-section page-container"
      id="experience"
    >
      <div className="experience-heading">
        <span className="section-label">THE JOURNEY · EXPERIENCE</span>
        <h2>
          Learning
          <br />
          <span>by building.</span>
        </h2>
        <p>
          Each chapter added a new instrument to the ensemble — vision,
          backend, integration — and changed how I hear the rest.
        </p>
      </div>

      {/* A chapter strip you can jump along; it stays in view while you read. */}
      <nav className="chapter-strip" aria-label="Experience chapters">
        {chapters.map((chapter, i) => (
          <a
            key={chapter.id}
            href={`#chapter-${chapter.id}`}
            className={activeId === chapter.id ? "on" : ""}
            aria-current={activeId === chapter.id ? "true" : undefined}
            onClick={() => play(chapter.pitch)}
          >
            <span className="chapter-strip-numeral">{chapter.numeral}</span>
            <span className="chapter-strip-name">{chapter.company}</span>
            {i < chapters.length - 1 && (
              <span className="chapter-strip-link" aria-hidden="true" />
            )}
          </a>
        ))}
      </nav>

      <div className="journey">
        <div className="journey-line" aria-hidden="true">
          <span className="journey-line-fill" />
        </div>

        {chapters.map((chapter) => (
          <article
            key={chapter.id}
            id={`chapter-${chapter.id}`}
            className={`chapter ${chapter.milestone ? "milestone" : ""} ${
              activeId === chapter.id ? "active" : ""
            }`}
          >
            <button
              type="button"
              className="chapter-note"
              aria-label={`Chapter ${chapter.numeral}: ${chapter.company}. Play its note`}
              onClick={() => play(chapter.pitch)}
            />

            <div className="chapter-copy">
              <span className="chapter-numeral reveal">
                CHAPTER {chapter.numeral}
                {chapter.milestone && " · MILESTONE"}
              </span>
              <h3 className="reveal">{chapter.company}</h3>
              <span className="chapter-role reveal">{chapter.role}</span>
              {(chapter.location || chapter.period) && (
                <span className="chapter-meta reveal">
                  {chapter.period && <span>{chapter.period}</span>}
                  {chapter.location && <span>{chapter.location}</span>}
                </span>
              )}
              <p className="chapter-summary reveal">{chapter.summary}</p>

              {chapter.contributions.length > 0 && (
                <ul
                  className={`chapter-contributions reveal ${
                    chapter.contributions.some((c) => c.title) ? "named" : ""
                  }`}
                >
                  {chapter.contributions.map((c) => (
                    <li key={c.text}>
                      {c.title && <h4>{c.title}</h4>}
                      <p>{c.text}</p>
                    </li>
                  ))}
                </ul>
              )}

              {chapter.focus.length > 0 && (
                <ul className="chapter-areas reveal" aria-label="Focus areas">
                  {chapter.focus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="chapter-glyph reveal">
              <ExperienceGlyph kind={chapter.kind} />
            </div>
          </article>
        ))}
      </div>

      <div className="untimed">
        <span className="section-label">ALSO · OFF THE TIMELINE</span>
        <div className="untimed-body">
          <h3>{untimedWork.title}</h3>
          <p>
            {untimedWork.company} — {untimedWork.summary}
          </p>
          <div className="untimed-lists">
            <div>
              <span>DETECTS</span>
              <ul>
                {untimedWork.detects.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>WIDER PLATFORM</span>
              <ul>
                {untimedWork.platform.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="education">
        <span className="section-label">FOUNDATIONS · EDUCATION</span>
        <div className="education-body">
          <h3>{education.degree}</h3>
          <p>{education.school}</p>
          <span>{education.detail}</span>
          <ul>
            {education.earlier.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="coda">
        <span className="section-label">CODA · IN SUMMARY</span>
        <div className="coda-body">
          {professionalSummary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <ResumeButton variant="ghost" />
        </div>
      </div>
    </section>
  );
}

export default Experience;
