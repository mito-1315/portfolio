import "./MiniKeyboard.css";

const BLACK = new Set([1, 3, 6, 8, 10]);

/**
 * A small piano keyboard that lights the keys being played. It only displays:
 * the melody is played by the quiz's own piano, not through this.
 */
function MiniKeyboard({ low, high, active }: { low: number; high: number; active: ReadonlySet<number> }) {
  const whites: number[] = [];
  const blacks: { midi: number; after: number }[] = [];
  for (let midi = low; midi <= high; midi++) {
    if (BLACK.has(midi % 12)) blacks.push({ midi, after: whites.length });
    else whites.push(midi);
  }
  const width = 100 / whites.length;

  return (
    <div className="mk" role="img" aria-label="Piano keys, lit as the melody plays">
      {whites.map((midi) => (
        <span key={midi} className={`mk-white ${active.has(midi) ? "on" : ""} ${midi % 12 === 0 ? "c" : ""}`} style={{ width: `${width}%` }} />
      ))}
      {blacks.map(({ midi, after }) => (
        <span key={midi} className={`mk-black ${active.has(midi) ? "on" : ""}`} style={{ left: `${after * width}%`, width: `${width * 0.62}%` }} />
      ))}
    </div>
  );
}

export default MiniKeyboard;
