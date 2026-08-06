/**
 * User-tunable ribbon appearance — passed from `DrawRibbonModifier`
 * down to the `RibbonRenderer` on every redraw.
 *
 * The cross-section *shape* (helix oval, sheet flat, coil tube) is
 * deliberately not exposed: those ratios encode the
 * structural-biology consensus on how a cartoon should be read,
 * and arbitrary tuning makes the figure scientifically dishonest.
 * Width *scale* (uniform multiplier) is exposed because that's a
 * presentation knob — it changes density of ink, not which atoms
 * a given visual shape implies.
 *
 * Colors always come from the stage palette (the categorical sequence
 * + internal `viridis` ramp) so ribbons match atom/type coloring.
 */

import { categoricalColorAt, getColorMap, type LinearRGB } from "../palette";
import type { SecondaryStructureType } from "./pdb_backbone";

export type RibbonColorMode = "ss" | "spectrum" | "chain" | "uniform";

export interface RibbonStyle {
  /** How residues are colored along the ribbon. */
  readonly colorMode: RibbonColorMode;
  /** RGB triple (each in [0, 1]). Used iff `colorMode === "uniform"`. */
  readonly uniformColor: readonly [number, number, number];
  /** Multiplier on each SS profile's nominal width. 1.0 = default. */
  readonly widthScale: number;
  /** Spline subdivisions per residue. Higher = smoother, more verts. */
  readonly smoothness: number;
  /** Material opacity in [0, 1]. 1 = fully opaque. */
  readonly opacity: number;
}

/**
 * Secondary-structure → categorical ordinal.
 * Helix coral, sheet gold, coil steel grey — still SS-readable, but
 * drawn from the same swatches as type/chain coloring.
 */
const SS_PALETTE_ORDINAL: Record<SecondaryStructureType, number> = {
  helix: 2, // #FF6B6B coral
  sheet: 5, // #FFD93D gold
  coil: 8, // #B0B8C4 light steel
};

/**
 * Palette stores linear RGB (same as atom impostor buffers). Ribbon
 * meshes use StandardMaterial vertex colors, which are treated as
 * display/sRGB — convert so swatches match the palette UI.
 */
function linearToDisplay(rgb: LinearRGB): [number, number, number] {
  const conv = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return [conv(rgb[0]), conv(rgb[1]), conv(rgb[2])];
}

/** Neutral uniform default = coil steel from the categorical palette. */
const DEFAULT_UNIFORM = linearToDisplay(
  categoricalColorAt(SS_PALETTE_ORDINAL.coil),
);

export const DEFAULT_RIBBON_STYLE: RibbonStyle = {
  // Chain colors match multi-chain figures (e.g. RCSB / ChimeraX defaults).
  colorMode: "chain",
  uniformColor: DEFAULT_UNIFORM,
  widthScale: 0.95,
  smoothness: 14,
  opacity: 1.0,
};

/** SS color from the default categorical palette (display/sRGB). */
export function ssColor(ss: SecondaryStructureType): [number, number, number] {
  return linearToDisplay(categoricalColorAt(SS_PALETTE_ORDINAL[ss]));
}

/**
 * Per-chain color — same ordinal path as type rails / legends
 * (`categoricalColorAt`), in display/sRGB for the ribbon material.
 */
export function chainColor(chainIndex: number): [number, number, number] {
  return linearToDisplay(categoricalColorAt(Math.max(0, chainIndex)));
}

/**
 * N→C spectrum via the internal continuous `viridis` ramp (same map used
 * for numeric property coloring). `t` is in [0, 1]. Display/sRGB.
 */
export function spectrumColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return linearToDisplay(getColorMap("viridis").sample(clamped));
}
