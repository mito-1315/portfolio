import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import About from "./sections/About";
import Skills from "./sections/Skills/Skills";
import Projects from "./sections/Projects/Projects";
import Experience from "./sections/Experience/Experience";
import Leadership from "./sections/Leadership/Leadership";
import Discoveries from "./discoveries/Discoveries";
import MusicRoom from "./sections/MusicRoom/MusicRoom";
import Recommendations from "./sections/Recommendations/Recommendations";
import Contact from "./sections/Contact/Contact";
import ResumeButton from "./components/resume/ResumeButton";
import { SoundProvider, useSound } from "./audio/SoundContext";
import StaffField from "./components/staff/StaffField";
import PaintSplash from "./components/paint/PaintSplash";
import Decor from "./components/paint/Decor";
import HeroArt from "./components/paint/HeroArt";
import Marquee from "./components/paint/Marquee";
import {
  ABOUT_DECOR,
  CONTACT_DECOR,
  EXPERIENCE_DECOR,
  MUSIC_DECOR,
  SKILLS_DECOR,
} from "./components/paint/decorSets";
import ThemeSwitcher from "./components/theme/ThemeSwitcher";
import MovementIndicator from "./components/movement/MovementIndicator";
import { useSmoothScroll } from "./scroll/useSmoothScroll";
import MoodSelection, { type Mood } from "./components/mood/MoodSelection";

import "./App.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const navigationLinks = [
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Music Room", href: "#music" },
  { label: "Contact", href: "#contact" },
];

function FloatingNavigation() {
  const { enabled, toggle, preload } = useSound();
  const navRef = useRef<HTMLElement>(null);

  const moveIndicator = (event: MouseEvent<HTMLAnchorElement>) => {
    const navigation = navRef.current;
    if (!navigation) return;

    const linksContainer = navigation.querySelector(".nav-links");
    const indicator = navigation.querySelector(".nav-indicator");
    if (!linksContainer || !indicator) return;

    const containerRect = linksContainer.getBoundingClientRect();
    const linkRect = event.currentTarget.getBoundingClientRect();

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
      overwrite: true,
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

      <div className="nav-right">
        <div className="nav-status">
          <span className="status-dot" />
          Available for opportunities
        </div>

        <button
          type="button"
          className={`sound-toggle ${enabled ? "on" : ""}`}
          onClick={toggle}
          onPointerEnter={preload}
          onFocus={preload}
          aria-pressed={enabled}
          aria-label={enabled ? "Mute sound" : "Turn sound on"}
        >
          <span className="sound-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{enabled ? "SOUND ON" : "SOUND OFF"}</span>
        </button>

        <ThemeSwitcher />
      </div>
    </nav>
  );
}

function PortfolioExperience() {
  const portfolioRef = useRef<HTMLDivElement>(null);

  useSmoothScroll();

  // The big numerals drift upward slower than the page, for depth.
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.utils.toArray<HTMLElement>(".score-part").forEach((el) => {
        gsap.fromTo(
          el,
          { "--mark-y": "0px" },
          {
            "--mark-y": "-180px",
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
    },
    { scope: portfolioRef }
  );

  useGSAP(
    () => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      timeline
        .from(".floating-navigation", {
          autoAlpha: 0,
          y: -12,
          duration: 0.55,
        })
        .from(
          ".hero-eyebrow",
          { autoAlpha: 0, y: 12, duration: 0.4 },
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
          { autoAlpha: 0, y: 12, duration: 0.45 },
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
          { autoAlpha: 0, y: 8, duration: 0.4 },
          "-=0.15"
        );


      // A reversible scroll-linked fade: scrolling back toward the hero
      // restores the staff lines instead of leaving them permanently hidden.
      gsap.fromTo(
        ".staff-field",
        { opacity: 1 },
        {
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: "#skills",
            start: "top 100%",
            end: "top 35%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );

      // Recalculate positions after the page has mounted and laid out.
      const refreshFrame = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      return () => cancelAnimationFrame(refreshFrame);
    },
    { scope: portfolioRef }
  );

  return (
    <div ref={portfolioRef} className="portfolio-content">
      <a className="skip-link" href="#about">
        Skip to content
      </a>
      <StaffField />
      <FloatingNavigation />
      <MovementIndicator />
      <Discoveries />

      <section className="hero-section page-container" id="home">
        <HeroArt />
        <div className="hero-content">
          <span className="eyebrow hero-eyebrow">
            THE SOUND OF A DEVELOPER
          </span>

          <h1>
            <span className="hero-title-line">Life has a rhythm.</span>
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
            <ResumeButton variant="ghost" />
          </div>
        </div>

        <div className="hero-meta">
          <span>BETWEEN LOGIC & MELODY</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>

      <div className="score-part">
        <Decor items={ABOUT_DECOR} />
        <About />
      </div>
      <div className="score-part scene-1" data-numeral="II">
        <PaintSplash variant={0} />
        <Decor items={SKILLS_DECOR} />
        <Skills />
        <Marquee words={["Code", "Melody", "Logic", "Rhythm", "Systems"]} outline speed={50} />
      </div>
      <div className="score-part" data-numeral="III">
        <Projects />
      </div>
      <div className="score-part scene-2" data-numeral="IV">
        <PaintSplash variant={1} />
        <Decor items={EXPERIENCE_DECOR} />
        <Experience />
        <Marquee words={["Learning", "By", "Building"]} reverse speed={44} />
        <Leadership />
      </div>
      <div className="score-part scene-3" data-numeral="V">
        <PaintSplash variant={0} flip />
        <Decor items={MUSIC_DECOR} />
        <MusicRoom />
        <Recommendations />
      </div>
      <div className="score-part scene-4" data-numeral="VI">
        <PaintSplash variant={1} flip />
        <Decor items={CONTACT_DECOR} />
        <Contact />
      </div>
    </div>
  );
}

/** Tells the sound engine which key the visitor chose on the entry screen. */
function MoodKey({ mood }: { mood: Mood | null }) {
  const { setMood } = useSound();
  useEffect(() => {
    if (mood) setMood(mood);
  }, [mood, setMood]);
  return null;
}

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
      onComplete: () => setHasEntered(true),
    });
  };

  return (
    <SoundProvider>
    <MoodKey mood={selectedMood} />
    <main className="page-shell">
      {!hasEntered ? (
        <div ref={moodScreenRef} className="mood-transition-layer">
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
    </SoundProvider>
  );
}

export default App;
