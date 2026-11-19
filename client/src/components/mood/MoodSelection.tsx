
import { useSound } from "../../audio/SoundContext";
import { tonicFor } from "../../audio/musicTheory";
import MoodDecor from "./MoodDecor";
import "./MoodSelection.css";

export type Mood =
  | "Calm"
  | "Focused"
  | "Energetic"
  | "Nostalgic"
  | "Curious";

interface MoodSelectionProps {
  selectedMood: Mood | null;
  onMoodSelect: (mood: Mood) => void;
  onEnter: (origin: { x: number; y: number }) => void;
}

const moods: {
  name: Mood;
  description: string;
  symbol: string;
}[] = [
  {
    name: "Calm",
    description: "Slow down. Take it all in.",
    symbol: "◌",
  },
  {
    name: "Focused",
    description: "Find your rhythm.",
    symbol: "⌁",
  },
  {
    name: "Energetic",
    description: "Turn the volume up.",
    symbol: "↗",
  },
  {
    name: "Nostalgic",
    description: "Somewhere in another time.",
    symbol: "∞",
  },
  {
    name: "Curious",
    description: "Follow the unexpected.",
    symbol: "✳",
  },
];

function MoodSelection({
  selectedMood,
  onMoodSelect,
  onEnter,
}: MoodSelectionProps) {
  const { enabled, toggle, preload, setMood, playExact } = useSound();

  const choose = (mood: Mood) => {
    onMoodSelect(mood);
    // Silent unless the visitor has opted in to sound.
    setMood(mood);
    playExact(tonicFor(mood), 0.55);
  };

  return (
    <section className="mood-screen" aria-labelledby="mood-heading">
      <MoodDecor />
      <div className="mood-content">
        <span className="mood-eyebrow">
          AN EXPERIMENT IN SOUND & SOFTWARE
        </span>

        <h1 id="mood-heading">
          Before we begin,
          <br />
          <span>find your rhythm.</span>
        </h1>

        <p className="mood-intro">
          Every experience has a different feeling.
          <br />
          Choose the mood you'd like to explore with.
        </p>

        <div className="mood-options" aria-label="Choose your mood">
          {moods.map((mood) => {
            const isSelected = selectedMood === mood.name;

            return (
              <button
                key={mood.name}
                type="button"
                className={`mood-option ${
                  isSelected ? "selected" : ""
                }`}
                aria-pressed={isSelected}
                onClick={() => choose(mood.name)}
              >
                <span className="mood-symbol" aria-hidden="true">
                  {mood.symbol}
                </span>

                <span className="mood-name">{mood.name}</span>

                <span className="mood-description">
                  {mood.description}
                </span>

                <span className="mood-check" aria-hidden="true">
                  {isSelected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="mood-enter"
          disabled={!selectedMood}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onEnter({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
        >
          Enter experience <span aria-hidden="true">↗</span>
        </button>

        <button
          type="button"
          className={`mood-sound ${enabled ? "on" : ""}`}
          aria-pressed={enabled}
          onClick={toggle}
          onPointerEnter={preload}
          onFocus={preload}
        >
          <span className="mood-sound-icon" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="mood-sound-text">
            <strong>{enabled ? "Piano sound on" : "Play with piano sound"}</strong>
            <small>{enabled ? "Tap to mute" : "Best with headphones"}</small>
          </span>
        </button>

        <span className="mood-footer">
          THERE IS NO WRONG WAY TO LISTEN.
        </span>
      </div>
    </section>
  );
}

export default MoodSelection;
