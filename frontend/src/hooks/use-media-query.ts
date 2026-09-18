import { useEffect, useState } from "react";

/**
 * Subscribes to a media query.
 *
 * The initial value is read synchronously so the first paint already matches
 * the viewport; a `useEffect`-only version would render the desktop tree on a
 * phone for one frame and visibly reflow.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Tailwind's `md` breakpoint: below this the timeline switches to day view. */
export const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

/** Dark mode is a *selected* palette, so components must know which is active. */
export function useIsDarkScheme(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}
