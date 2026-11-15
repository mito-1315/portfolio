import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { THEMES, applyTheme, currentTheme, type ThemeId } from "../../theme/theme";
import "./ThemeSwitcher.css";

/** A small palette button in the nav that opens a list of colour themes. */
function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(currentTheme);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (id: ThemeId) => {
    applyTheme(id);
    setTheme(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="theme-switcher">
      <button
        type="button"
        className="theme-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change colour theme"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={15} strokeWidth={1.6} aria-hidden="true" />
      </button>

      {open && (
        <div className="theme-menu" role="group" aria-label="Colour theme">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === theme ? "on" : ""}
              aria-pressed={item.id === theme}
              onClick={() => choose(item.id)}
            >
              <span
                className="theme-swatch"
                style={{ background: `linear-gradient(135deg, ${item.swatch[0]} 50%, ${item.swatch[1]} 50%)` }}
                aria-hidden="true"
              />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
