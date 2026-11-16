import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Play } from "lucide-react";
import { midiToNote, scaleFor } from "../../audio/musicTheory";
import { useSound } from "../../audio/SoundContext";
import { staffStep } from "../../audio/musicTheory";

gsap.registerPlugin(ScrollTrigger);

const WIDTH = 1000;
const HEIGHT = 190;
/** Y of the bottom staff line, and the distance between staff steps. */
const BOTTOM = 118;
const STEP = 6;
const RUN_GAP_MS = 330;
const CHORD_HOLD_MS = 2800;

const yFor = (step: number) => BOTTOM - (step - 30) * STEP;

/**
 * The closing phrase, built from the key the visitor chose at the start: a
 * run up the scale, then a chord to rest on.
 */
function buildPhrase(mood: Parameters<typeof scaleFor>[0]) {
  const pitchClasses = scaleFor(mood).pitchClasses;
  const rootPc = pitchClasses[0] ?? 0;
  let root = 60 + rootPc;
  if (root > 70) root -= 12;

  const offsets = pitchClasses.map((pc) => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
  const run = [...offsets, 12].map((offset) => midiToNote(root + offset));
  const chord = [0, offsets[2] ?? 5, offsets[4] ?? 10, 12].map((offset) => midiToNote(root + offset));
  return { run, chord };
}

type Head = { id: string; note: string; x: number; filled: boolean };

function Finale() {
  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const held = useRef(new Set<string>());
  const autoplayed = useRef(false);

  const { enabled, ready, mood, toggle, playExact, noteOn, noteOff } = useSound();
  const [lit, setLit] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [reached, setReached] = useState(false);

  const phrase = useMemo(() => buildPhrase(mood), [mood]);

  const heads = useMemo<Head[]>(() => {
    const run = phrase.run.map((note, i): Head => ({
      id: `r${i}`,
      note,
      x: 150 + i * 112,
      filled: true,
    }));
    const chord = phrase.chord.map((note, i): Head => ({ id: `c${i}`, note, x: 860, filled: false }));
    return [...run, ...chord];
  }, [phrase]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    held.current.forEach((note) => noteOff(note));
    held.current.clear();
  };

  /** On a narrow screen the staff is wider than the window; scroll it to keep the note in view. */
  const follow = (x: number) => {
    const stage = stageRef.current;
    if (!stage || stage.scrollWidth <= stage.clientWidth) return;
    const target = (x / WIDTH) * stage.scrollWidth - stage.clientWidth / 2;
    stage.scrollTo({ left: target, behavior: "smooth" });
  };

  const playPhrase = () => {
    if (!enabled || !ready) return;
    clear();
    setLit([]);
    setPlaying(true);

    phrase.run.forEach((note, i) => {
      timers.current.push(
        window.setTimeout(() => {
          playExact(note, 0.5);
          setLit((current) => [...current, `r${i}`]);
          follow(150 + i * 112);
        }, i * RUN_GAP_MS)
      );
    });

    const chordAt = phrase.run.length * RUN_GAP_MS + 140;
    phrase.chord.forEach((note, i) => {
      timers.current.push(
        window.setTimeout(() => {
          if (noteOn(note, 0.46)) held.current.add(note);
          setLit((current) => [...current, `c${i}`]);
          follow(860);
        }, chordAt)
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        held.current.forEach((note) => noteOff(note));
        held.current.clear();
        setPlaying(false);
      }, chordAt + CHORD_HOLD_MS)
    );
  };

  /* ---------- Drawing in ---------- */

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const stage = rootRef.current?.querySelector<HTMLElement>(".finale-stage");
      if (!stage) return;

      if (!reduced) {
        // The five lines start at both edges and meet in the middle.
        gsap.from(".finale-line", {
          strokeDashoffset: 1,
          ease: "none",
          stagger: 0.04,
          scrollTrigger: { trigger: stage, start: "top 88%", end: "top 38%", scrub: 0.6 },
        });
        gsap.from(".finale-bar rect", {
          scaleY: 0,
          transformOrigin: "50% 0%",
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: stage, start: "top 45%", once: true },
        });
        gsap.from(".finale-thanks > *", {
          opacity: 0,
          y: 22,
          duration: 1,
          ease: "power3.out",
          stagger: 0.22,
          scrollTrigger: { trigger: ".finale-thanks", start: "top 85%", once: true },
        });
      }
    },
    { scope: rootRef }
  );

  /* ---------- The ending plays itself once, if sound is on ---------- */

  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setReached(true);
      },
      { threshold: 0.9 }
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!reached || !enabled || !ready || autoplayed.current) return;
    autoplayed.current = true;
    const id = window.setTimeout(playPhrase, 400);
    return () => window.clearTimeout(id);
    // playPhrase is rebuilt on every render; only these conditions should restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached, enabled, ready]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      held.current.forEach((note) => noteOff(note));
    },
    [noteOff]
  );

  /* ---------- Render ---------- */

  const staffLines = [0, 1, 2, 3, 4].map((line) => yFor(30 + line * 2));

  return (
    <div ref={rootRef} className="finale">
      <div ref={stageRef} className="finale-stage">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="A final line of music: a rising run, then a resting chord, ending on a double bar line."
          fill="none"
          stroke="currentColor"
        >
          {staffLines.map((y) => (
            <g key={y}>
              <path className="finale-line" d={`M30 ${y} H500`} pathLength="1" strokeWidth="1.2" />
              <path className="finale-line" d={`M970 ${y} H500`} pathLength="1" strokeWidth="1.2" />
            </g>
          ))}

          {heads.map((head) => {
            const position = staffStep(head.note);
            if (!position) return null;
            const y = yFor(position.step);
            const isLit = lit.includes(head.id);
            const stemUp = position.step < 34;

            const ledgers: number[] = [];
            for (let s = 28; s >= position.step - (position.step % 2); s -= 2) ledgers.push(s);
            for (let s = 40; s <= position.step; s += 2) ledgers.push(s);

            return (
              <g key={head.id} className={`finale-note ${isLit ? "lit" : ""}`}>
                {(position.step <= 28 || position.step >= 40) &&
                  ledgers.map((s) => (
                    <path key={s} d={`M${head.x - 14} ${yFor(s)} H${head.x + 14}`} strokeWidth="1.2" opacity="0.6" />
                  ))}
                {position.accidental && (
                  <text x={head.x - 20} y={y + 5} fontSize="16" fill="currentColor" stroke="none" textAnchor="middle">
                    {position.accidental === "#" ? "♯" : "♭"}
                  </text>
                )}
                <ellipse
                  cx={head.x}
                  cy={y}
                  rx="8"
                  ry="5.8"
                  transform={`rotate(-20 ${head.x} ${y})`}
                  fill={head.filled ? "currentColor" : "none"}
                  strokeWidth="1.8"
                />
                {head.filled && (
                  <path
                    d={stemUp ? `M${head.x + 7.4} ${y - 1} V${y - 38}` : `M${head.x - 7.4} ${y + 1} V${y + 38}`}
                    strokeWidth="1.8"
                  />
                )}
              </g>
            );
          })}

          {/* The double bar line that ends a piece */}
          <g className="finale-bar" stroke="none" fill="currentColor">
            <rect x="978" y={yFor(38)} width="2" height={yFor(30) - yFor(38)} />
            <rect x="986" y={yFor(38)} width="6" height={yFor(30) - yFor(38)} />
          </g>
        </svg>
      </div>

      <div className="finale-actions">
        {!enabled ? (
          <button type="button" onClick={toggle}>
            <Play size={13} /> Turn the piano on for the ending
          </button>
        ) : (
          <button type="button" onClick={playPhrase} disabled={!ready || playing}>
            <Play size={13} />
            {!ready ? "Loading the piano…" : playing ? "Playing…" : "Play the last phrase"}
          </button>
        )}
        <span>IN THE KEY YOU CHOSE · {scaleFor(mood).name.toUpperCase()}</span>
      </div>

      <div className="finale-thanks">
        <h3>Thanks for staying</h3>
        <h3>
          <span>till the last note.</span>
        </h3>
      </div>

      <div ref={endRef} className="finale-end" aria-hidden="true" />
    </div>
  );
}

export default Finale;
