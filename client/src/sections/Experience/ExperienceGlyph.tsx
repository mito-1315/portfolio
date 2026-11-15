import type { ExperienceKind } from "./experienceData";

/** One small line glyph per chapter, so each role has its own identity. */
function ExperienceGlyph({ kind }: { kind: ExperienceKind }) {
  return (
    <svg
      className={`exp-glyph glyph-${kind}`}
      viewBox="0 0 200 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "vision" && (
        <>
          <path d="M20 40 V22 H38 M180 40 V22 H162 M20 80 V98 H38 M180 80 V98 H162" />
          <path d="M60 60 C76 38 124 38 140 60 C124 82 76 82 60 60Z" />
          <circle cx="100" cy="60" r="11" />
          <circle className="accent-fill pulse" cx="100" cy="60" r="4" />
          <rect className="accent box" x="72" y="34" width="56" height="52" rx="4" />
        </>
      )}
      {kind === "data" && (
        <>
          <ellipse cx="100" cy="30" rx="44" ry="12" />
          <path d="M56 30 V60 C56 67 76 72 100 72 S144 67 144 60 V30" />
          <path d="M56 60 V88 C56 95 76 100 100 100 S144 95 144 88 V60" />
          <path className="accent flow" d="M156 40 h26 M156 66 h26 M156 92 h26" />
        </>
      )}
      {kind === "cloud" && (
        <>
          <path d="M60 86 C40 86 34 62 54 58 C54 38 84 30 94 50 C108 38 134 48 130 68 C150 66 156 90 138 90 H70" />
          <circle className="accent-fill pulse" cx="100" cy="68" r="5" />
          <path className="accent flow" d="M100 68 L74 96 M100 68 L128 98" />
        </>
      )}
      {kind === "held" && (
        <>
          <path d="M20 40 H180 M20 52 H180 M20 64 H180 M20 76 H180 M20 88 H180" className="staff-lines" />
          <ellipse className="accent-fill" cx="100" cy="76" rx="13" ry="10" transform="rotate(-18 100 76)" />
          <path className="accent" d="M111 72 V28" />
          <path d="M80 20 C90 4 110 4 120 20" className="pulse" />
          <circle cx="100" cy="14" r="2" className="accent-fill" />
        </>
      )}
    </svg>
  );
}

export default ExperienceGlyph;
