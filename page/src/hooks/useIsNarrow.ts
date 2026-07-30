import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Default width (px) below which the page switches to its narrow layout
 * (single-column canvas + overlay drawer sidebars). Chosen so the three
 * inline panels only coexist when there is genuinely room for them.
 */
export const NARROW_BREAKPOINT = 560;

/**
 * Observe an element's own width and report whether it is below a
 * breakpoint. Uses a `ResizeObserver` on the element itself rather than a
 * viewport media query, because the page is embedded in hosts (VSCode
 * webview, notebook cell) where the container is far narrower than the
 * viewport — a media query would measure the wrong box.
 *
 * @returns `[ref, isNarrow]` — attach `ref` to the container you want to
 * measure. `isNarrow` starts `false` and updates on the first observation.
 */
export function useIsNarrow<T extends HTMLElement = HTMLDivElement>(
  breakpoint: number = NARROW_BREAKPOINT,
  coarsePointerBreakpoint: number = breakpoint,
): readonly [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches === true,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(pointer: coarse)");
    const updatePointer = () => setCoarsePointer(query.matches);
    updatePointer();
    query.addEventListener("change", updatePointer);
    return () => query.removeEventListener("change", updatePointer);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const activeBreakpoint = coarsePointer
      ? coarsePointerBreakpoint
      : breakpoint;
    const updateWidth = (width: number) => {
      setIsNarrow(width < activeBreakpoint);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateWidth(entry.contentRect.width);
      }
    });
    updateWidth(el.getBoundingClientRect().width);
    observer.observe(el);

    return () => observer.disconnect();
  }, [breakpoint, coarsePointer, coarsePointerBreakpoint]);

  return [ref, isNarrow] as const;
}
