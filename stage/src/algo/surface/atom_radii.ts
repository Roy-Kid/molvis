/**
 * Per-atom van der Waals radii for surface construction.
 *
 * Kept free of molrs types on purpose — like {@link ../marching_cubes}, this
 * consumes plain arrays so it is testable without a WASM frame. Reading the
 * `element` column off a `Block` is the modifier's job.
 *
 * The probe radius is **not** applied here: SAS/SES add it on top of these
 * values, and a class that both looks up vdW radii and knows about solvent
 * probes would be doing two jobs.
 */

import { getVanDerWaalsRadius } from "@molcrafts/molvis-core/elements";

/** Radius used when a frame carries no `element` column, Å. */
export const FALLBACK_RADIUS = 1.7;

export interface AtomRadiiOptions {
  /** Multiplier on the tabulated vdW radius. 1 = unscaled. */
  scale: number;
}

/**
 * Construct from an element column (or nothing), then read `values` / `max`.
 *
 * When `elements` is undefined or the wrong length, every atom takes
 * {@link FALLBACK_RADIUS} and {@link usedFallback} reports it, so the panel
 * can say "using uniform radius" instead of quietly drawing a carbon-shaped
 * surface over a metal cluster.
 */
export class AtomRadii {
  readonly values: Float64Array;
  readonly max: number;
  readonly usedFallback: boolean;

  constructor(
    count: number,
    elements: readonly string[] | undefined,
    options: AtomRadiiOptions,
  ) {
    const scale = Math.max(1e-3, options.scale);
    const usable = elements !== undefined && elements.length >= count;
    const values = new Float64Array(count);
    let max = 0;
    for (let i = 0; i < count; i++) {
      const base = usable ? getVanDerWaalsRadius(elements[i]) : FALLBACK_RADIUS;
      const r = base * scale;
      values[i] = r;
      if (r > max) max = r;
    }
    this.values = values;
    this.max = max;
    this.usedFallback = !usable;
  }
}
