const WAVE =
  "M0 100 C240 20 480 20 720 100 S1200 180 1440 100 S1920 20 2160 100 S2640 180 2880 100";

const NOTES = [
  { g: "♪", x: "8%", y: "18%", s: 34, d: 9 },
  { g: "♫", x: "88%", y: "14%", s: 42, d: 11 },
  { g: "♩", x: "15%", y: "62%", s: 28, d: 8 },
  { g: "♬", x: "91%", y: "58%", s: 36, d: 12 },
  { g: "♪", x: "78%", y: "80%", s: 26, d: 10 },
  { g: "♩", x: "4%", y: "86%", s: 30, d: 13 },
];

/** Quiet musical backdrop: drifting notes and slow ribbons of sound. */
function MoodDecor() {
  return (
    <div className="mood-decor" aria-hidden="true">
      {NOTES.map((n, i) => (
        <span
          key={i}
          className="mood-note"
          style={{ left: n.x, top: n.y, fontSize: n.s, animationDuration: `${n.d}s`, animationDelay: `${-i * 1.7}s` }}
        >
          {n.g}
        </span>
      ))}
      {[0, 1, 2].map((i) => (
        <svg key={i} className={`mood-wave mood-wave-${i}`} viewBox="0 0 1440 200" preserveAspectRatio="none">
          <path d={WAVE} />
        </svg>
      ))}
    </div>
  );
}

export default MoodDecor;
