"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the viewer has asked for reduced motion.
 *
 * Read through `useSyncExternalStore` rather than a `useState` + effect pair:
 * the media query is exactly the external system that API exists for, and it
 * keeps the preference out of render-triggering state. On the server there is
 * no query to read, so it reports false and is corrected on hydration — the
 * honest default, since assuming "reduced" would flash a fallback at everyone.
 *
 * CSS handles most of this on its own through `motion-reduce:` utilities. Use
 * this hook only where a component must not *mount* at all — an animation
 * player, a timed reveal — rather than merely animate differently.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}
