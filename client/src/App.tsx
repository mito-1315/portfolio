
import { useState } from "react";
import MoodSelection, { type Mood } from "./components/mood/MoodSelection";
import "./App.css";

function App() {
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  return (
    <main
      className="page-shell"
      data-mood={selectedMood ?? undefined}
    >
      <div className="staff-background" aria-hidden="true" />

      {!hasEntered && (
        <MoodSelection
          selectedMood={selectedMood}
          onMoodSelect={setSelectedMood}
          onEnter={() => setHasEntered(true)}
        />
      )}

      {hasEntered && (
        <>
          <nav className="navigation page-container">
            <a href="#home" className="nav-logo">
              MT<span>.</span>
            </a>

            <div className="nav-links">
              <a href="#about">About</a>
              <a href="#projects">Projects</a>
              <a href="#music">Music Room</a>
              <a href="#contact">Contact</a>
            </div>

            <span className="nav-status">
              <span className="status-dot" />
              Available for opportunities
            </span>
          </nav>

          <section className="hero-section page-container" id="home">
            <div className="hero-content">
              <span className="eyebrow">
                THE SOUND OF A DEVELOPER
              </span>

              <h1>
                Life has a rhythm.
                <br />
                <span>I like creating my own.</span>
              </h1>

              <p className="hero-description">
                I'm Mithesh Tharun S — a full stack developer
                exploring the intersection of software,
                intelligent systems and creativity.
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
        </>
      )}
    </main>
  );
}

export default App;
