import dns from "node:dns/promises";
import net from "node:net";
import * as cheerio from "cheerio";
import { config } from "../config.js";
import type { QuizNote } from "./format.js";

/**
 * Looks for ready-made notes for a song on the public web. It searches, reads a
 * few of the pages found (politely: robots.txt is honoured, sizes and times are
 * capped, private addresses are refused) and picks out runs of note names.
 *
 * What a page can give is usually only the order of the pitches. Lengths and
 * tempo are rarely written down, so suggestions get equal lengths and say so.
 * Nothing is guessed: if a page has no notes, nothing is suggested.
 */

const USER_AGENT = "Mozilla/5.0 (compatible; PortfolioNotesFinder/1.0; personal use, honours robots.txt)";
const MAX_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 9000;
const MAX_PAGES = 8;

/** Pages that are never notes, or need a login to read. */
const SKIP_HOSTS = ["youtube.com", "youtu.be", "facebook.com", "instagram.com", "x.com", "twitter.com", "pinterest.", "spotify.com", "apple.com", "musescore.com", "reddit.com", "wikipedia.org"];

export type Candidate = {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  site: string;
  kind: "letters" | "sargam";
  /** Which part of the page: the whole page, its first run of notes, or its longest run. */
  scope: "whole" | "first" | "longest";
  noteCount: number;
  restCount: number;
  snippet: string;
  flags: string[];
  score: number;
  notes: QuizNote[];
};

export type FindResult = {
  query: string;
  engine: string;
  pagesChecked: number;
  skipped: { url: string; reason: string }[];
  candidates: Candidate[];
};

/* ---------- Safe fetching ---------- */

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower.startsWith("::ffff:127.") || lower.startsWith("::ffff:10.") || lower.startsWith("::ffff:192.168.");
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https pages are read.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Unusual port.");
  const host = url.hostname;
  if (SKIP_HOSTS.some((s) => host === s || host.endsWith(`.${s}`) || host.includes(s))) throw new Error("This kind of site does not have readable notes.");
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) throw new Error("Not a public address.");
}

async function limitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Fetches a page, following up to four redirects and checking every hop. */
async function fetchPage(start: string, accept = "text/html"): Promise<{ url: string; text: string }> {
  let current = new URL(start);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(current);
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: `${accept},application/xhtml+xml;q=0.9,*/*;q=0.5`, "Accept-Language": "en,ta;q=0.8" },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = new URL(response.headers.get("location")!, current);
      continue;
    }
    if (!response.ok) throw new Error(`The site answered ${response.status}.`);
    const type = response.headers.get("content-type") ?? "";
    if (!/html|text\/plain|xml/i.test(type)) throw new Error("Not a web page.");
    return { url: current.toString(), text: await limitedText(response) };
  }
  throw new Error("Too many redirects.");
}

/** Does the site's robots.txt allow reading this path? Failing to read it counts as allowed. */
async function robotsAllows(url: string): Promise<boolean> {
  try {
    const target = new URL(url);
    const response = await fetch(new URL("/robots.txt", target), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return true;
    const text = (await response.text()).slice(0, 100_000);
    let applies = false;
    let groupStart = true;
    const rules: { allow: boolean; path: string }[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/#.*$/, "").trim();
      const [field, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (!field) continue;
      const name = field.toLowerCase();
      if (name === "user-agent") {
        if (groupStart) applies = false;
        if (value === "*" || /portfolionotesfinder/i.test(value)) applies = true;
        groupStart = false;
      } else {
        groupStart = true;
        if (applies && (name === "disallow" || name === "allow") && value) rules.push({ allow: name === "allow", path: value });
      }
    }
    const path = target.pathname + target.search;
    let best: { allow: boolean; length: number } | null = null;
    for (const rule of rules) {
      const pattern = rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
      if (new RegExp(`^${pattern}`).test(path) && (!best || rule.path.length > best.length)) best = { allow: rule.allow, length: rule.path.length };
    }
    return best ? best.allow : true;
  } catch {
    return true;
  }
}

/* ---------- Searching ---------- */

type Hit = { url: string; title: string };

async function searchWeb(query: string): Promise<{ engine: string; hits: Hit[] }> {
  if (config.BRAVE_SEARCH_API_KEY) {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
      headers: { Accept: "application/json", "X-Subscription-Token": config.BRAVE_SEARCH_API_KEY },
      signal: AbortSignal.timeout(9000),
    });
    if (response.ok) {
      const data = (await response.json()) as { web?: { results?: { url: string; title: string }[] } };
      return { engine: "Brave Search", hits: (data.web?.results ?? []).map((r) => ({ url: r.url, title: r.title })) };
    }
  }
  if (config.GOOGLE_CSE_KEY && config.GOOGLE_CSE_ID) {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${config.GOOGLE_CSE_KEY}&cx=${config.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=10`,
      { signal: AbortSignal.timeout(9000) }
    );
    if (response.ok) {
      const data = (await response.json()) as { items?: { link: string; title: string }[] };
      return { engine: "Google", hits: (data.items ?? []).map((r) => ({ url: r.link, title: r.title })) };
    }
  }

  // No search key: read DuckDuckGo's plain-HTML results page.
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("The search engine did not answer. Try again in a minute.");
  const $ = cheerio.load(await response.text());
  const hits: Hit[] = [];
  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const wrapped = /[?&]uddg=([^&]+)/.exec(href);
    const url = wrapped ? decodeURIComponent(wrapped[1]!) : href.startsWith("http") ? href : "";
    if (url) hits.push({ url, title: $(el).text().trim() });
  });
  if (hits.length === 0) throw new Error("The search engine returned no results (it may be limiting requests). Try again, or paste a page address.");
  return { engine: "DuckDuckGo", hits };
}

/* ---------- Reading notes off a page ---------- */

const LETTER = /^([A-G])([#b♯♭])?(-?\d)?$/;
const REST = /^(_{1,}|-{1,2}|–|—|…|\.{2,}|~)$/;
const BAR = /^[|/\\:;]+$/;
const SARGAM_LETTER = /^([SRGMPDNsrgmpdn])([1-3]?)(['’.]?)$/;
const SARGAM_NAME = /^(sa|ri|re|ga|ma|pa|dha|da|ni)([1-3]?)(['’.]?)$/i;
const SARGAM_ONLY = /^[SRMPNsrmpn][1-3]?['’.]?$/;
const TAMIL: Record<string, string> = { "ஸ": "S", "ரி": "R", "க": "G", "ம": "M", "ப": "P", "த": "D", "நி": "N" };
const SARGAM_SEMITONES: Record<string, number> = { S: 0, R: 2, G: 4, M: 5, P: 7, D: 9, N: 11, s: 0, r: 1, g: 3, m: 6, p: 7, d: 8, n: 10 };
const NAME_SEMITONES: Record<string, number> = { sa: 0, ri: 2, re: 2, ga: 4, ma: 5, pa: 7, dha: 9, da: 9, ni: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

type Token = { type: "note"; pitch: string; octaveGiven: boolean } | { type: "rest" } | { type: "skip" } | { type: "other" };

function midiName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function classify(raw: string, kind: "letters" | "sargam"): Token {
  const token = raw.replace(/[,;()[\]{}"“”]+$/g, "").replace(/^[([{"“”]+/g, "");
  if (!token) return { type: "skip" };
  if (REST.test(token)) return { type: "rest" };
  if (BAR.test(token)) return { type: "skip" };

  if (kind === "letters") {
    const m = LETTER.exec(token);
    if (!m) return { type: "other" };
    const accidental = m[2] === "♯" ? "#" : m[2] === "♭" ? "b" : (m[2] ?? "");
    return { type: "note", pitch: `${m[1]}${accidental}${m[3] ?? ""}`, octaveGiven: m[3] !== undefined };
  }

  const name = SARGAM_NAME.exec(token);
  const letter = SARGAM_LETTER.exec(TAMIL[token] ?? token);
  const semitone = name ? NAME_SEMITONES[name[1]!.toLowerCase()] : letter ? SARGAM_SEMITONES[letter[1]!] : undefined;
  if (semitone === undefined) return { type: "other" };
  const mark = (name ? name[3] : letter?.[3]) ?? "";
  const shift = mark === "'" || mark === "’" ? 12 : mark === "." ? -12 : 0;
  return { type: "note", pitch: midiName(60 + semitone + shift), octaveGiven: true };
}

type Run = { kind: "letters" | "sargam"; tokens: Token[]; firstLine: string; guessedOctave: boolean };

/** Splits a page into lines the way a reader would see them. */
function pageLines($: cheerio.CheerioAPI): string[] {
  $("script, style, noscript, nav, footer, header, form, iframe, svg").remove();
  $("br").replaceWith("\n");
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, pre, td").each((_, el) => {
    $(el).append("\n");
  });
  return $.root()
    .text()
    .replace(/ /g, " ")
    .split(/\n+/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function findRuns(lines: string[], notesPage: boolean): Run[] {
  type LineInfo = { kind: "letters" | "sargam"; tokens: Token[]; notes: number; withOctave: number } | null;

  const info: LineInfo[] = lines.map((line) => {
    if (line.length > 400) return null;
    const words = line.split(/\s+/);
    if (words.length < 3) return null;
    const sargamish = words.some((w) => SARGAM_ONLY.test(w) || SARGAM_NAME.test(w) || TAMIL[w] !== undefined);
    const kind: "letters" | "sargam" = sargamish ? "sargam" : "letters";
    const tokens = words.map((w) => classify(w, kind));
    const meaningful = tokens.filter((t) => t.type !== "skip");
    const notes = tokens.filter((t) => t.type === "note").length;
    if (meaningful.length < 3 || notes < 3) return null;
    // Nearly every word on the line must be a note, a rest or a bar: that is what separates notes from prose.
    if (tokens.filter((t) => t.type === "other").length / meaningful.length > 0.15) return null;
    const withOctave = tokens.filter((t) => t.type === "note" && t.octaveGiven).length;
    // Bare letters like "C F G C" are usually chords, so they only count when octaves are written or the page is about notes.
    if (kind === "letters" && withOctave / notes < 0.5 && !notesPage) return null;
    return { kind, tokens, notes, withOctave };
  });

  const runs: Run[] = [];
  let current: { kind: "letters" | "sargam"; tokens: Token[]; firstLine: string; withOctave: number; notes: number; gap: number } | null = null;

  const close = () => {
    if (current && current.notes >= 8) {
      runs.push({ kind: current.kind, tokens: current.tokens, firstLine: current.firstLine, guessedOctave: current.withOctave < current.notes });
    }
    current = null;
  };

  info.forEach((line, i) => {
    if (line) {
      if (current && current.kind !== line.kind) close();
      if (!current) current = { kind: line.kind, tokens: [], firstLine: lines[i]!, withOctave: 0, notes: 0, gap: 0 };
      current.tokens.push(...line.tokens);
      current.withOctave += line.withOctave;
      current.notes += line.notes;
      current.gap = 0;
    } else if (current) {
      // Short labels between lines ("Pallavi", "Charanam") do not end a run; prose does.
      if (lines[i]!.length > 40 || ++current.gap > 2) close();
    }
  });
  close();
  return runs;
}

function toNotes(tokens: Token[]): { notes: QuizNote[]; guessedOctave: boolean; rests: number } {
  const notes: QuizNote[] = [];
  let beat = 0;
  let octave = 4;
  let guessed = false;
  let rests = 0;
  for (const t of tokens) {
    if (t.type === "rest") {
      // A run of rest marks (-, __) counts as one rest; two in a row are not stacked.
      if (notes.length === 0 || notes[notes.length - 1]!.pitch === "REST") continue;
      notes.push({ id: notes.length + 1, pitch: "REST", startBeat: beat, durationBeats: 1, velocity: 0 });
      rests++;
      beat += 1;
    } else if (t.type === "note") {
      let pitch = t.pitch;
      if (!/-?\d$/.test(pitch)) {
        pitch = `${pitch}${octave}`;
        guessed = true;
      } else octave = Number(/-?\d$/.exec(pitch)![0]);
      notes.push({ id: notes.length + 1, pitch, startBeat: beat, durationBeats: 1, velocity: 0.8 });
      beat += 1;
    }
  }
  while (notes.length && notes[notes.length - 1]!.pitch === "REST") notes.pop();
  return { notes, guessedOctave: guessed, rests };
}

const words = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 3);

function relevance(title: string, movie: string, pageTitle: string, pageText: string): number {
  const haystack = `${pageTitle} ${pageText.slice(0, 4000)}`.toLowerCase();
  const head = pageTitle.toLowerCase();
  const titleWords = words(title);
  const movieWords = words(movie);
  const hit = (list: string[], where: string) => (list.length ? list.filter((w) => where.includes(w)).length / list.length : 0);
  return hit(titleWords, head) * 30 + hit(titleWords, haystack) * 10 + hit(movieWords, haystack) * 10 + (/notes|swaram|sargam|piano|keyboard/.test(head) ? 10 : 0);
}

export function extractFromPage(html: string, pageUrl: string, title: string, movie: string): Candidate[] {
  const $ = cheerio.load(html);
  const pageTitle = ($("title").first().text() || $("h1").first().text()).replace(/\s+/g, " ").trim();
  const notesPage = /notes|swaram|sargam|piano|keyboard|keys/i.test(`${pageTitle} ${pageUrl}`);
  const lines = pageLines($);
  const runs = findRuns(lines, notesPage);
  if (runs.length === 0) return [];

  const site = new URL(pageUrl).hostname.replace(/^www\./, "");
  const pageRelevance = relevance(title, movie, pageTitle, lines.slice(0, 80).join(" "));

  const make = (scope: Candidate["scope"], parts: Run[]): Candidate | null => {
    const tokens = parts.flatMap((r) => r.tokens);
    const built = toNotes(tokens);
    if (built.notes.filter((n) => n.pitch !== "REST").length < 8) return null;
    const kind = parts[0]!.kind;
    const notes = built.notes.slice(0, 1200);
    const flags = ["Only the order of the pitches is on the page: every note is set to 1 beat. Set the real rhythm and tempo before publishing."];
    if (built.guessedOctave) flags.push("Some notes had no octave on the page: octave 4 was assumed.");
    if (kind === "sargam") flags.push("Written in sargam: Sa is taken as C4. Move it if the song is in another key.");
    if (scope === "whole" && parts.length > 1) flags.push(`Joins ${parts.length} separate runs of notes from the page, in page order.`);
    const noteCount = notes.filter((n) => n.pitch !== "REST").length;
    return {
      id: `${pageUrl}#${scope}`,
      sourceUrl: pageUrl,
      sourceTitle: pageTitle || site,
      site,
      kind,
      scope,
      noteCount,
      restCount: notes.length - noteCount,
      snippet: parts[0]!.firstLine.slice(0, 140),
      flags,
      score: Math.round(pageRelevance + Math.min(noteCount, 120) / 3 + (kind === "letters" && !built.guessedOctave ? 8 : 0) - (noteCount > 700 ? 10 : 0)),
      notes,
    };
  };

  const longest = [...runs].sort((a, b) => b.tokens.length - a.tokens.length)[0]!;
  const found = [
    runs.length > 1 ? make("whole", runs) : null,
    make("first", [runs[0]!]),
    longest !== runs[0] ? make("longest", [longest]) : null,
  ].filter((c): c is Candidate => c !== null);
  return found;
}

/* ---------- The whole search ---------- */

export async function findNotes(opts: { title: string; movie: string; url?: string | undefined }): Promise<FindResult> {
  const skipped: FindResult["skipped"] = [];
  const candidates: Candidate[] = [];

  const readPage = async (url: string) => {
    try {
      if (!(await robotsAllows(url))) throw new Error("The site's robots.txt asks automated readers not to use this page.");
      const page = await fetchPage(url);
      const found = extractFromPage(page.text, page.url, opts.title, opts.movie);
      if (found.length === 0) skipped.push({ url, reason: "No notes found on this page." });
      candidates.push(...found);
    } catch (e) {
      skipped.push({ url, reason: e instanceof Error ? e.message : "Could not be read." });
    }
  };

  // A specific page: read just that one.
  if (opts.url) {
    await readPage(opts.url);
    candidates.sort((a, b) => b.score - a.score);
    return { query: opts.url, engine: "the page you gave", pagesChecked: 1, skipped, candidates };
  }

  const query = `${opts.title} ${opts.movie} tamil song piano notes`.replace(/\s+/g, " ").trim();
  let { engine, hits } = await searchWeb(query);
  if (hits.length < 4) {
    const more = await searchWeb(`${opts.title} ${opts.movie} sargam notes`).catch(() => ({ engine, hits: [] as Hit[] }));
    hits = [...hits, ...more.hits];
  }
  const urls = [...new Map(hits.map((h) => [h.url, h])).keys()].slice(0, MAX_PAGES);
  await Promise.all(urls.map(readPage));

  candidates.sort((a, b) => b.score - a.score);
  return { query, engine, pagesChecked: urls.length, skipped, candidates: candidates.slice(0, 12) };
}
