import { BaseDataOp } from "./base";
import type { DataOpContext } from "../types";
import type { Frame } from "../../structure/frame";

/**
 * Options for AnalysisOp (RDF example).
 */
export interface RDFOptions {
  /** Maximum distance for RDF calculation */
  maxDistance: number;
  /** Number of bins for RDF histogram */
  nBins: number;
  /** Result name to store in frame.meta (default: "rdf") */
  resultName?: string;
}

/**
 * AnalysisOp performs analysis on frame data and stores results in frame.meta.
 * 
 * This is a placeholder implementation for RDF (Radial Distribution Function).
 * More complex analyses can be added as separate operations.
 */
export class AnalysisOp extends BaseDataOp {
  private options: RDFOptions;

  constructor(options: RDFOptions, id?: string) {
    super(id);
    this.options = options;
  }

  apply(frame: Frame, _ctx: DataOpContext): Frame {
    const atomBlock = frame.atomBlock;
    const nAtoms = atomBlock.n_atoms;
    const maxDistance = this.options.maxDistance;
    const nBins = this.options.nBins;
    const resultName = this.options.resultName || "rdf";

    // Simple RDF calculation (pairwise distances)
    const binWidth = maxDistance / nBins;
    const histogram = new Float32Array(nBins);
    const distances: number[] = [];

    const x = atomBlock.x;
    const y = atomBlock.y;
    const z = atomBlock.z;

    // Calculate pairwise distances
    for (let i = 0; i < nAtoms; i++) {
      for (let j = i + 1; j < nAtoms; j++) {
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const dz = z[j] - z[i];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < maxDistance) {
          distances.push(distance);
          const bin = Math.floor(distance / binWidth);
          if (bin < nBins) {
            histogram[bin]++;
          }
        }
      }
    }

    // Normalize histogram (simple normalization)
    const totalPairs = distances.length;
    if (totalPairs > 0) {
      for (let i = 0; i < nBins; i++) {
        histogram[i] /= totalPairs;
      }
    }

    // Store results in frame metadata
    frame.meta.set(resultName, {
      histogram: Array.from(histogram),
      distances: distances,
      binWidth: binWidth,
      maxDistance: maxDistance,
      nBins: nBins,
    });

    return frame;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      options: this.options,
    };
  }
}

