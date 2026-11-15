import { Download } from "lucide-react";
import "./ResumeButton.css";

export const RESUME_PATH = "/Mithesh-Tharun-Resume.pdf";
export const RESUME_FILENAME = "Mithesh-Tharun-Resume.pdf";

type ResumeButtonProps = {
  /** "ghost" is an outlined button; "nav" is a compact icon-led pill. */
  variant?: "ghost" | "nav";
  className?: string;
};

/**
 * Downloads the original resume PDF. The `download` attribute gives the
 * saved file a clean name; the link also works as a normal PDF link where a
 * browser ignores the attribute.
 */
function ResumeButton({ variant = "ghost", className = "" }: ResumeButtonProps) {
  return (
    <a
      href={RESUME_PATH}
      download={RESUME_FILENAME}
      className={`resume-button resume-${variant} ${className}`}
    >
      <span>Download Resume</span>
      <Download size={14} strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}

export default ResumeButton;
