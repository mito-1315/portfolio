import { useCallback, useState } from "react";
import AimMode from "./eggs/AimMode";
import Football from "./eggs/Football";
import GuitarPick from "./eggs/GuitarPick";
import Notebook from "./eggs/Notebook";
import PosterPeek from "./eggs/PosterPeek";
import Reel from "./Reel";
import { useCurrentSection } from "./useCurrentSection";
import "./Discoveries.css";

const SECTIONS = ["home", "about", "skills", "projects", "experience", "leadership", "music", "recommend", "contact"];

/**
 * Small personal objects scattered through the page, never more than one at a
 * time and each tucked near an edge. They are discoveries, not content: none
 * of them is needed to use the site.
 */
function Discoveries() {
  const current = useCurrentSection(SECTIONS);
  const [reelOpen, setReelOpen] = useState(false);
  const closeReel = useCallback(() => setReelOpen(false), []);

  return (
    <div className="discoveries">
      <AimMode visible={current === "about"} />
      <PosterPeek visible={current === "skills"} onOpen={() => setReelOpen(true)} />
      <GuitarPick visible={current === "experience"} />
      <Football visible={current === "leadership"} />
      <Notebook visible={current === "recommend" || current === "contact"} />
      {reelOpen && <Reel onClose={closeReel} />}
    </div>
  );
}

export default Discoveries;
