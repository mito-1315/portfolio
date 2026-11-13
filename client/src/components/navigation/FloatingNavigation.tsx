
import { useRef } from "react";
import gsap from "gsap";

const links = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Music Room", href: "#music" },
  { label: "Contact", href: "#contact" },
];

export default function FloatingNavigation() {
  const navRef = useRef<HTMLElement>(null);

  const moveIndicator = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const nav = navRef.current;
    const indicator = nav?.querySelector(".nav-indicator");

    if (!nav || !indicator) return;

    const link = event.currentTarget;
    const navRect = nav.querySelector(".nav-links")!.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    gsap.to(indicator, {
      x: linkRect.left - navRect.left - 5,
      width: linkRect.width,
      opacity: 1,
      duration: 0.45,
      ease: "power3.out",
    });
  };

  const hideIndicator = () => {
    const indicator = navRef.current?.querySelector(".nav-indicator");

    if (indicator) {
      gsap.to(indicator, {
        opacity: 0,
        duration: 0.25,
      });
    }
  };

  return (
    <nav ref={navRef} className="floating-navigation">
      <a href="#home" className="nav-logo">
        MT<span>.</span>
      </a>

      <div
        className="nav-links"
        onMouseLeave={hideIndicator}
      >
        <span className="nav-indicator" />

        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onMouseEnter={moveIndicator}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="nav-status">
        <span className="status-dot" />
        Available for opportunities
      </div>
    </nav>
  );
}
