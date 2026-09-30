import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven animation layer for the landing page.
 *
 * Markup contract (declarative, no per-component wiring needed):
 *  - [data-anim="up"]      → fade + slide up on enter
 *  - [data-anim="scale"]   → fade + scale on enter
 *  - [data-anim-group]     → stagger direct [data-anim] children
 *  - [data-parallax="0.2"] → vertical parallax while in view
 *  - [data-hero]           → intro timeline (runs immediately)
 */
export function useLandingMotion() {
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      // Hero intro
      const heroItems = gsap.utils.toArray<HTMLElement>("[data-hero] > *");
      if (heroItems.length) {
        gsap.from(heroItems, {
          y: 28,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.09,
        });
      }

      const heroPanel = document.querySelector<HTMLElement>("[data-hero-panel]");
      if (heroPanel) {
        gsap.from(heroPanel, {
          y: 40,
          opacity: 0,
          scale: 0.97,
          duration: 1,
          delay: 0.2,
          ease: "power3.out",
        });
      }

      // Grouped stagger reveals
      gsap.utils.toArray<HTMLElement>("[data-anim-group]").forEach((group) => {
        const items = gsap.utils.toArray<HTMLElement>("[data-anim]", group);
        if (!items.length) return;
        gsap.from(items, {
          y: 34,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: group, start: "top 82%", once: true },
        });
      });

      // Standalone reveals (not inside a group)
      gsap.utils.toArray<HTMLElement>("[data-anim]").forEach((el) => {
        if (el.closest("[data-anim-group]") && el.parentElement?.closest("[data-anim-group]")) return;
        const scale = el.dataset.anim === "scale";
        gsap.from(el, {
          y: scale ? 0 : 30,
          scale: scale ? 0.96 : 1,
          opacity: 0,
          duration: 0.75,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      // Parallax
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const strength = parseFloat(el.dataset.parallax || "0.15");
        gsap.to(el, {
          yPercent: -strength * 100,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
    });

    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(raf);
      ctx.revert();
    };
  }, []);
}
