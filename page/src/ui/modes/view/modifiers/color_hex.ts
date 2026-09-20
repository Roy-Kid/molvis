/**
 * Linear-RGB ↔ hex for the `<input type="color">` swatches in modifier
 * panels.
 *
 * The engine stores colors as linear RGB triples in [0, 1]; the browser's
 * color input speaks `#rrggbb`. Three panels had byte-identical copies of the
 * conversion, differing only in which color they fell back to when a value
 * failed to parse — so the fallback is a parameter here rather than a
 * silently different constant per file.
 */

export type Rgb = readonly [number, number, number];

export function rgbToHex(rgb: Rgb): string {
  const to8 = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${to8(rgb[0])}${to8(rgb[1])}${to8(rgb[2])}`;
}

/** Parses `#rrggbb` (with or without the hash); returns `fallback` if it cannot. */
export function hexToRgb(hex: string, fallback: Rgb): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return [...fallback] as [number, number, number];
  const n = Number.parseInt(match[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}
