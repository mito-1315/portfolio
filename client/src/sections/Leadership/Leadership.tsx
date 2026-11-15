import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "./Leadership.css";

gsap.registerPlugin(ScrollTrigger);

type Part = { title: string; text: string };

/** What the role was about: people and coordination. Wording follows the author's own description. */
const leadership: Part[] = [
  {
    title: "Guidance",
    text: "Guiding and supporting club members in their activities, projects and initiatives.",
  },
  {
    title: "Coordination",
    text: "Working with team members, encouraging collaboration and helping turn ideas into execution.",
  },
  {
    title: "Events",
    text: "Supporting the planning and organisation of GameDev events.",
  },
];

/** Initiatives the leadership supported. Deliberately secondary. */
const initiatives: Part[] = [
  {
    title: "DEVS Bus Route Optimisation",
    text: "Contributed to this club initiative.",
  },
  {
    title: "Recruitment website",
    text: "Guided and coordinated its development.",
  },
];

function Leadership() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".leadership-section .reveal", {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
      });

      // The line linking the parts draws itself, like a phrase being played.
      gsap.from(".leadership-link", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.2,
        ease: "power2.out",
        scrollTrigger: { trigger: ".leadership-parts", start: "top 75%", once: true },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="leadership-section page-container"
      id="leadership"
    >
      <div className="leadership-heading">
        <span className="section-label reveal">THE ENSEMBLE · LEADERSHIP</span>
        <h2 className="reveal">
          Helping the
          <br />
          <span>team play together.</span>
        </h2>
        <p className="leadership-role reveal">
          <strong>Vice President, DEVS Club</strong>
          <span>Rajalakshmi Engineering College · 2025–2026</span>
        </p>
      </div>

      <div className="leadership-parts">
        <span className="leadership-link" aria-hidden="true" />
        {leadership.map((part, i) => (
          <article key={part.title} className="leadership-part reveal">
            <span className="leadership-dot" aria-hidden="true" />
            <span className="leadership-num">0{i + 1}</span>
            <h3>{part.title}</h3>
            <p>{part.text}</p>
          </article>
        ))}
      </div>

      <div className="leadership-initiatives reveal">
        <span className="leadership-subtitle">SUPPORTED THROUGH</span>
        <ul>
          {initiatives.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Leadership;
