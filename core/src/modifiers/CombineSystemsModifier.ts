import { Block, Frame } from "@molcrafts/molrs";
import { BaseModifier, ModifierCapability } from "../pipeline/modifier";
import type { PipelineContext, ValidationResult } from "../pipeline/types";
import { applyTransform, superpose } from "../system/superposition";
import { DType } from "../utils/dtype";

/** Per-atom column injected by combine to mark which branch each atom came from. */
const SOURCE_ID = "source_id";

/**
 * Optional pre-concat structural superposition config. When `enabled`, every
 * non-reference branch is rigid-aligned onto the reference branch (Kabsch, via
 * the spec-01 kernel) before concatenation, so distinct structures overlay for
 * comparison instead of sitting in their original frames.
 */
export interface CombineAlignment {
  /** Master switch. Default false → branches concatenated in their own coords. */
  enabled: boolean;
  /** Id of the referenced branch held fixed; null → the first referenced branch. */
  referenceId: string | null;
  /** Mass-weight the fit + RMSD using a `mass` column when present. */
  massWeight: boolean;
  /** Restrict the fit to these atom indices (correspondence subset); null → all. */
  subset: Uint32Array | null;
}

/**
 * Combine two or more referenced branches into one frame by **atom-set
 * extension** (concatenation): all branches' atoms are stacked, bond indices
 * are offset per branch, and a per-atom Int32 `source_id` column records the
 * originating branch ordinal. Optionally superimposes each branch onto a chosen
 * reference branch first (see {@link CombineAlignment}).
 *
 * Branches are resolved from `context.frameCache` by `referencedIds` (the
 * reference edge from the pipeline). This modifier is topology-changing (it
 * changes the atom count), so a recompute routes through a full rebuild
 * (`DrawFrameCommand`) — never a position-only update.
 *
 * Coordinates/RMSD are in the frame's length unit (Å in MolVis).
 */
export class CombineSystemsModifier extends BaseModifier {
  /** Optional pre-concat alignment. Defaults to disabled. */
  public alignment: CombineAlignment = {
    enabled: false,
    referenceId: null,
    massWeight: false,
    subset: null,
  };

  /**
   * RMSD-to-reference per aligned branch (keyed by branch id), populated by the
   * last {@link apply} when alignment is on. Read-only output for the UI; the
   * reference branch itself is omitted.
   */
  public rmsdByBranch: Record<string, number> = {};

  constructor(id = "combine-systems-default") {
    super(id, "Combine Systems", new Set([ModifierCapability.TransformsData]));
  }

  getCacheKey(): string {
    const a = this.alignment;
    return `${this.id}:${this.enabled}:refs=[${this.referencedIds.join(",")}]:align=${a.enabled}:ref=${a.referenceId}:mw=${a.massWeight}:sub=${a.subset?.length ?? 0}`;
  }

  /** Resolved reference branch id (explicit, or the first referenced branch). */
  private referenceBranchId(): string {
    return this.alignment.referenceId ?? this.referencedIds[0];
  }

  validate(_input: Frame, context: PipelineContext): ValidationResult {
    if (this.referencedIds.length < 2) {
      return {
        valid: false,
        errors: ["Combine Systems needs at least 2 referenced branches"],
      };
    }
    for (const id of this.referencedIds) {
      const frame = context.frameCache.get(id);
      if (frame === undefined || frame.getBlock("atoms") === undefined) {
        return {
          valid: false,
          errors: [
            `Combine Systems: referenced branch '${id}' is not available in the frame cache`,
          ],
        };
      }
    }
    if (this.alignment.enabled && this.alignment.subset === null) {
      const refId = this.referenceBranchId();
      const refCount =
        context.frameCache.get(refId)?.getBlock("atoms")?.nrows() ?? 0;
      for (const id of this.referencedIds) {
        if (id === refId) continue;
        const count =
          context.frameCache.get(id)?.getBlock("atoms")?.nrows() ?? 0;
        if (count !== refCount) {
          return {
            valid: false,
            errors: [
              `Combine Systems: alignment requested but branch '${id}' atom count (${count}) differs from reference (${refCount}); provide a selection subset`,
            ],
          };
        }
      }
    }
    return { valid: true };
  }

  apply(input: Frame, context: PipelineContext): Frame {
    const validation = this.validate(input, context);
    if (!validation.valid) {
      throw new Error(
        validation.errors?.[0] ?? "Combine Systems: invalid configuration",
      );
    }

    const atomsBlocks = this.referencedIds.map((id) => {
      const block = context.frameCache.get(id)?.getBlock("atoms");
      if (block === undefined) {
        throw new Error(`Combine Systems: branch '${id}' has no atoms block`);
      }
      return block;
    });
    const counts = atomsBlocks.map((b) => b.nrows());
    const total = counts.reduce((sum, n) => sum + n, 0);

    // --- Optional alignment: transform each non-reference branch's coords. ---
    this.rmsdByBranch = {};
    const coordOverride: Array<Map<string, Float64Array> | null> =
      atomsBlocks.map(() => null);
    if (this.alignment.enabled) {
      const refId = this.referenceBranchId();
      const refIdx = this.referencedIds.indexOf(refId);
      const refCoords = packCoords(atomsBlocks[refIdx]);
      for (let k = 0; k < atomsBlocks.length; k++) {
        if (k === refIdx) continue;
        const moving = packCoords(atomsBlocks[k]);
        const options: { weights?: Float64Array; indices?: Uint32Array } = {};
        if (this.alignment.subset !== null) {
          options.indices = this.alignment.subset;
        }
        if (this.alignment.massWeight) {
          const weights = readMass(atomsBlocks[k]);
          if (weights !== null) options.weights = weights;
        }
        const { R, t, rmsd } = superpose(moving, refCoords, options);
        this.rmsdByBranch[this.referencedIds[k]] = rmsd;
        coordOverride[k] = unpackCoords(
          applyTransform(moving, R, t),
          counts[k],
        );
      }
    }

    // --- Concatenate atom columns (every branch's non-source_id columns). ---
    const newAtoms = new Block();
    const keys = atomsBlocks[0].keys().filter((key) => key !== SOURCE_ID);
    for (const key of keys) {
      concatColumn(newAtoms, key, atomsBlocks, counts, total, coordOverride);
    }

    // --- Synthetic source_id: per-atom branch ordinal (overwrites any input). ---
    const sourceIds = new Int32Array(total);
    let cursor = 0;
    for (let k = 0; k < counts.length; k++) {
      for (let i = 0; i < counts[k]; i++) sourceIds[cursor++] = k;
    }
    newAtoms.setColI32(SOURCE_ID, sourceIds);

    const result = new Frame();
    result.insertBlock("atoms", newAtoms);

    // --- Concatenate bonds, offsetting each branch's indices. ---
    const newBonds = concatBonds(this.referencedIds, context, counts);
    if (newBonds !== undefined) {
      result.insertBlock("bonds", newBonds);
    }

    // --- simbox: the aligned reference branch's box when aligning, else
    // branch 0's box. Never a union of branch boxes. ---
    const boxIdx = this.alignment.enabled
      ? this.referencedIds.indexOf(this.referenceBranchId())
      : 0;
    const box = context.frameCache.get(this.referencedIds[boxIdx])?.simbox;
    if (box !== undefined) {
      result.simbox = box;
    }

    return result;
  }
}

/** Pack a block's x/y/z columns into a flat `3N` `[x0,y0,z0,…]` buffer. */
function packCoords(block: Block): Float64Array {
  const n = block.nrows();
  const x = block.viewColF("x");
  const y = block.viewColF("y");
  const z = block.viewColF("z");
  if (!x || !y || !z) {
    throw new Error("Combine Systems: branch atoms block lacks x/y/z columns");
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
 * Concatenate one atoms column across all branches into `target`, honoring an
 * optional per-branch coordinate override (used for aligned x/y/z). Throws if a
 * branch is missing the column (the branches must share a column set).
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

function missingColumn(branchIndex: number, key: string): Error {
  return new Error(
    `Combine Systems: branch ${branchIndex} is missing column '${key}' present in branch 0`,
  );
}

/**
 * Concatenate bond blocks across branches, offsetting each branch's atomi/atomj
 * by the cumulative atom count of preceding branches. Returns undefined when no
 * branch carries bonds. Missing `order` values default to 1.
 */
function concatBonds(
  branchIds: string[],
  context: PipelineContext,
  counts: number[],
): Block | undefined {
  const atomi: number[] = [];
  const atomj: number[] = [];
  const order: number[] = [];
  let offset = 0;
  let any = false;

  for (let k = 0; k < branchIds.length; k++) {
    const bonds = context.frameCache.get(branchIds[k])?.getBlock("bonds");
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
