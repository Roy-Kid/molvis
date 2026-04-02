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
    viewColF32(name: string): Float32Array;
    viewColI32(name: string): Int32Array;
    viewColU32(name: string): Uint32Array;
    copyColF32(name: string): Float32Array;
    copyColU32(name: string): Uint32Array;
    copyColStr(name: string): string[];
    setColF32(name: string, data: Float32Array): void;
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
