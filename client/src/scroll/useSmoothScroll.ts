import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Inertial smooth scrolling, driven by GSAP's ticker so ScrollTrigger and
 * Lenis share one clock. Skipped entirely for visitors who prefer reduced
 * motion, who keep the browser's native scrolling.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.1,
      // In-page links (#projects ...) scroll smoothly. Each section sets its own
      // scroll-margin-top, which keeps it clear of the floating nav.
      anchors: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    // While any modal is open the page stands still and only the modal scrolls.
    const syncModal = () => {
      const modals = document.querySelectorAll('[aria-modal="true"]');
      modals.forEach((m) => m.setAttribute("data-lenis-prevent", ""));
      if (modals.length) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(syncModal);
    observer.observe(document.body, { childList: true, subtree: true });

    // Web fonts change text heights; re-measure scroll triggers once they load.
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      observer.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
}
