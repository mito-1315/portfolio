export type JournalKind = "BUG" | "DECISION" | "EXPERIMENT" | "LEARNED";

export type JournalEntry = {
  id: string;
  project: string;
  kind: JournalKind;
  title: string;
  body: string;
  before?: string | null;
  after?: string | null;
  /** ISO date, when known. */
  date?: string | null;
};

export const KIND_LABELS: Record<JournalKind, string> = {
  BUG: "Bug",
  DECISION: "Decision",
  EXPERIMENT: "Experiment",
  LEARNED: "Learned",
};

/**
 * How AI assistance was used, in plain words. Shown on the page and by the
 * terminal's `ai` command.
 */
export const AI_NOTE =
  "This site was built with an AI coding assistant, Claude Code by Anthropic. The design direction, the content and the decisions are mine; most of the code was written, tested and debugged in a long back-and-forth with the assistant. This journal shows that process as it happened, mistakes included.";

/**
 * A snapshot of the repository's real history, taken when this journal was
 * written. Later work is not included.
 */
export const GIT_SNAPSHOT = [
  { hash: "0801243", date: "2026-11-13", message: "About section" },
  { hash: "f4c173b", date: "2026-11-13", message: "Entrance and Hero done with no transition" },
  { hash: "41f253e", date: "2026-11-13", message: "Initial project setup" },
];

/**
 * The first entries cover this portfolio itself. Everything here actually
 * happened while it was being built. Entries for other projects are added
 * from the admin dashboard.
 */
export const BUILT_IN_ENTRIES: JournalEntry[] = [
  {
    id: "sound-off",
    project: "This portfolio",
    kind: "DECISION",
    title: "Sound stays off until you ask",
    body: "An early version played piano notes after the first click. It now stays silent until you turn sound on, from the entry screen or the nav, and it remembers that choice for the visit only. The piano samples (about 2 MB) are not downloaded until then either.",
  },
  {
    id: "code-piano",
    project: "This portfolio",
    kind: "DECISION",
    title: "A piano drawn in code, not downloaded",
    body: "The Music Room's grand piano is not a 3D model. It is a cloud of points scattered over a few measured shapes: the case, the lid, 88 keys, three legs and a music stand. There is no file to download, and it looks the same on every visit. The number of points scales with the device, and a line drawing takes over when WebGL is not available.",
  },
  {
    id: "same-class-name",
    project: "This portfolio",
    kind: "BUG",
    title: "Two things called “movement”",
    body: "The big section numerals used a wrapper class named movement, which the Projects section already used for its own layout. Skills and other sections inherited a grid they never asked for and shrank. It was found by measuring, not by looking: the Skills grid was 282 px wide on a 967 px screen. Renaming the wrapper fixed every section at once.",
    before: "Skills grid: 282 px wide",
    after: "Skills grid: 855 px wide",
  },
  {
    id: "links-landed-short",
    project: "This portfolio",
    kind: "BUG",
    title: "Section links that landed short",
    body: "With smooth scrolling on, navigation links stopped 330 px short of their section. The page had a scroll offset on the whole document and another on every section, and the smooth scroller honoured both. Removing the duplicate made every section land in the same place.",
    before: "Section top at 330 px",
    after: "Section top at 120 px, every time",
  },
  {
    id: "triggers-out-of-step",
    project: "This portfolio",
    kind: "BUG",
    title: "Scroll triggers that fell out of step",
    body: "After a layout fix, the Experience chapters lit up more than 2,000 px late. Scroll triggers measure positions once, and the page had moved underneath them. They are now refreshed when fonts finish loading, and anything that must always be right, such as the movement indicator and which hidden object appears, reads the live layout instead.",
  },
  {
    id: "frames-in-frames",
    project: "This portfolio",
    kind: "EXPERIMENT",
    title: "Projects as frames inside frames",
    body: "Instead of a horizontal gallery, each project is a frame that holds a smaller frame, which holds another: overview, story, then how it works. Scrolling flies a camera into each layer and diagonally across to the next project. On phones, and with reduced motion, it becomes plain nested frames you read in order.",
  },
  {
    id: "lost-backslashes",
    project: "This portfolio",
    kind: "BUG",
    title: "Patterns that lost their backslashes",
    body: "The check for melody notes (such as C4:1 D#4:0.5) rejected valid input because the backslashes in its pattern were stripped when the file was written through a shell command. It happened a second time with a date pattern. Both were caught the same way: posting one valid and one invalid example to the API.",
  },
  {
    id: "public-domain-tunes",
    project: "This portfolio",
    kind: "DECISION",
    title: "Only public-domain tunes in the game",
    body: "Guess the Song uses traditional and public-domain melodies, written as note data and played on the site's own piano samples, so there is no licensing question. More tunes can be added from the admin dashboard.",
  },
  {
    id: "hidden-tabs",
    project: "This portfolio",
    kind: "LEARNED",
    title: "A hidden tab freezes animation",
    body: "Browsers throttle animation in hidden or background tabs. While testing, pages looked stuck, with blank screens and entry animations that never finished, and none of it was a bug. Animations are now judged in a visible window, and logic that has to be correct does not wait on animation frames.",
  },
  {
    id: "measure",
    project: "This portfolio",
    kind: "LEARNED",
    title: "Measure it, don't squint at it",
    body: "Most of the bugs above were found by measuring something: a column width, a scroll position, a count of notes played. The same habit caught the first version of the aim mode counting a clean hit as a miss, because the target had drifted from where it was created.",
  },
];
