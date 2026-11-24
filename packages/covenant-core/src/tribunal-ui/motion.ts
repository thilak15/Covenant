import type { Variants } from "framer-motion";
import { useEffect, useState } from "react";

export const tribunalEasing = {
  settle: [0.22, 1, 0.36, 1] as const,
  control: [0.4, 0, 0.2, 1] as const,
} as const;

export const tribunalDuration = {
  micro: 0.16,
  panel: 0.26,
  verdict: 0.14,
  certification: 0.52,
} as const;

export function useTribunalReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

export function lanternRailVariants(reducedMotion: boolean): Variants {
  return {
    resting: {},
    resolved: {
      transition: {
        delayChildren: 0,
        staggerChildren: reducedMotion ? 0 : 0.07,
      },
    },
  };
}

export function lanternItemVariants(reducedMotion: boolean): Variants {
  return {
    resting: { opacity: 1 },
    resolved: {
      opacity: 1,
      transition: { duration: reducedMotion ? 0 : tribunalDuration.verdict },
    },
  };
}

export function lanternFlareVariants(reducedMotion: boolean): Variants {
  return {
    resting: { opacity: 0, scale: 1 },
    resolved: reducedMotion
      ? { opacity: 0, scale: 1, transition: { duration: 0 } }
      : {
          opacity: [0, 1, 0],
          scale: [0.8, 1, 1.12],
          transition: { duration: tribunalDuration.verdict, ease: tribunalEasing.settle },
        },
  };
}
