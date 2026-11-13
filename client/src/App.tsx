import { useRef, useState, type MouseEvent } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import About from "./sections/About";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import MoodSelection, {
  type Mood,
} from "./components/mood/MoodSelection";

import "./App.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const navigationLinks = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Music Room", href: "#music" },
  { label: "Contact", href: "#contact" },
];

// --------------------------------------------------
// FLOATING NAVIGATION
// --------------------------------------------------

function FloatingNavigation() {
  const navRef = useRef<HTMLElement>(null);

  const moveIndicator = (event: MouseEvent<HTMLAnchorElement>) => {
    const navigation = navRef.current;
    if (!navigation) return;

    const linksContainer = navigation.querySelector(".nav-links");
    const indicator = navigation.querySelector(".nav-indicator");

    if (!linksContainer || !indicator) return;

    const link = event.currentTarget;
    const containerRect = linksContainer.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    gsap.to(indicator, {
      x: linkRect.left - containerRect.left - 5,
      width: linkRect.width,
      opacity: 1,
      duration: 0.45,
      ease: "power3.out",
      overwrite: true,
    });
  };

  const hideIndicator = () => {
    const indicator = navRef.current?.querySelector(".nav-indicator");
    if (!indicator) return;

    gsap.to(indicator, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.out",
    });
  };

  return (
    <nav
      ref={navRef}
      className="floating-navigation"
      aria-label="Main navigation"
    >
      <a href="#home" className="nav-logo">
        MT<span>.</span>
      </a>

      <div className="nav-links" onMouseLeave={hideIndicator}>
        <span className="nav-indicator" aria-hidden="true" />

        {navigationLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onMouseEnter={moveIndicator}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="nav-status">
        <span className="status-dot" />
        Available for opportunities
      </div>
    </nav>
  );
}

// --------------------------------------------------
// PORTFOLIO EXPERIENCE
// The component mounts only after mood selection.
// Its animation therefore runs after its DOM exists.
// --------------------------------------------------


function PortfolioExperience() {
  const portfolioRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const timeline = gsap.timeline({
      defaults: {
        ease: "power3.out",
      },
    });

    timeline
      .from(".portfolio-staff-background", {
        autoAlpha: 0,
        duration: 0.9,
      })
      .from(
        ".floating-navigation",
        {
          autoAlpha: 0,
          y: -12,
          duration: 0.55,
        },
        "-=0.65"
      )
      .from(
        ".hero-eyebrow",
        {
          autoAlpha: 0,
          y: 12,
          duration: 0.4,
        },
        "-=0.25"
      )
      .from(
        ".hero-title-line",
        {
          autoAlpha: 0,
          y: 25,
          duration: 0.55,
          stagger: 0.09,
        },
        "-=0.15"
      )
      .from(
        ".hero-description",
        {
          autoAlpha: 0,
          y: 12,
          duration: 0.45,
        },
        "-=0.25"
      )
      .from(
        ".hero-actions > *",
        {
          autoAlpha: 0,
          y: 10,
          duration: 0.4,
          stagger: 0.08,
        },
        "-=0.2"
      )
      .from(
        ".hero-meta",
        {
          autoAlpha: 0,
          y: 8,
          duration: 0.4,
        },
        "-=0.15"
      );
      gsap.to(".portfolio-staff-background", {
  y: 100,
  ease: "none",
  scrollTrigger: {
    trigger: ".portfolio-content",
    start: "top top",
    end: "bottom bottom",
    scrub: 1.2,
    invalidateOnRefresh: true,
  },
});
  }, { scope: portfolioRef });

  return (
    <div ref={portfolioRef} className="portfolio-content">
      <div className="portfolio-staff-background" aria-hidden="true" />
      <FloatingNavigation />

      <section className="hero-section page-container" id="home">
        

        <div className="hero-content">
          <span className="eyebrow hero-eyebrow">
            THE SOUND OF A DEVELOPER
          </span>

          <h1>
            <span className="hero-title-line">
              Life has a rhythm.
            </span>
            <span className="hero-title-line">
              I like creating my own.
            </span>
          </h1>

          <p className="hero-description">
            I'm Mithesh Tharun S — a full stack developer exploring
            the intersection of software, intelligent systems and creativity.
          </p>

          <div className="hero-actions">
            <a href="#projects" className="primary-link">
              Explore my work <span>↗</span>
            </a>
            <a href="#about" className="secondary-link">
              Get to know me
            </a>
          </div>
        </div>

        <div className="hero-meta">
          <span>BETWEEN LOGIC & MELODY</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>

      <About />
    </div>
  );
}


// --------------------------------------------------
// MAIN APP
// --------------------------------------------------

function App() {
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  const moodScreenRef = useRef<HTMLDivElement>(null);
  const isTransitioning = useRef(false);

  const enterExperience = () => {
    if (
      !selectedMood ||
      !moodScreenRef.current ||
      isTransitioning.current
    ) {
      return;
    }

    isTransitioning.current = true;

    gsap.to(moodScreenRef.current, {
      autoAlpha: 0,
      y: -30,
      scale: 0.985,
      duration: 0.8,
      ease: "power3.inOut",
      onComplete: () => {
        setHasEntered(true);
      },
    });
  };

  return (
    <main className="page-shell">
      {!hasEntered ? (
        <div
          ref={moodScreenRef}
          className="mood-transition-layer"
        >
          <MoodSelection
            selectedMood={selectedMood}
            onMoodSelect={setSelectedMood}
            onEnter={enterExperience}
          />
        </div>
      ) : (
        <PortfolioExperience />
      )}
    </main>
  );
}

export default App;
