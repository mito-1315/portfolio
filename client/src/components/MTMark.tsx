/**
 * The MT monogram as a drawing rather than page text, so it sits exactly in the
 * middle of the round navigation button whatever the font metrics are.
 */
function MTMark() {
  return (
    <svg className="mt-mark" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
      <text
        x="24.5"
        y="26.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-display)"
        fontSize="22"
        letterSpacing="-1"
        fill="currentColor"
      >
        MT
      </text>
      <circle cx="36.5" cy="32" r="2" fill="var(--color-orange-ink)" />
    </svg>
  );
}

export default MTMark;
