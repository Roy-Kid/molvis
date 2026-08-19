/**
 * Read-only HUD/analysis view of a trajectory's three-component extent.
 *
 * Units: every count and index is **frames** (0-based except `frameReadout`).
 */

export interface TrajectoryExtentInput {
  length: number | null;
  indexedLength: number;
  indexComplete: boolean;
}

export class TrajectoryExtent {
  readonly length: number | null;
  readonly indexedLength: number;
  readonly indexComplete: boolean;

  constructor(input: TrajectoryExtentInput) {
    this.length = input.length;
    this.indexedLength = Math.max(0, input.indexedLength);
    this.indexComplete = input.indexComplete;
  }

  static empty(): TrajectoryExtent {
    return new TrajectoryExtent({
      length: 0,
      indexedLength: 0,
      indexComplete: true,
    });
  }

  static fromTrajectory(traj: TrajectoryExtentInput): TrajectoryExtent {
    return new TrajectoryExtent(traj);
  }

  /** Frames the HUD may address (`length` when known, else indexed). */
  get addressableLength(): number {
    return this.length ?? this.indexedLength;
  }

  get lastAddressableIndex(): number {
    return Math.max(0, this.addressableLength - 1);
  }

  get filmstripVisible(): boolean {
    // Scanning (unknown N) must show the indicator even at 1 indexed frame.
    return !this.indexComplete || this.addressableLength > 1;
  }

  get allowsImplicitWholeRange(): boolean {
    return this.indexComplete && this.length !== null;
  }

  implicitEndIndex(): number | null {
    if (!this.allowsImplicitWholeRange) return null;
    return this.lastAddressableIndex;
  }

  /** `3/40` when complete; `3/12…` while scanning. Display is 1-based. */
  frameReadout(currentIndex: number): string {
    const current = this.addressableLength === 0 ? 0 : currentIndex + 1;
    const total = this.addressableLength;
    return this.indexComplete ? `${current}/${total}` : `${current}/${total}…`;
  }

  get lastControlLabel(): string {
    return this.indexComplete ? "Last frame" : "Last indexed frame";
  }
}
