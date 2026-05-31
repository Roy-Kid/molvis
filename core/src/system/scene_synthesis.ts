import { Block, Frame } from "@molcrafts/molrs";
import { DType } from "../utils/dtype";
import { applyTransform, superpose } from "./superposition";
import type { Trajectory } from "./trajectory";

/** Per-atom Int32 column marking which source each atom came from. */
const SOURCE_ID = "source_id";

/** A source feeding the synthesis step: an id + the trajectory it owns. */
export interface SynthesisSource {
  id: string;
  trajectory: Trajectory;
  /**
   * Optional narrowing filter for `augment` / single-source passthrough: when
   * non-empty, only these block names are contributed (e.g. `["bonds"]` for a
   * topology-only file). Empty / omitted contributes every block the resolved
   * frame carries. Has no effect on `extend` (which concatenates atoms by
   * definition). 0-row blocks are always skipped so an empty placeholder never
   * shadows a real block under last-wins.
   */
  contributedBlocks?: ReadonlyArray<string>;
}

/** Optional pre-concat structural superposition (extend mode only). */
export interface SynthesisAlignment {
  /** Master switch. */
  enabled: boolean;
  /** Mass-weight the fit + RMSD using a `mass` column when present. */
  massWeight: boolean;
  /** Restrict the fit to these atom indices; null → identity 1:1 map. */
  subset: Uint32Array | null;
}

/** Configuration for {@link synthesize}. */
export interface SceneSynthesisConfig {
  /** `extend` = concat distinct molecules (+ source_id); `augment` = block union last-wins. */
  mode: "extend" | "augment";
  /** Id of the reference source held fixed for alignment; null → first source. */
  referenceId: string | null;
  /** Optional pre-concat Kabsch alignment; null → off. */
  alignment: SynthesisAlignment | null;
}

/**
 * Compose multiple source trajectories into one merged {@link Frame} at the
 * given timeline index. Pure: never mutates the input frames/trajectories.
 *
 * Frame-count reconciliation per source: a length-1 trajectory broadcasts its
 * single frame to every index; a trajectory whose length equals the timeline
 * max is sampled at `frameIndex`; any other length > 1 throws.
 *
 * - `extend`: atom-set extension — concatenate all sources' atoms (bond indices
 *   offset per source), inject a per-atom Int32 `source_id` ordinal. Optionally
 *   Kabsch-aligns each non-reference source onto the reference first; per-source
 *   RMSD is exposed on the result via numeric meta `synthesis_rmsd:<id>`.
 * - `augment`: union each source's blocks (honoring `contributedBlocks` and
 *   skipping 0-row blocks), last-wins on block-name conflict.
 * - single source: fresh-frame passthrough of `frame(frameIndex)` (no
 *   `source_id`), filtered by `contributedBlocks` when the source declares one.
 *
 * Coordinates / RMSD are in the frame's length unit (Å in MolVis).
 */
export async function synthesize(
  sources: SynthesisSource[],
  frameIndex: number,
  config: SceneSynthesisConfig,
): Promise<Frame> {
  if (sources.length === 0) return new Frame();

  const frames = await resolveFrames(sources, frameIndex);

  // Single source → fresh-frame passthrough (no source_id). project() returns a
  // NEW Frame holding the source's (Arc-shared) blocks: with a contributedBlocks
  // filter it narrows; without one it copies every non-empty block. The fresh
  // wrapper keeps the pipeline's working frame a distinct object from the
  // DataSource's stored trajectory frame, so a downstream modifier never mutates
  // the source's frame through it.
  if (sources.length === 1) return project(sources[0], frames[0]);

  if (config.mode === "augment") return augment(sources, frames);
  return extend(sources, frames, config);
}

/**
 * The block names a source contributes from its resolved frame: its declared
 * `contributedBlocks` (intersected with what the frame actually has) when set,
 * else every block on the frame.
 */
function contributedNames(source: SynthesisSource, frame: Frame): string[] {
  const declared = source.contributedBlocks;
  if (declared && declared.length > 0) {
    return declared.filter((name) => frame.getBlock(name) !== undefined);
  }
  return frame.blockNames();
}

/**
 * Project a single resolved frame into a fresh {@link Frame} holding its
 * contributed, non-empty blocks (Arc-shared) plus simbox. Backs the
 * single-source passthrough — narrowing when `contributedBlocks` is set, a
 * straight non-empty-block copy otherwise; the multi-source path inlines the
 * same rule in {@link augment}.
 */
function project(source: SynthesisSource, frame: Frame): Frame {
  const result = new Frame();
  for (const name of contributedNames(source, frame)) {
    const block = frame.getBlock(name);
    if (block !== undefined && block.nrows() > 0)
      result.insertBlock(name, block);
  }
  if (frame.simbox !== undefined) result.simbox = frame.simbox;
  return result;
}

/**
 * Resolve each source's contributing frame at `frameIndex`, broadcasting
 * length-1 trajectories and erroring on any length > 1 that doesn't match the
 * timeline max.
 */
async function resolveFrames(
  sources: SynthesisSource[],
  frameIndex: number,
): Promise<Frame[]> {
  const maxLength = sources.reduce(
    (m, s) => Math.max(m, s.trajectory.length),
    0,
  );
  return Promise.all(
    sources.map((s) => {
      const len = s.trajectory.length;
      if (len === 1) return s.trajectory.frame(0);
      if (len === maxLength) return s.trajectory.frame(frameIndex);
      throw new Error(
        `Scene synthesis: source '${s.id}' has ${len} frames but the timeline has ${maxLength}; only length-1 (broadcast) or length-${maxLength} sources can be combined`,
      );
    }),
  );
}

/**
 * Union each source's blocks into one frame, last source wins on conflict.
 * Honors each source's `contributedBlocks` filter and skips 0-row blocks so an
 * empty placeholder (e.g. a topology-only source's empty `atoms`) never shadows
 * a real block from another source.
 */
function augment(sources: SynthesisSource[], frames: Frame[]): Frame {
  const result = new Frame();
  for (let k = 0; k < frames.length; k++) {
    const frame = frames[k];
    for (const name of contributedNames(sources[k], frame)) {
      const block = frame.getBlock(name);
      if (block !== undefined && block.nrows() > 0) {
        result.insertBlock(name, block);
      }
    }
    if (frame.simbox !== undefined) result.simbox = frame.simbox;
  }
  return result;
}

/** Atom-set extension: concat atoms (+ source_id), offset bonds, optional align. */
function extend(
  sources: SynthesisSource[],
  frames: Frame[],
  config: SceneSynthesisConfig,
): Frame {
  const atomsBlocks = frames.map((f, k) => {
    const block = f.getBlock("atoms");
    if (block === undefined) {
      throw new Error(
        `Scene synthesis: source '${sources[k].id}' has no atoms block`,
      );
    }
    return block;
  });
  const counts = atomsBlocks.map((b) => b.nrows());
  const total = counts.reduce((sum, n) => sum + n, 0);

  // Reference source: explicit referenceId, else source 0. Drives both the
  // alignment fit target and which source's simbox the merged frame inherits.
  const refId = config.referenceId ?? sources[0].id;
  const refIdx = Math.max(
    0,
    sources.findIndex((s) => s.id === refId),
  );

  // Optional pre-concat Kabsch alignment of each non-reference source.
  const coordOverride: Array<Map<string, Float64Array> | null> =
    atomsBlocks.map(() => null);
  const rmsdById = new Map<string, number>();
  if (config.alignment?.enabled) {
    const refCoords = packCoords(atomsBlocks[refIdx]);
    for (let k = 0; k < atomsBlocks.length; k++) {
      if (k === refIdx) continue;
      if (config.alignment.subset === null && counts[k] !== counts[refIdx]) {
        throw new Error(
          `Scene synthesis: alignment requested but source '${sources[k].id}' atom count (${counts[k]}) differs from reference (${counts[refIdx]}); provide a selection subset`,
        );
      }
      const moving = packCoords(atomsBlocks[k]);
      const options: { weights?: Float64Array; indices?: Uint32Array } = {};
      if (config.alignment.subset !== null)
        options.indices = config.alignment.subset;
      if (config.alignment.massWeight) {
        const weights = readMass(atomsBlocks[k]);
        if (weights !== null) options.weights = weights;
      }
      const { R, t, rmsd } = superpose(moving, refCoords, options);
      rmsdById.set(sources[k].id, rmsd);
      coordOverride[k] = unpackCoords(applyTransform(moving, R, t), counts[k]);
    }
  }

  // Concatenate atom columns (every source's non-source_id columns).
  const newAtoms = new Block();
  for (const key of atomsBlocks[0].keys()) {
    if (key === SOURCE_ID) continue;
    concatColumn(newAtoms, key, atomsBlocks, counts, total, coordOverride);
  }

  // Synthetic source_id ordinals.
  const sourceIds = new Int32Array(total);
  let cursor = 0;
  for (let k = 0; k < counts.length; k++) {
    for (let i = 0; i < counts[k]; i++) sourceIds[cursor++] = k;
  }
  newAtoms.setColI32(SOURCE_ID, sourceIds);

  const result = new Frame();
  result.insertBlock("atoms", newAtoms);

  const newBonds = concatBonds(frames, counts);
  if (newBonds !== undefined) result.insertBlock("bonds", newBonds);

  // simbox: reference source when aligning, else source 0. Never unioned.
  const box = frames[config.alignment?.enabled ? refIdx : 0].simbox;
  if (box !== undefined) result.simbox = box;

  // Expose per-source RMSD as numeric meta keyed per source.
  for (const [id, rmsd] of rmsdById) {
    result.setMeta(`synthesis_rmsd:${id}`, String(rmsd));
  }

  return result;
}

/** Pack a block's x/y/z columns into a flat `3N` `[x0,y0,z0,…]` buffer. */
function packCoords(block: Block): Float64Array {
  const n = block.nrows();
  const x = block.viewColF("x");
  const y = block.viewColF("y");
  const z = block.viewColF("z");
  if (!x || !y || !z) {
    throw new Error("Scene synthesis: source atoms block lacks x/y/z columns");
  }
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[3 * i] = x[i];
    out[3 * i + 1] = y[i];
    out[3 * i + 2] = z[i];
  }
  return out;
}

/** Split a flat `3N` buffer back into separate x/y/z column arrays. */
function unpackCoords(
  coords: Float64Array,
  n: number,
): Map<string, Float64Array> {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = coords[3 * i];
    y[i] = coords[3 * i + 1];
    z[i] = coords[3 * i + 2];
  }
  return new Map([
    ["x", x],
    ["y", y],
    ["z", z],
  ]);
}

/** Read a `mass` F64 column, or null if the block has none. */
function readMass(block: Block): Float64Array | null {
  if (block.dtype("mass") !== DType.F64) return null;
  const mass = block.viewColF("mass");
  return mass ? Float64Array.from(mass) : null;
}

/**
 * Concatenate one atoms column across all sources into `target`, honoring an
 * optional per-source coordinate override (used for aligned x/y/z). Throws if a
 * source is missing the column (sources must share a column set).
 */
function concatColumn(
  target: Block,
  key: string,
  blocks: Block[],
  counts: number[],
  total: number,
  coordOverride: Array<Map<string, Float64Array> | null>,
): void {
  const dtype = blocks[0].dtype(key);
  if (dtype === DType.String) {
    const dst: string[] = [];
    for (let k = 0; k < blocks.length; k++) {
      const src = blocks[k].copyColStr(key);
      if (!src) throw missingColumn(k, key);
      for (let i = 0; i < counts[k]; i++) dst.push(src[i]);
    }
    target.setColStr(key, dst);
  } else if (dtype === DType.F64) {
    const dst = new Float64Array(total);
    let ptr = 0;
    for (let k = 0; k < blocks.length; k++) {
      const src = coordOverride[k]?.get(key) ?? blocks[k].viewColF(key);
      if (!src) throw missingColumn(k, key);
      for (let i = 0; i < counts[k]; i++) dst[ptr++] = src[i];
    }
    target.setColF(key, dst);
  } else if (dtype === DType.U32) {
    const dst = new Uint32Array(total);
    let ptr = 0;
    for (let k = 0; k < blocks.length; k++) {
      const src = blocks[k].viewColU32(key);
      if (!src) throw missingColumn(k, key);
      for (let i = 0; i < counts[k]; i++) dst[ptr++] = src[i];
    }
    target.setColU32(key, dst);
  } else if (dtype === DType.I32) {
    const dst = new Int32Array(total);
    let ptr = 0;
    for (let k = 0; k < blocks.length; k++) {
      const src = blocks[k].viewColI32(key);
      if (!src) throw missingColumn(k, key);
      for (let i = 0; i < counts[k]; i++) dst[ptr++] = src[i];
    }
    target.setColI32(key, dst);
  }
}

function missingColumn(sourceIndex: number, key: string): Error {
  return new Error(
    `Scene synthesis: source ${sourceIndex} is missing column '${key}' present in source 0`,
  );
}

/**
 * Concatenate bond blocks across sources, offsetting each source's atomi/atomj
 * by the cumulative atom count of preceding sources. Returns undefined when no
 * source carries bonds. Missing `order` values default to 1.
 */
function concatBonds(frames: Frame[], counts: number[]): Block | undefined {
  const atomi: number[] = [];
  const atomj: number[] = [];
  const order: number[] = [];
  let offset = 0;
  let any = false;

  for (let k = 0; k < frames.length; k++) {
    const bonds = frames[k].getBlock("bonds");
    if (bonds !== undefined) {
      const iCol = bonds.viewColU32("atomi");
      const jCol = bonds.viewColU32("atomj");
      const orderCol =
        bonds.dtype("order") === DType.U32
          ? bonds.viewColU32("order")
          : undefined;
      if (iCol && jCol) {
        any = true;
        for (let b = 0; b < bonds.nrows(); b++) {
          atomi.push(iCol[b] + offset);
          atomj.push(jCol[b] + offset);
          order.push(orderCol ? orderCol[b] : 1);
        }
      }
    }
    offset += counts[k];
  }

  if (!any) return undefined;
  const block = new Block();
  block.setColU32("atomi", Uint32Array.from(atomi));
  block.setColU32("atomj", Uint32Array.from(atomj));
  block.setColU32("order", Uint32Array.from(order));
  return block;
}
