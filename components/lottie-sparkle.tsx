"use client";

import { Lottie } from "lottie-react";
import { useSyncExternalStore } from "react";
import sparkleAnimation from "../public/ai-sparkle-lottie.json";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

export function LottieSparkle({ className = "" }: { className?: string }) {
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false);

  return (
    <span className={`lottie-sparkle ${className}`.trim()} aria-hidden="true">
      <Lottie
        src={sparkleAnimation}
        autoplay={!reducedMotion}
        loop={!reducedMotion}
        segment={reducedMotion ? [18, 18] : undefined}
      />
    </span>
  );
}
