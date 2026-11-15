import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "lucide-react";
import { useApi } from "../../services/api";
import {
  AI_NOTE,
  BUILT_IN_ENTRIES,
  GIT_SNAPSHOT,
  KIND_LABELS,
  type JournalEntry,
  type JournalKind,
} from "./journalData";
import "./Journal.css";

gsap.registerPlugin(ScrollTrigger);

type ApiEntry = {
  id: number;
  project: string;
  kind: JournalKind;
  title: string;
  body: string;
  before: string | null;
  after: string | null;
  entryDate: string | null;
};

const noApiEntries: ApiEntry[] = [];

type Filter = "ALL" | JournalKind;
type Line = { id: number; tone: "cmd" | "out" | "dim"; text: string };

const KIND_ORDER: JournalKind[] = ["BUG", "DECISION", "EXPERIMENT", "LEARNED"];
const COMMANDS = ["help", "log", "bugs", "decisions", "experiments", "learned", "ai", "clear"];

const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;

const WELCOME: Omit<Line, "id">[] = [
  { tone: "dim", text: "lab notebook · type help, or press a command below" },
];

function Journal() {
  const sectionRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const nextLine = useRef(1);

  const { data: apiEntries } = useApi<ApiEntry[]>("/journal", noApiEntries);

  const entries = useMemo<JournalEntry[]>(() => {
    const fromApi = apiEntries.map(
      (e): JournalEntry => ({
        id: `api-${e.id}`,
        project: e.project,
        kind: e.kind,
        title: e.title,
        body: e.body,
        before: e.before,
        after: e.after,
        date: e.entryDate,
      })
    );
    // Entries added in the dashboard come first; the built-in ones follow.
    return [...fromApi, ...BUILT_IN_ENTRIES];
  }, [apiEntries]);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    WELCOME.map((line, i) => ({ ...line, id: i + 1000 }))
  );

  const visible = filter === "ALL" ? entries : entries.filter((e) => e.kind === filter);
  const count = (kind: JournalKind) => entries.filter((e) => e.kind === kind).length;

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".journal-section .reveal", {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
      });
    },
    { scope: sectionRef }
  );

  // Keep the newest output in view.
  useEffect(() => {
    const screen = screenRef.current;
    if (screen) screen.scrollTop = screen.scrollHeight;
  }, [lines]);

  const push = (add: Omit<Line, "id">[]) =>
    setLines((previous) => [...previous, ...add.map((line) => ({ ...line, id: nextLine.current++ }))]);

  const run = (raw: string) => {
    const command = raw.trim().toLowerCase();
    if (!command) return;

    if (command === "clear") {
      setLines([]);
      return;
    }

    const out: Omit<Line, "id">[] = [{ tone: "cmd", text: raw.trim() }];
    const kindFor: Record<string, JournalKind> = {
      bugs: "BUG",
      decisions: "DECISION",
      experiments: "EXPERIMENT",
      learned: "LEARNED",
    };

    if (command === "help") {
      out.push(
        { tone: "out", text: "help         this list" },
        { tone: "out", text: "log          the repository's real commit history" },
        { tone: "out", text: "bugs         things that broke, and how they were found" },
        { tone: "out", text: "decisions    choices, and why" },
        { tone: "out", text: "experiments  ideas that were tried" },
        { tone: "out", text: "learned      what stuck" },
        { tone: "out", text: "all          show every entry" },
        { tone: "out", text: "ai           how AI was used here" },
        { tone: "out", text: "clear        wipe the screen" }
      );
    } else if (command === "log") {
      GIT_SNAPSHOT.forEach((commit) =>
        out.push({ tone: "out", text: `${commit.hash}  ${commit.date}  ${commit.message}` })
      );
      out.push({ tone: "dim", text: "A snapshot of the repo's history when this was written. Later work isn't in it." });
    } else if (command === "ai") {
      out.push({ tone: "out", text: AI_NOTE });
    } else if (command === "all") {
      setFilter("ALL");
      out.push({ tone: "out", text: `Showing all ${entries.length} entries.` });
    } else if (kindFor[command]) {
      const kind = kindFor[command]!;
      const matching = entries.filter((e) => e.kind === kind);
      setFilter(kind);
      if (matching.length === 0) out.push({ tone: "dim", text: "Nothing logged yet." });
      matching.forEach((e) => out.push({ tone: "out", text: `· ${e.title}` }));
    } else {
      out.push({ tone: "dim", text: `command not found: ${command}. Try help.` });
    }
    push(out);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    run(input);
    setInput("");
  };

  return (
    <section ref={sectionRef} className="journal-section page-container" id="journal">
      <div className="journal-heading">
        <span className="section-label reveal">THE LAB NOTEBOOK</span>
        <h2 className="reveal">
          Built,
          <br />
          <span>not generated.</span>
        </h2>
        <p className="journal-ai reveal">{AI_NOTE}</p>
      </div>

      <div className="journal-layout">
        <div className="journal-terminal reveal">
          <div className="terminal-bar" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>lab — journal</span>
          </div>

          <div ref={screenRef} className="terminal-screen" role="log" aria-live="polite" aria-label="Journal terminal">
            {lines.map((line) => (
              <p key={line.id} className={`term-${line.tone}`}>
                {line.tone === "cmd" ? <span aria-hidden="true">$ </span> : null}
                {line.text}
              </p>
            ))}
          </div>

          <div className="terminal-chips">
            {COMMANDS.map((command) => (
              <button key={command} type="button" onClick={() => run(command)}>
                {command}
              </button>
            ))}
          </div>

          <form className="terminal-input" onSubmit={submit}>
            <label htmlFor="journal-command">$</label>
            <input
              id="journal-command"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type a command"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Terminal command"
            />
          </form>
        </div>

        <div className="journal-entries">
          <div className="journal-filters reveal" role="group" aria-label="Filter entries">
            <button type="button" className={filter === "ALL" ? "on" : ""} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
              All <span>{entries.length}</span>
            </button>
            {KIND_ORDER.map((kind) => (
              <button
                key={kind}
                type="button"
                className={filter === kind ? "on" : ""}
                aria-pressed={filter === kind}
                onClick={() => setFilter(kind)}
              >
                {KIND_LABELS[kind]} <span>{count(kind)}</span>
              </button>
            ))}
          </div>

          <div className="journal-list">
            {visible.length === 0 && <p className="journal-empty">Nothing logged here yet.</p>}
            {visible.map((entry) => (
              <article key={entry.id} className={`entry kind-${entry.kind.toLowerCase()}`}>
                <header>
                  <span className="entry-kind">{KIND_LABELS[entry.kind].toUpperCase()}</span>
                  <span className="entry-project">{entry.project}</span>
                  {formatDate(entry.date) && <span className="entry-date">{formatDate(entry.date)}</span>}
                </header>
                <h3>{entry.title}</h3>
                <p>{entry.body}</p>
                {(entry.before || entry.after) && (
                  <div className="entry-diff">
                    <span>{entry.before}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                    <span className="after">{entry.after}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Journal;
