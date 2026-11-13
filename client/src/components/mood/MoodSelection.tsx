
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
  onEnter: () => void;
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
  return (
    <section className="mood-screen" aria-labelledby="mood-heading">
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
                onClick={() => onMoodSelect(mood.name)}
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
          onClick={onEnter}
        >
          Enter experience <span aria-hidden="true">↗</span>
        </button>

        <span className="mood-footer">
          THERE IS NO WRONG WAY TO LISTEN.
        </span>
      </div>
    </section>
  );
}

export default MoodSelection;
