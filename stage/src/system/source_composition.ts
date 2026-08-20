import { Block, Box, Frame } from "@molcrafts/molvis-core/molrs";
import { BOND_TYPE_SINGLE, setBondTopology } from "../utils/bond_order";
import { type ColumnDType, DType, isFloatDtype } from "../utils/dtype";
import type { Trajectory } from "./trajectory";

const SOURCE_ID = "source_id";

export interface CompositionSource {
  id: string;
  trajectory: Trajectory;
  contributedBlocks?: ReadonlyArray<string>;
}

export interface CompositionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Length-1 sources broadcast; a multi-frame source may stack onto them.
 * Two multi-frame sources must share a length. Used by compose and by
 * file-augment (LAMMPS data + DCD in either order).
 */
export function compatibleAugmentLengths(
  existingCount: number | undefined,
  incomingCount: number,
): boolean {
  if (incomingCount <= 1) return true;
  if (existingCount === undefined || existingCount <= 1) return true;
  return existingCount === incomingCount;
}

export async function composeSources(
  sources: readonly CompositionSource[],
  frameIndex: number,
): Promise<Frame> {
  if (sources.length === 0) return new Frame();

  const frames = await resolveFrames(sources, frameIndex);
  if (sources.length === 1) return projectSource(sources[0], frames[0]);

  const composedBlocks = new Map<string, Block>();
  const blockFromBroadcast = new Map<string, boolean>();
  let atomCount: number | null = null;
  let composedBox: Box | undefined;
  let boxFromBroadcast = false;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const frame = frames[i];
    const broadcast = isBroadcastSource(source);
    for (const name of contributedNames(source, frame)) {
      const block = frame.getBlock(name);
      if (!block || block.nrows() === 0) continue;
      if (name === "atoms") {
        if (atomCount === null) {
          atomCount = block.nrows();
        } else if (block.nrows() !== atomCount) {
          throw new Error(
            `Source composition: source '${source.id}' contributes ${block.nrows()} atoms but the composed system has ${atomCount}; augment sources must share atom count`,
          );
        }
      }
      const existing = composedBlocks.get(name);
      if (existing) {
        if (existing.nrows() !== block.nrows()) {
          throw new Error(
            `Source composition: block '${name}' from source '${source.id}' has ${block.nrows()} rows but the composed block has ${existing.nrows()}; same-name augment blocks must align row-for-row`,
          );
        }
        const existingBroadcast = blockFromBroadcast.get(name) === true;
        composedBlocks.set(
          name,
          mergeBlocks(existing, block, {
            existingBroadcast,
            incomingBroadcast: broadcast,
            atoms: name === "atoms",
          }),
        );
        if (!broadcast) blockFromBroadcast.set(name, false);
      } else {
        composedBlocks.set(name, cloneBlock(block));
        blockFromBroadcast.set(name, broadcast);
      }
    }
    const box = frame.box;
    if (box !== undefined) {
      try {
        if (composedBox === undefined) {
          composedBox = cloneBox(box);
          boxFromBroadcast = broadcast;
        } else if (!broadcast && boxFromBroadcast) {
          composedBox.free();
          composedBox = cloneBox(box);
          boxFromBroadcast = false;
        }
      } finally {
        box.free();
      }
    }
  }

  const result = new Frame();
  for (const [name, block] of composedBlocks) {
    result.insertBlock(name, block);
  }
  if (composedBox !== undefined) result.box = composedBox;

  return result;
}

export async function validateSourceComposition(
  sources: readonly CompositionSource[],
  frameIndex = 0,
): Promise<CompositionValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    await composeSources(sources, frameIndex);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function extendFrames(frames: readonly Frame[]): Frame {
  if (frames.length === 0) return new Frame();

  const atomBlocks = frames.map((frame, index) => {
    const block = frame.getBlock("atoms");
    if (!block) {
      throw new Error(
        `Loader extend: source ${index} has no atoms block and cannot be concatenated`,
      );
    }
    return block;
  });
  const counts = atomBlocks.map((block) => block.nrows());
  const total = counts.reduce((sum, count) => sum + count, 0);
  const outAtoms = new Block();

  const atomKeys = new Map<string, ColumnDType>();
  for (const block of atomBlocks) {
    for (const key of block.keys()) {
      if (key === SOURCE_ID || atomKeys.has(key)) continue;
      const dtype = block.dtype(key);
      if (isColumnDType(dtype)) atomKeys.set(key, dtype);
    }
  }

  for (const [key, dtype] of atomKeys) {
    if (key === SOURCE_ID) continue;
    concatColumn(outAtoms, key, dtype, atomBlocks, counts, total);
  }

  const sourceIds = new Int32Array(total);
  let cursor = 0;
  for (let sourceIndex = 0; sourceIndex < counts.length; sourceIndex++) {
    for (let i = 0; i < counts[sourceIndex]; i++) {
      sourceIds[cursor++] = sourceIndex;
    }
  }
  outAtoms.setColI32(SOURCE_ID, sourceIds);

  const result = new Frame();
  result.insertBlock("atoms", outAtoms);

  const bonds = concatBonds(frames, counts);
  if (bonds) result.insertBlock("bonds", bonds);
  copyBox(result, frames[0]);
  return result;
}

export async function extendSourcesToTrajectory(
  sources: readonly CompositionSource[],
): Promise<Trajectory> {
  const { Trajectory } = await import("./trajectory");
  if (sources.length === 0) return new Trajectory([new Frame()]);
  const maxLength = timelineLength(sources);
  const frames: Frame[] = [];
  const boxes = [];
  for (let frameIndex = 0; frameIndex < maxLength; frameIndex++) {
    const sourceFrames = await resolveFrames(sources, frameIndex);
    const frame = extendFrames(sourceFrames);
    frames.push(frame);
    boxes.push(frame.box);
  }
  return new Trajectory(frames, boxes);
}

function sourcePlayableLength(source: CompositionSource): number {
  const known = source.trajectory.length;
  if (typeof known === "number") return known;
  return source.trajectory.indexedLength;
}

function isBroadcastSource(source: CompositionSource): boolean {
  return sourcePlayableLength(source) <= 1;
}

function timelineLength(sources: readonly CompositionSource[]): number {
  return sources.reduce(
    (max, source) => Math.max(max, source.trajectory.indexedLength),
    0,
  );
}

/**
 * Frame-index policy for multi-source compose (product: **timeline-aligned**).
 *
 * - length-1 sources **broadcast** (every scrub index uses that single frame);
 * - multi-frame sources must match `max(source.lengths)` exactly;
 * - unequal multi-frame lengths throw (not silent clamp).
 *
 * Loader **extend** (concat atoms) is a separate path ({@link extendFrames}).
 */
async function resolveFrames(
  sources: readonly CompositionSource[],
  frameIndex: number,
): Promise<Frame[]> {
  const maxLength = timelineLength(sources);
  return Promise.all(
    sources.map((source) => {
      const length = sourcePlayableLength(source);
      if (length <= 1) return source.trajectory.frame(0);
      if (length === maxLength) return source.trajectory.frame(frameIndex);
      throw new Error(
        `Source composition: source '${source.id}' has ${length} frames but the timeline has ${maxLength}; only length-1 broadcast sources or length-${maxLength} sources can be combined`,
      );
    }),
  );
}

function contributedNames(source: CompositionSource, frame: Frame): string[] {
  const declared = source.contributedBlocks;
  if (declared && declared.length > 0) {
    return declared.filter((name) => frame.getBlock(name) !== undefined);
  }
  return frame.blockNames();
}

function projectSource(source: CompositionSource, frame: Frame): Frame {
  const result = new Frame();
  for (const name of contributedNames(source, frame)) {
    const block = frame.getBlock(name);
    if (block && block.nrows() > 0) result.insertBlock(name, cloneBlock(block));
  }
  copyBox(result, frame);
  return result;
}

function cloneBlock(source: Block): Block {
  const cloned = new Block();
  for (const key of source.keys()) copyColumn(cloned, key, source);
  // Column insertion defaults every block back to a one-dimensional shape.
  // Volumetric grids must retain their explicit [nx, ny, nz] geometry across
  // the data-source composition boundary or isosurface rendering becomes a
  // silent no-op.
  cloned.setShape(new Uint32Array(source.shape()));
  return cloned;
}

function copyBox(target: Frame, source: Frame): void {
  const box = source.box;
  if (box === undefined) return;
  try {
    target.box = cloneBox(box);
  } finally {
    box.free();
  }
}

function cloneBox(source: Box): Box {
  const hColMajor = copyAndFreeWasmArray(source.hMatrix());
  const origin = copyAndFreeWasmArray(source.origin());
  const pbc = source.pbc();
  const hRowMajor = new Float64Array([
    hColMajor[0],
    hColMajor[3],
    hColMajor[6],
    hColMajor[1],
    hColMajor[4],
    hColMajor[7],
    hColMajor[2],
    hColMajor[5],
    hColMajor[8],
  ]);
  return new Box(hRowMajor, origin, pbc[0] !== 0, pbc[1] !== 0, pbc[2] !== 0);
}

function copyAndFreeWasmArray(array: {
  toCopy(): Float64Array;
  free(): void;
}): Float64Array {
  try {
    return array.toCopy();
  } finally {
    array.free();
  }
}

function concatColumn(
  target: Block,
  key: string,
  dtype: ColumnDType,
  blocks: readonly Block[],
  counts: readonly number[],
  total: number,
): void {
  if (dtype === DType.String) {
    const dst: string[] = [];
    for (let sourceIndex = 0; sourceIndex < blocks.length; sourceIndex++) {
      assertCompatibleDType(blocks[sourceIndex], sourceIndex, key, dtype);
      const src =
        blocks[sourceIndex].dtype(key) === DType.String
          ? blocks[sourceIndex].copyColStr(key)
          : undefined;
      for (let i = 0; i < counts[sourceIndex]; i++) dst.push(src?.[i] ?? "");
    }
    target.setColStr(key, dst);
  } else if (isFloatDtype(dtype)) {
    const dst = new Float64Array(total);
    let offset = 0;
    for (let sourceIndex = 0; sourceIndex < blocks.length; sourceIndex++) {
      assertCompatibleDType(blocks[sourceIndex], sourceIndex, key, dtype);
      const src = blocks[sourceIndex].viewColF(key);
      if (src) {
        dst.set(src, offset);
      } else if (isCoordinateColumn(key)) {
        throw missingColumn(sourceIndex, key);
      }
      offset += counts[sourceIndex];
    }
    target.setColF(key, dst);
  } else if (dtype === DType.U32) {
    const dst = new Uint32Array(total);
    let offset = 0;
    for (let sourceIndex = 0; sourceIndex < blocks.length; sourceIndex++) {
      assertCompatibleDType(blocks[sourceIndex], sourceIndex, key, dtype);
      const src = blocks[sourceIndex].viewColU32(key);
      if (src) dst.set(src, offset);
      offset += counts[sourceIndex];
    }
    target.setColU32(key, dst);
  } else if (dtype === DType.I32) {
    const dst = new Int32Array(total);
    let offset = 0;
    for (let sourceIndex = 0; sourceIndex < blocks.length; sourceIndex++) {
      assertCompatibleDType(blocks[sourceIndex], sourceIndex, key, dtype);
      const src = blocks[sourceIndex].viewColI32(key);
      if (src) dst.set(src, offset);
      offset += counts[sourceIndex];
    }
    target.setColI32(key, dst);
  }
}

function mergeBlocks(
  existing: Block,
  incoming: Block,
  opts?: {
    existingBroadcast: boolean;
    incomingBroadcast: boolean;
    atoms: boolean;
  },
): Block {
  const mixed =
    opts !== undefined && opts.existingBroadcast !== opts.incomingBroadcast;
  if (mixed && opts.atoms) {
    return mergeAtomTopologyAndTrajectory(
      existing,
      incoming,
      opts.incomingBroadcast,
    );
  }
  const merged = new Block();
  const incomingKeys = new Set(incoming.keys());
  for (const key of existing.keys()) {
    if (!incomingKeys.has(key)) copyColumn(merged, key, existing);
  }
  for (const key of incoming.keys()) {
    copyColumn(merged, key, incoming);
  }
  applyMergedShape(merged, existing, incoming);
  return merged;
}

/** Coords from the time-varying source; identity / topology from the length-1 source. */
function mergeAtomTopologyAndTrajectory(
  existing: Block,
  incoming: Block,
  incomingBroadcast: boolean,
): Block {
  const topology = incomingBroadcast ? incoming : existing;
  const trajectory = incomingBroadcast ? existing : incoming;
  const alignedTraj = AtomIdAlignment.between(topology, trajectory).apply(
    trajectory,
  );
  const merged = new Block();
  const keys = new Set([...existing.keys(), ...incoming.keys()]);
  for (const key of keys) {
    const prefer = isTimeVaryingAtomColumn(key) ? alignedTraj : topology;
    const fallback = prefer === alignedTraj ? topology : alignedTraj;
    if (columnPresent(prefer, key)) copyColumn(merged, key, prefer);
    else if (columnPresent(fallback, key)) copyColumn(merged, key, fallback);
  }
  applyMergedShape(merged, existing, incoming);
  return merged;
}

/**
 * Map trajectory atom rows onto topology rows by `id`.
 *
 * LAMMPS `write_data` keeps file order (ids are a permutation). DCD/XTC/TRR
 * write coordinates in increasing atom-id order and stamp `id` = 1..N.
 * Overlaying xyz by row leaves bonds (row indices into the data file)
 * pointing at the wrong atoms — the topology looks exploded.
 */
class AtomIdAlignment {
  private constructor(private readonly srcOfDest: Int32Array | null) {}

  static between(topology: Block, trajectory: Block): AtomIdAlignment {
    const topoIds = atomIdColumn(topology);
    if (!topoIds) return new AtomIdAlignment(null);
    const n = topology.nrows();
    const trajIds = atomIdColumn(trajectory);
    const destOfSrc = new Int32Array(n);
    const topoRowById = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const id = Number(topoIds[i]);
      if (topoRowById.has(id)) {
        throw new Error(`Source composition: duplicate atom id ${id}`);
      }
      topoRowById.set(id, i);
    }
    if (trajIds) {
      if (trajIds.length !== n) {
        throw new Error(
          `Source composition: trajectory has ${trajIds.length} atom ids but topology has ${n}`,
        );
      }
      for (let src = 0; src < n; src++) {
        const dest = topoRowById.get(Number(trajIds[src]));
        if (dest === undefined) {
          throw new Error(
            `Source composition: trajectory atom id ${Number(trajIds[src])} is missing from the topology`,
          );
        }
        destOfSrc[src] = dest;
      }
    } else {
      const order = Array.from({ length: n }, (_, i) => i);
      order.sort((a, b) => Number(topoIds[a]) - Number(topoIds[b]));
      for (let rank = 0; rank < n; rank++) destOfSrc[rank] = order[rank];
    }
    const srcOfDest = new Int32Array(n);
    srcOfDest.fill(-1);
    for (let src = 0; src < n; src++) {
      const dest = destOfSrc[src];
      if (dest < 0 || dest >= n || srcOfDest[dest] !== -1) {
        throw new Error(
          "Source composition: atom id alignment is not a permutation",
        );
      }
      srcOfDest[dest] = src;
    }
    for (let i = 0; i < n; i++) {
      if (srcOfDest[i] !== i) return new AtomIdAlignment(srcOfDest);
    }
    return new AtomIdAlignment(null);
  }

  apply(block: Block): Block {
    if (!this.srcOfDest) return block;
    return permuteAtomRows(block, this.srcOfDest);
  }
}

function atomIdColumn(block: Block): ArrayLike<number> | null {
  const dtype = block.dtype("id");
  if (dtype === DType.U32) return block.viewColU32("id");
  if (dtype === DType.I32) return block.viewColI32("id");
  return null;
}

function permuteAtomRows(block: Block, srcOfDest: Int32Array): Block {
  const n = srcOfDest.length;
  const out = new Block();
  for (const key of block.keys()) {
    const dtype = block.dtype(key);
    if (dtype === DType.String) {
      const src = block.copyColStr(key) ?? [];
      const dst = new Array<string>(n);
      for (let i = 0; i < n; i++) dst[i] = src[srcOfDest[i]] ?? "";
      out.setColStr(key, dst);
    } else if (isFloatDtype(dtype)) {
      const src = block.viewColF(key);
      if (!src) continue;
      const dst = new Float64Array(n);
      for (let i = 0; i < n; i++) dst[i] = src[srcOfDest[i]];
      out.setColF(key, dst);
    } else if (dtype === DType.U32) {
      const src = block.viewColU32(key);
      if (!src) continue;
      const dst = new Uint32Array(n);
      for (let i = 0; i < n; i++) dst[i] = src[srcOfDest[i]];
      out.setColU32(key, dst);
    } else if (dtype === DType.I32) {
      const src = block.viewColI32(key);
      if (!src) continue;
      const dst = new Int32Array(n);
      for (let i = 0; i < n; i++) dst[i] = src[srcOfDest[i]];
      out.setColI32(key, dst);
    }
  }
  out.setShape(new Uint32Array(block.shape()));
  return out;
}

function columnPresent(block: Block, key: string): boolean {
  return block.dtype(key) !== undefined;
}

function applyMergedShape(
  merged: Block,
  existing: Block,
  incoming: Block,
): void {
  const incomingShape = incoming.shape();
  const existingShape = existing.shape();
  const sameShape =
    incomingShape.length === existingShape.length &&
    Array.from(incomingShape).every(
      (dimension, index) => dimension === existingShape[index],
    );
  if (!sameShape) {
    throw new Error(
      `Source composition: aligned blocks have incompatible shapes [${Array.from(existingShape)}] and [${Array.from(incomingShape)}]`,
    );
  }
  merged.setShape(new Uint32Array(incomingShape));
}

function isTimeVaryingAtomColumn(key: string): boolean {
  return (
    isCoordinateColumn(key) ||
    key === "vx" ||
    key === "vy" ||
    key === "vz" ||
    key === "fx" ||
    key === "fy" ||
    key === "fz" ||
    key === "xu" ||
    key === "yu" ||
    key === "zu"
  );
}

function copyColumn(target: Block, key: string, source: Block): void {
  const dtype = source.dtype(key);
  if (dtype === DType.String) {
    target.setColStr(key, source.copyColStr(key) ?? []);
  } else if (isFloatDtype(dtype)) {
    const src = source.viewColF(key);
    if (src) target.setColF(key, new Float64Array(src));
  } else if (dtype === DType.U32) {
    const src = source.viewColU32(key);
    if (src) target.setColU32(key, new Uint32Array(src));
  } else if (dtype === DType.I32) {
    const src = source.viewColI32(key);
    if (src) target.setColI32(key, new Int32Array(src));
  }
}

function assertCompatibleDType(
  block: Block,
  sourceIndex: number,
  key: string,
  expected: ColumnDType,
): void {
  const actual = block.dtype(key);
  if (actual !== undefined && actual !== expected) {
    throw new Error(
      `Loader extend: source ${sourceIndex} atom column '${key}' has dtype '${actual}' but expected '${expected}'`,
    );
  }
}

function isCoordinateColumn(key: string): boolean {
  return key === "x" || key === "y" || key === "z";
}

function isColumnDType(dtype: string | undefined): dtype is ColumnDType {
  return (
    dtype === DType.String ||
    isFloatDtype(dtype) ||
    dtype === DType.U32 ||
    dtype === DType.I32
  );
}

function missingColumn(sourceIndex: number, key: string): Error {
  return new Error(
    `Loader extend: source ${sourceIndex} is missing atom column '${key}' present in source 0`,
  );
}

function concatBonds(
  frames: readonly Frame[],
  counts: readonly number[],
): Block | undefined {
  const atomi: number[] = [];
  const atomj: number[] = [];
  const bondType: number[] = [];
  const bondNumber: number[] = [];
  let offset = 0;
  let any = false;

  for (let sourceIndex = 0; sourceIndex < frames.length; sourceIndex++) {
    const bonds = frames[sourceIndex].getBlock("bonds");
    if (bonds) {
      const iCol = bonds.viewColU32("atomi");
      const jCol = bonds.viewColU32("atomj");
      const typeCol = bonds.dtype("bond_type")
        ? bonds.viewColU32("bond_type")
        : undefined;
      const numberCol = bonds.dtype("bond_number")
        ? bonds.viewColU32("bond_number")
        : undefined;
      if (iCol && jCol) {
        any = true;
        for (let row = 0; row < bonds.nrows(); row++) {
          atomi.push(iCol[row] + offset);
          atomj.push(jCol[row] + offset);
          const t = typeCol?.[row] ?? BOND_TYPE_SINGLE;
          bondType.push(t);
          bondNumber.push(numberCol?.[row] ?? t);
        }
      }
    }
    offset += counts[sourceIndex];
  }

  if (!any) return undefined;
  const block = new Block();
  setBondTopology(
    block,
    Uint32Array.from(atomi),
    Uint32Array.from(atomj),
    Uint32Array.from(bondType),
    Uint32Array.from(bondNumber),
  );
  return block;
}
