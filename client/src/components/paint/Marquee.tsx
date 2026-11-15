import "./Paint.css";

type MarqueeProps = {
  /** Words that scroll past. */
  words: string[];
  /** Seconds for one full loop; lower is faster. */
  speed?: number;
  /** Run right to left (default) or left to right. */
  reverse?: boolean;
  /** Draw the letters as outlines instead of solid. */
  outline?: boolean;
};

/**
 * A band of large type that scrolls sideways forever, like a ticker. The word
 * list is shown twice so the loop has no gap. Decorative, so it is hidden from
 * assistive technology.
 */
function Marquee({ words, speed = 40, reverse = false, outline = false }: MarqueeProps) {
  const run = (
    <span className="marquee-run">
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          {word}
          <i className="marquee-star">✦</i>
        </span>
      ))}
    </span>
  );

  return (
    <div className={`marquee ${outline ? "outline" : ""}`} aria-hidden="true">
      <div
        className="marquee-track"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {run}
        {run}
      </div>
    </div>
  );
}

export default Marquee;
