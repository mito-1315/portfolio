import type { ProjectKind } from "./projectsData";

/**
 * Small line illustrations, one per project. Drawn in SVG so they stay
 * crisp, cost nothing to load and animate with CSS only.
 */
function ProjectVisual({ kind }: { kind: ProjectKind }) {
  return (
    <svg
      className={`project-visual visual-${kind}`}
      viewBox="0 0 320 220"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "farm" && (
        <>
          <circle className="accent-fill pulse" cx="248" cy="52" r="16" />
          <path d="M0 160 C50 120 100 120 150 150 S250 170 320 130" />
          <path d="M0 190 C60 160 120 170 180 180 S280 190 320 170" />
          <path className="sway" d="M120 150 V104" />
          <path className="accent sway" d="M120 118 C100 116 92 104 96 94 C110 96 120 104 120 118Z" />
          <path className="accent sway" d="M120 108 C138 106 146 94 142 84 C128 86 120 94 120 108Z" />
          <path className="dash" d="M204 150 V176 M196 176 h16" />
          <circle cx="204" cy="144" r="5" />
          <path className="rain" d="M60 60 l-4 10 M80 48 l-4 10 M100 62 l-4 10" />
        </>
      )}
      {kind === "attendance" && (
        <>
          <path d="M70 60 V36 H94 M250 60 V36 H226 M70 160 V184 H94 M250 160 V184 H226" />
          <circle cx="160" cy="92" r="26" />
          <path d="M108 168 C112 132 208 132 212 168" />
          <path className="scan accent" d="M80 110 H240" />
          <circle className="accent-fill" cx="148" cy="88" r="2" />
          <circle className="accent-fill" cx="172" cy="88" r="2" />
        </>
      )}
      {kind === "learning" && (
        <>
          <rect x="40" y="40" width="240" height="140" rx="12" />
          <path d="M40 66 H280" />
          <circle cx="58" cy="53" r="3" />
          <circle cx="72" cy="53" r="3" />
          <path className="accent" d="M92 106 l-20 16 20 16 M228 106 l20 16 -20 16" />
          <path className="slash" d="M170 100 l-20 44" />
          <path d="M70 164 h60" />
          <path className="accent grow" d="M70 164 h36" />
          <path className="accent star" d="M246 62 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" />
        </>
      )}
      {kind === "parking" && (
        <>
          <path d="M60 36 q100 -34 200 0" />
          <circle cx="160" cy="26" r="5" className="accent-fill pulse" />
          <path d="M40 80 H280 M40 190 H280" />
          <path d="M40 80 V190 M100 80 V190 M160 80 V190 M220 80 V190 M280 80 V190" />
          <rect x="52" y="118" width="36" height="54" rx="6" />
          <rect x="232" y="94" width="36" height="54" rx="6" />
          <rect x="112" y="94" width="36" height="54" rx="6" className="accent slot" />
          <path d="M172 150 h36" className="dash" />
        </>
      )}
    </svg>
  );
}

export default ProjectVisual;
