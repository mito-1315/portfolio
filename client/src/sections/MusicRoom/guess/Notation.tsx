import { staffStep, type PhraseNote } from "./melodies";

type NotationProps = {
  /** Sounding notes only (no rests). */
  notes: PhraseNote[];
  /** The note being played right now, if any. */
  activeIndex: number | null;
  label: string;
};

const WIDTH = 640;
const HEIGHT = 170;
const LEFT = 36;
const RIGHT = 28;
/** Y of the bottom staff line (E4), and the gap between staff steps. */
const BOTTOM = 112;
const STEP = 5;

const yFor = (step: number) => BOTTOM - (step - 30) * STEP;

/** Five lines, with the notes of a melody drawn on them as it plays. */
function Notation({ notes, activeIndex, label }: NotationProps) {
  const count = Math.max(notes.length, 1);
  const spacing = (WIDTH - LEFT - RIGHT - 30) / count;

  return (
    <svg
      className="gs-notation"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      {[0, 1, 2, 3, 4].map((line) => (
        <path
          key={line}
          d={`M${LEFT - 14} ${yFor(30 + line * 2)} H${WIDTH - RIGHT + 6}`}
          strokeWidth="1"
          opacity="0.35"
        />
      ))}

      {notes.map((item, i) => {
        const position = staffStep(item.note);
        if (!position) return null;
        const x = LEFT + 30 + i * spacing + spacing / 2;
        const y = yFor(position.step);
        const stemUp = position.step < 34;
        const open = item.beats >= 2;
        const active = activeIndex === i;

        // Short lines for notes above or below the staff.
        const ledgers: number[] = [];
        for (let s = 28; s >= position.step - (position.step % 2); s -= 2) ledgers.push(s);
        for (let s = 40; s <= position.step; s += 2) ledgers.push(s);

        return (
          <g
            key={`${item.note}-${i}`}
            className={`gs-note ${active ? "active" : ""}`}
            style={{ animationDelay: `${i * 55}ms` }}
          >
            {position.step <= 28 || position.step >= 40
              ? ledgers.map((s) => (
                  <path key={s} d={`M${x - 11} ${yFor(s)} H${x + 11}`} strokeWidth="1" opacity="0.5" />
                ))
              : null}
            {position.accidental && (
              <text
                x={x - 17}
                y={y + 5}
                fontSize="15"
                fill="currentColor"
                stroke="none"
                textAnchor="middle"
              >
                {position.accidental === "#" ? "♯" : "♭"}
              </text>
            )}
            <ellipse
              cx={x}
              cy={y}
              rx="6.4"
              ry="4.7"
              transform={`rotate(-20 ${x} ${y})`}
              fill={open ? "none" : "currentColor"}
              strokeWidth="1.6"
            />
            <path
              d={stemUp ? `M${x + 5.8} ${y - 1} V${y - 32}` : `M${x - 5.8} ${y + 1} V${y + 32}`}
              strokeWidth="1.6"
            />
          </g>
        );
      })}
    </svg>
  );
}

export default Notation;
