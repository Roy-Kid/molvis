/**
 * The three solvent-family envelopes, over one shared toolkit.
 *
 * | Mode  | Field                                   | Isovalue |
 * |-------|-----------------------------------------|----------|
 * | `vdw` | `maxᵢ (s·rᵢ − |p − xᵢ|)`                 | 0 |
 * | `sas` | same, with `rᵢ → s·rᵢ + r_probe`         | 0 |
 * | `ses` | `dist(p, P) − r_probe`, `P = {f_sas ≤ 0}`| 0 |
 *
 * SES is the Connolly / solvent-excluded surface: probe centres may sit only
 * in `P`, so the excluded solid is everything further than one probe radius
 * from `P`. Crevices too narrow for the probe are therefore filled — which is
 * the entire difference between SES and SAS — and it costs one distance
 * transform on top of the SAS field.
 *
 * All three are positive-inside, so the caller meshes at isovalue 0.
 */

import { AtomRadii } from "./atom_radii";
import { BallField } from "./ball_field";
import { EuclideanDistanceTransform } from "./distance_transform";
import { GridDomain } from "./grid_domain";

export type SolventSurfaceMode = "vdw" | "sas" | "ses";

/** Voxels of headroom past the largest kernel reach. */
const PAD_VOXELS = 3;

export interface SolventSurfaceInput {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  z: ArrayLike<number>;
  count: number;
  /** `element` column, when the frame has one. */
  elements?: readonly string[];
}

export interface SolventSurfaceOptions {
  mode: SolventSurfaceMode;
  /** Target voxel spacing, Å. */
  resolution: number;
  /** Solvent probe radius, Å. Ignored by `vdw`. */
  probeRadius: number;
  /** Multiplier on tabulated vdW radii. */
  radiusScale: number;
}

/** Construct, then read {@link domain} and {@link values}. */
export class SolventSurface {
  readonly domain: GridDomain;
  readonly values: Float64Array;
  readonly usedFallbackRadius: boolean;
  /** True when the requested resolution was coarsened to fit the voxel cap. */
  readonly clamped: boolean;

  constructor(input: SolventSurfaceInput, options: SolventSurfaceOptions) {
    const radii = new AtomRadii(input.count, input.elements, {
      scale: options.radiusScale,
    });
    const probe = Math.max(0, options.probeRadius);
    const resolution = Math.max(1e-3, options.resolution);
    // A probe that cannot be resolved on this grid is no probe at all; SES
    // then degenerates (its whole exterior would sit on the isosurface), so
    // fall back to the plain vdW envelope rather than draw nonsense.
    const mode: SolventSurfaceMode =
      options.mode !== "vdw" && probe <= resolution ? "vdw" : options.mode;

    this.domain = new GridDomain(input.x, input.y, input.z, input.count, {
      pad: paddingFor(mode, radii.max, probe, resolution),
      spacing: resolution,
    });
    this.usedFallbackRadius = radii.usedFallback;
    this.clamped = this.domain.clamped;
    this.values =
      mode === "ses"
        ? solventExcludedField(this.domain, input, radii, probe)
        : new BallField(this.domain, {
            ...input,
            radii: offsetRadii(radii.values, mode === "sas" ? probe : 0),
          }).values;
  }
}

/**
 * Padding must put the domain border outside every kernel, and for SES also
 * leave one probe radius of exterior so the border is genuinely part of `P`.
 */
function paddingFor(
  mode: SolventSurfaceMode,
  maxRadius: number,
  probe: number,
  resolution: number,
): number {
  const solvent = mode === "vdw" ? 0 : probe;
  const exterior = mode === "ses" ? probe : 0;
  return maxRadius + solvent + exterior + PAD_VOXELS * resolution;
}

function offsetRadii(radii: Float64Array, offset: number): Float64Array {
  if (offset === 0) return radii;
  const out = new Float64Array(radii.length);
  for (let i = 0; i < radii.length; i++) out[i] = radii[i] + offset;
  return out;
}

/** `dist(p, P) − r_probe` where `P` is the probe-centre-accessible region. */
function solventExcludedField(
  domain: GridDomain,
  input: SolventSurfaceInput,
  radii: AtomRadii,
  probe: number,
): Float64Array {
  const accessible = new BallField(domain, {
    ...input,
    radii: offsetRadii(radii.values, probe),
  }).values;

  // A probe centre may sit wherever it does not overlap an atom.
  const seeds = new Uint8Array(accessible.length);
  for (let i = 0; i < accessible.length; i++) {
    seeds[i] = accessible[i] <= 0 ? 1 : 0;
  }

  const { distances } = new EuclideanDistanceTransform(
    domain.shape,
    domain.spacing,
    seeds,
  );

  // The transform measures to seed voxel *centres*, but the true boundary of
  // `P` sits inside the first seed voxel — on average half a spacing nearer.
  // Left uncorrected, every SES comes out uniformly half a voxel too fat.
  const bias = 0.5 * domain.spacing;

  const values = new Float64Array(distances.length);
  for (let i = 0; i < distances.length; i++) {
    values[i] = distances[i] - bias - probe;
  }
  return values;
}
