/**
 * Minimal CPK-like colors for 2D sketch (document copy of common CPK hex).
 * Does not import molvis-core.
 */
export const SKETCH_ELEMENT_COLORS: Readonly<Record<string, string>> = {
  H: "#FFFFFF",
  C: "#C8CDD6",
  N: "#3050F8",
  O: "#FF0D0D",
  F: "#90E050",
  P: "#FF8000",
  S: "#FFFF30",
  Cl: "#1FF01F",
  Br: "#A62929",
  I: "#940094",
};

const DEFAULT_GRAY = "#808080";

/** Resolve fill color for an element symbol; unknown → gray. */
export function colorForElement(symbol: string): string {
  return SKETCH_ELEMENT_COLORS[symbol] ?? DEFAULT_GRAY;
}
