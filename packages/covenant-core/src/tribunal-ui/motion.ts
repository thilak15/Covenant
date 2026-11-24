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

export function patchReviewVariants(reducedMotion: boolean): Variants {
  return {
    closed: { opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : -6 },
    open: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0 : tribunalDuration.panel, ease: tribunalEasing.settle },
    },
  };
}

export type PatchSourceRole = "expected" | "replacement";

export function patchSourceVariants(reducedMotion: boolean, role: PatchSourceRole): Variants {
  const idle = { opacity: 1, x: 0 } as const;
  if (reducedMotion) {
    return {
      idle,
      reviewing: { opacity: 1, x: 0, transition: { duration: 0 } },
    };
  }
  return {
    idle,
    reviewing: role === "expected"
      ? {
          opacity: [1, 0.35, 1],
          x: [0, -4, 0],
          transition: { duration: tribunalDuration.panel, ease: tribunalEasing.settle },
        }
      : {
          opacity: [0.55, 1],
          x: [4, 0],
          transition: { duration: tribunalDuration.panel, ease: tribunalEasing.settle },
        },
  };
}

export function verificationDrawerVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      closed: { height: 0, opacity: 0, y: 0, transition: { duration: 0 } },
      open: { height: "auto", opacity: 1, y: 0, transition: { duration: 0 } },
    };
  }
  return {
    closed: {
      height: 0,
      opacity: 0,
      y: 10,
      transition: { duration: 0.24, ease: tribunalEasing.control },
    },
    open: {
      height: "auto",
      opacity: 1,
      y: 0,
      transition: { duration: 0.24, ease: tribunalEasing.settle },
    },
  };
}

export function certificationSealVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      unsealed: { opacity: 1, rotate: 0, scale: 1 },
      sealed: { opacity: 1, rotate: 0, scale: 1, transition: { duration: 0 } },
    };
  }
  return {
    unsealed: { opacity: 1, rotate: -7, scale: 1.35 },
    sealed: {
      opacity: 1,
      rotate: [-7, -2, 0],
      scale: [1.35, 0.96, 1],
      transition: {
        duration: tribunalDuration.certification,
        ease: tribunalEasing.settle,
        times: [0, 0.62, 1],
      },
    },
  };
}
