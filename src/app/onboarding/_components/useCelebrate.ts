"use client";

import { useCallback, useRef } from "react";

type Intensity = "small" | "medium" | "big";

export function useCelebrate() {
  const reducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  const celebrate = useCallback(
    ({ intensity }: { intensity: Intensity }) => {
      if (reducedMotion.current) {
        dispatchEvent(new CustomEvent("celebrate:reduced", { detail: { intensity } }));
        return;
      }
      dispatchEvent(new CustomEvent("celebrate", { detail: { intensity } }));
    },
    []
  );

  return celebrate;
}
