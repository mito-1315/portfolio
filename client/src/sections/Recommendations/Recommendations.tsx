import { useRef, useState } from "react";
import type { FormEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ExternalLink } from "lucide-react";
import { useApi } from "../../services/api";
import "./Recommendations.css";

gsap.registerPlugin(ScrollTrigger);

type Recommendation = {
  id: number;
  kind: "SONG" | "MOVIE" | "OTHER";
  name: string;
  title: string;
  reason: string;
  link: string | null;
};

const none: Recommendation[] = [];

type Kind = Recommendation["kind"];

const KIND_LABEL: Record<Kind, { choice: string; field: string; tag: string }> = {
  SONG: { choice: "A song", field: "SONG & ARTIST", tag: "SONG" },
  MOVIE: { choice: "A movie", field: "MOVIE TITLE", tag: "MOVIE" },
  OTHER: { choice: "Something else", field: "WHAT IS IT?", tag: "INSPIRATION" },
};

type Status =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; message: string }
  | { state: "error"; message: string };

/** A slight, stable tilt per card so the board feels hand-pinned. */
const tilt = (id: number) => ((id * 37) % 7) - 3;

function Recommendations() {
  const sectionRef = useRef<HTMLElement>(null);
  const { data: items, live } = useApi<Recommendation[]>("/recommendations", none);
  const [kind, setKind] = useState<Kind>("SONG");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".wall-section .reveal", {
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const link = String(data.get("link") ?? "").trim();

    setStatus({ state: "sending" });
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: data.get("name"),
          title: data.get("title"),
          reason: data.get("reason"),
          ...(link ? { link } : {}),
          website: data.get("website") ?? "",
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setStatus({ state: "error", message: "That's a lot of ideas! Please try again in a while." });
      } else if (!response.ok) {
        const issues = body?.issues ? Object.values(body.issues).flat().join(" ") : "";
        setStatus({ state: "error", message: issues || "Please check the form and try again." });
      } else {
        form.reset();
        setStatus({ state: "done", message: body.message ?? "Thanks! It will appear once approved." });
      }
    } catch {
      setStatus({ state: "error", message: "Couldn't reach the server. Please try again later." });
    }
  };

  return (
    <section ref={sectionRef} className="wall-section page-container" id="recommend">
      <span className="section-label reveal">THE WALL · RECOMMENDATIONS</span>
      <h2 className="wall-title reveal">
        Pin something
        <br />
        <span>worth my attention.</span>
      </h2>

      <div className="wall-layout">
        <form className="wall-form reveal" onSubmit={submit}>
          <div className="wall-kind" role="group" aria-label="What are you recommending?">
            {(["SONG", "MOVIE", "OTHER"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? "on" : ""}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {KIND_LABEL[k].choice}
              </button>
            ))}
          </div>

          <label>
            <span>YOUR NAME</span>
            <input name="name" type="text" required maxLength={60} autoComplete="given-name" />
          </label>
          <label>
            <span>{KIND_LABEL[kind].field}</span>
            <input name="title" type="text" required maxLength={120} />
          </label>
          <label>
            <span>WHY?</span>
            <textarea name="reason" rows={3} required minLength={3} maxLength={300} />
          </label>
          <label>
            <span>LINK (OPTIONAL)</span>
            <input name="link" type="url" maxLength={300} placeholder="https://" />
          </label>

          {/* Honeypot: hidden from people, tempting to bots. */}
          <div className="wall-trap" aria-hidden="true">
            <label>
              Website
              <input name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <button type="submit" className="wall-submit" disabled={status.state === "sending"}>
            {status.state === "sending" ? "Pinning…" : "Pin it"}
          </button>
          <p
            className={`wall-status ${status.state === "error" ? "error" : ""}`}
            role="status"
          >
            {status.state === "done" || status.state === "error"
              ? status.message
              : "New pins are checked before they appear. Your name is shown; nothing else about you is kept."}
          </p>
        </form>

        <div className="wall-board reveal">
          {items.length === 0 ? (
            <p className="wall-empty">
              {live
                ? "The board is empty. Be the first to pin something."
                : "The board loads from the server, which isn't reachable right now."}
            </p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className={`pin ${item.kind.toLowerCase()}`}
                style={{ transform: `rotate(${tilt(item.id)}deg)` }}
              >
                <span className="pin-dot" aria-hidden="true" />
                <span className="pin-kind">{KIND_LABEL[item.kind].tag}</span>
                <h3>{item.title}</h3>
                <p>{item.reason}</p>
                <footer>
                  <span>— {item.name}</span>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer noopener nofollow ugc"
                      aria-label={`Open link for ${item.title}`}
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                </footer>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default Recommendations;
