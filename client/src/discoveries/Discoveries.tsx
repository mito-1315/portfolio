import AimMode from "./eggs/AimMode";
import Football from "./eggs/Football";
import GuitarPick from "./eggs/GuitarPick";
import Notebook from "./eggs/Notebook";
import HintsWindow from "./HintsWindow";
import MovieEggs from "./MovieEggs";
import SecretPosters from "./SecretPosters";
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

  return (
    <div className="discoveries">
      <AimMode visible={current === "about"} />
      <GuitarPick visible={current === "experience"} />
      <Football visible={current === "leadership"} />
      <Notebook visible={current === "recommend" || current === "contact"} />
      <MovieEggs />
      <SecretPosters />
      <HintsWindow />
    </div>
  );
}

export default Discoveries;
