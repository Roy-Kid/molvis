declare module "@molcrafts/molrs" {
  export type WasmObject = object;
  export interface WasmCenterOfMassResult {
    centersOfMass(): Float32Array | number[];
    clusterMasses(): Float32Array | number[];
    free(): void;
  }
  export interface WasmMSDResult {
    mean: number;
    perParticle(): Float32Array | number[];
    free(): void;
  }
  export interface WasmRdfResult {
    binCenters(): Float32Array;
    rdf(): Float32Array;
    pairCounts(): Float32Array;
    readonly numPoints: number;
    readonly volume: number;
    free(): void;
  }
  export interface WasmTopologyRingInfo {
    readonly numRings: number;
    ringSizes(): Uint32Array | number[];
    atomRingMask(nAtoms: number): Uint8Array | number[];
    rings(): Uint32Array | number[];
    isAtomInRing(atomIdx: number): boolean;
    free(): void;
  }

  export class WasmArray {
    static from(data: ArrayLike<number>, shape?: ArrayLike<number>): WasmArray;
    toCopy(): Float32Array;
    free(): void;
  }

  export class Block {
    nrows(): number;
    keys(): string[];
    dtype(name: string): string | undefined;
    renameColumn(oldName: string, newName: string): boolean;
    viewColF(name: string): Float32Array;
    viewColI32(name: string): Int32Array;
    viewColU32(name: string): Uint32Array;
    copyColF(name: string): Float32Array;
    copyColU32(name: string): Uint32Array;
    copyColStr(name: string): string[];
    setColF(name: string, data: Float32Array, shape?: Uint32Array | null): void;
    setColI32(name: string, data: Int32Array): void;
    setColU32(name: string, data: Uint32Array): void;
    setColStr(name: string, data: string[]): void;
  }

  export class Box {
    static cube(
      a: number,
      origin: Float32Array,
      pbcx: boolean,
      pbcy: boolean,
      pbcz: boolean,
    ): Box;
    static ortho(
      lengths: Float32Array,
      origin: Float32Array,
      pbcx: boolean,
      pbcy: boolean,
      pbcz: boolean,
    ): Box;
    lengths(): WasmArray;
    origin(): WasmArray;
    get_corners(): WasmArray;
    wrapToBlock(coords: WasmArray, block: Block, prefix?: string): void;
  }

  export class UniformGridField {
    shape(): number[];
    origin(): WasmArray;
    cell(): WasmArray;
    pbc(): number[];
    values(): WasmArray;
    toPointCloudFrame(threshold: number, stride: number): Frame;
  }

  /**
   * A uniform spatial grid storing one or more named scalar arrays
   * (e.g. electron density, spin density).
   *
   * All arrays share the same spatial definition: grid dimensions [nx, ny, nz],
   * Cartesian origin, and cell matrix (columns are lattice vectors, matching
   * the VASP/molrs convention).
   */
  export class Grid {
    /**
     * Create a new empty grid.
     *
     * @param dim_x  Grid points along x.
     * @param dim_y  Grid points along y.
     * @param dim_z  Grid points along z.
     * @param origin Float32Array of length 3 — Cartesian origin in Ångström.
     * @param cell   Float32Array of length 9 — cell in column-major order:
     *               elements 0-2 are the first lattice vector (a),
     *               elements 3-5 are b, elements 6-8 are c.
     * @param pbc_x  Periodic along x.
     * @param pbc_y  Periodic along y.
     * @param pbc_z  Periodic along z.
     */
    constructor(
      dim_x: number,
      dim_y: number,
      dim_z: number,
      origin: Float32Array,
      cell: Float32Array,
      pbc_x: boolean,
      pbc_y: boolean,
      pbc_z: boolean,
    );

    /** Grid dimensions [nx, ny, nz]. */
    dim(): number[];

    /** Cartesian origin in Ångström as a WasmArray of length 3. */
    origin(): WasmArray;

    /**
     * Cell matrix as a WasmArray of length 9 in column-major order
     * (columns are lattice vectors, same convention as the constructor).
     */
    cell(): WasmArray;

    /** Periodic boundary flags: each element is 1 (periodic) or 0 (not periodic). */
    pbc(): number[];

    /** Total number of voxels: nx * ny * nz. */
    total(): number;

    /** Names of all scalar arrays stored in this grid. */
    arrayNames(): string[];

    /** Returns true if a named array is present. */
    hasArray(name: string): boolean;

    /** Number of named arrays stored. */
    len(): number;

    /** Returns true if no arrays are stored. */
    isEmpty(): boolean;

    /**
     * Retrieve a named scalar array as a flat WasmArray with shape [nx, ny, nz].
     * Returns undefined if the array does not exist.
     */
    getArray(name: string): WasmArray | undefined;

    /**
     * Insert (or replace) a named scalar array.
     *
     * @param name  Array name.
     * @param data  Float32Array of length `total()` in row-major (ix, iy, iz) order.
     * @throws if data.length !== total().
     */
    insertArray(name: string, data: Float32Array): void;

    free(): void;
  }

  export class Frame {
    constructor();
    getBlock(name: string): Block | undefined;
    createBlock(name: string): Block;
    insertBlock(name: string, block: Block): void;
    removeBlock(name: string): void;
    clear(): void;
    renameBlock(oldName: string, newName: string): boolean;
    renameColumn(block: string, oldName: string, newName: string): boolean;
    free(): void;
    drop(): void;
    fieldNames(): string[];
    hasField(name: string): boolean;
    getUniformGridField(name: string): UniformGridField | undefined;
    simbox?: Box;

    /** Names of all grids attached to this frame. */
    gridNames(): string[];

    /** Returns true if a named grid is attached to this frame. */
    hasGrid(name: string): boolean;

    /**
     * Retrieve a named grid (cloned).
     * Returns undefined if the grid does not exist.
     */
    getGrid(name: string): Grid | undefined;

    /**
     * Attach a grid to this frame under the given name.
     * The Grid object is consumed and should not be reused afterwards.
     */
    insertGrid(name: string, grid: Grid): void;

    /** Remove a named grid from this frame. */
    removeGrid(name: string): void;
  }

  export class XYZReader {
    constructor(content: string);
    read(index: number): Frame | undefined;
    len(): number;
    free(): void;
  }

  export class PDBReader {
    constructor(content: string);
    read(index: number): Frame | undefined;
    free(): void;
  }

  export class LAMMPSReader {
    constructor(content: string);
    read(index: number): Frame | undefined;
    free(): void;
  }

  export class MolRecReader {
    constructor(files: Map<string, Uint8Array>);
    countFrames(): number;
    countAtoms(): number;
    readFrame(index: number): Frame | undefined;
    free(): void;
  }

  export class Topology {
    static fromFrame(frame: Frame): Topology;
    readonly nAtoms: number;
    readonly nBonds: number;
    readonly nAngles: number;
    readonly nDihedrals: number;
    readonly nComponents: number;
    connectedComponents(): Int32Array;
    neighbors(atomIdx: number): Uint32Array;
    degree(atomIdx: number): number;
    angles(): Uint32Array;
    dihedrals(): Uint32Array;
    impropers(): Uint32Array;
    findRings(): TopologyRingInfo;
    free(): void;
  }
  export type TopologyRingInfo = WasmTopologyRingInfo;
  export class LinkedCell {
    constructor(rMax: number);
    build(frame: Frame): { free(): void };
    query(refFrame: Frame, queryFrame: Frame): { free(): void };
    free(): void;
  }
  export class Cluster {
    constructor(minClusterSize: number);
    compute(frame: Frame, nlist: { free(): void }): ClusterResult;
    free(): void;
  }
  export class ClusterResult {
    clusterIdx(): Int32Array;
    clusterSizes(): Uint32Array;
    readonly numClusters: number;
    free(): void;
  }
  export class CenterOfMass {
    constructor(masses?: Float32Array | null);
    compute(frame: Frame, clusterResult: ClusterResult): CenterOfMassResult;
    free(): void;
  }
  export type CenterOfMassResult = WasmCenterOfMassResult;
  export class ClusterCenters {
    compute(
      frame: Frame,
      clusterResult: ClusterResult,
    ): Float32Array | number[];
    free(): void;
  }
  export class GyrationTensor {
    compute(
      frame: Frame,
      clusterResult: ClusterResult,
    ): Float32Array | number[];
    free(): void;
  }
  export class InertiaTensor {
    constructor(masses?: Float32Array | null);
    compute(
      frame: Frame,
      clusterResult: ClusterResult,
    ): Float32Array | number[];
    free(): void;
  }
  export class RadiusOfGyration {
    constructor(masses?: Float32Array | null);
    compute(
      frame: Frame,
      clusterResult: ClusterResult,
    ): Float32Array | number[];
    free(): void;
  }
  export class MSD {
    readonly count: number;
    feed(frame: Frame): void;
    results(): MSDResult[];
    reset(): void;
    free(): void;
  }
  export type MSDResult = WasmMSDResult;
  export class RDF {
    constructor(nBins: number, rMax: number);
    compute(frame: Frame, nlist: { free(): void }): WasmRdfResult;
    free(): void;
  }
  export type SmilesIR = WasmObject;

  export function writeFrame(frame: Frame, format: string): string;
  export function parseSMILES(smiles: string): WasmObject;
  export function generate3D(input: WasmObject): Frame;
}
