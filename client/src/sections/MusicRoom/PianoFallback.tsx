/**
 * A line drawing of a grand piano (side view, lid propped open). Shown when
 * WebGL is unavailable, when the visitor prefers reduced motion, or while the
 * particle piano is still loading.
 */
function PianoFallback() {
  return (
    <svg
      className="piano-fallback"
      viewBox="0 0 640 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="A grand piano with its lid open"
    >
      <ellipse cx="330" cy="362" rx="250" ry="14" opacity="0.18" />

      {/* Case: long body with the rounded tail on the right */}
      <path d="M150 232 H500 C548 232 560 262 520 266 H150 Z" />
      <path d="M150 232 V266" />

      {/* Lid, hinged along the near edge and propped open */}
      <path d="M156 228 L470 118 L538 150 L504 230 Z" opacity="0.9" />
      <path className="accent" d="M326 230 L360 150" />

      {/* Music stand with sheet-music lines */}
      <path d="M170 224 L178 172 L238 168 L236 222" />
      <path className="accent" d="M184 184 H232 M184 192 H232 M184 200 H232 M184 208 H232" />

      {/* Keyboard */}
      <path d="M96 238 H168 V258 H96 Z" />
      <path d="M96 238 L96 262 M108 238 V258 M120 238 V258 M132 238 V258 M144 238 V258 M156 238 V258" opacity="0.7" />
      <path className="accent" d="M112 238 V248 M126 238 V248 M150 238 V248" strokeWidth="3.2" />

      {/* Legs and pedal lyre */}
      <path d="M170 266 V352 M470 266 V352 M508 266 L520 352" />
      <path d="M122 262 V340 M146 262 V340 M110 340 H158" opacity="0.8" />
      <circle cx="170" cy="356" r="4" />
      <circle cx="470" cy="356" r="4" />
      <circle cx="520" cy="356" r="4" />

      {/* A few notes drifting off the staff */}
      <g className="accent" strokeWidth="1.4">
        <path d="M70 90 H250 M70 100 H250 M70 110 H250 M70 120 H250 M70 130 H250" opacity="0.35" />
        <ellipse cx="116" cy="118" rx="6" ry="4.4" fill="currentColor" />
        <path d="M122 117 V86" />
        <ellipse cx="180" cy="104" rx="6" ry="4.4" fill="currentColor" />
        <path d="M186 103 V72" />
      </g>
    </svg>
  );
}

export default PianoFallback;
