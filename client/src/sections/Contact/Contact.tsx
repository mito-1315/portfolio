import { useRef, useState } from "react";
import type { FormEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "lucide-react";
import { useSound } from "../../audio/SoundContext";
import ResumeButton from "../../components/resume/ResumeButton";
import Finale from "./Finale";
import { OPEN_HINTS_EVENT } from "../../discoveries/HintsWindow";
import "./Contact.css";

gsap.registerPlugin(ScrollTrigger);

const EMAIL = "mitheshtharun@gmail.com";
const GITHUB = "https://github.com/mito-1315";

function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const { play } = useSound();
  const [sent, setSent] = useState(false);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".contact-section .reveal", {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
      });

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 50%",
        once: true,
        onEnter: () => play("C5"),
      });
    },
    { scope: sectionRef }
  );

  // There is no backend, so the form opens the visitor's mail app with the
  // message prefilled rather than pretending to send it.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const from = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const subject = encodeURIComponent(`Portfolio message from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${from})`);
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
    play("G5");
  };

  return (
    <section
      ref={sectionRef}
      className="contact-section page-container"
      id="contact"
    >
      <span className="section-label reveal">FINALE · CONTACT</span>

      <h2 className="contact-title reveal">
        Let&apos;s write the
        <br />
        <span>next movement.</span>
      </h2>

      <div className="contact-grid">
        <div className="contact-info">
          <p className="contact-lede reveal">
            Open to internships, collaborations and interesting problems. If
            something here resonated, say hello.
          </p>

          <dl className="contact-details reveal">
            <div>
              <dt>EMAIL</dt>
              <dd>
                <a href={`mailto:${EMAIL}`}>
                  {EMAIL}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </dd>
            </div>
            <div>
              <dt>GITHUB</dt>
              <dd>
                <a href={GITHUB} target="_blank" rel="noreferrer">
                  github.com/mito-1315
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </dd>
            </div>
            <div>
              <dt>LOCATION</dt>
              <dd>Chennai, India</dd>
            </div>
          </dl>

          <div className="reveal">
            <ResumeButton variant="ghost" />
          </div>
        </div>

        <form className="contact-form reveal" onSubmit={handleSubmit}>
          <label>
            <span>NAME</span>
            <input name="name" type="text" required autoComplete="name" />
          </label>
          <label>
            <span>EMAIL</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            <span>MESSAGE</span>
            <textarea name="message" rows={4} required />
          </label>
          <button type="submit" className="contact-submit">
            Send message
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
          <p className="contact-note" role="status">
            {sent
              ? "Your mail app should open with the message ready to send."
              : "This opens your mail app with the message prefilled."}
          </p>
        </form>
      </div>

      <Finale />

      <div className="contact-foot reveal">
        <span>© {new Date().getFullYear()} MITHESH THARUN</span>
        <button type="button" className="contact-hint" onClick={() => window.dispatchEvent(new Event(OPEN_HINTS_EVENT))}>
          NEED A HINT?
        </button>
        <span>FIN.</span>
      </div>
    </section>
  );
}

export default Contact;
