import type { Block, Frame } from "@molcrafts/molrs";

export type FrameUpdateKind = "position" | "bond" | "full";

export interface FrameTransitionDecision {
  kind: FrameUpdateKind;
  reasons: string[];
  stats: {
    atomCount: number;
    bondCount: number;
  };
}

function decision(
  kind: FrameUpdateKind,
  atomCount: number,
  bondCount: number,
  ...reasons: string[]
): FrameTransitionDecision {
  return {
    kind,
    reasons,
    stats: { atomCount, bondCount },
  };
}

function equalNumberArray(
  left: Float32Array | Uint32Array,
  right: Float32Array | Uint32Array,
): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function equalStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function compareOptionalStringColumns(
  leftAtoms: Block,
  rightAtoms: Block,
  column: "element" | "type",
): boolean {
  const leftHas = leftAtoms.dtype(column) !== undefined;
  const rightHas = rightAtoms.dtype(column) !== undefined;

  if (!leftHas && !rightHas) return true;
  if (!leftHas || !rightHas) return false;

  // Fast path: if row counts already differ (checked by caller), skip the
  // expensive WASM→JS string copy. Row-count equality is a prerequisite.
  // We still need to compare content, but only cross the WASM boundary
  // when the above structural checks pass.
  const left = leftAtoms.copyColStr(column);
  const right = rightAtoms.copyColStr(column);
  return equalStringArray(left, right);
}

function getBondOrder(
  orders: Uint32Array | null | undefined,
  index: number,
): number {
  return orders ? orders[index] : 1;
}

function hasSameBondTopology(leftBonds: Block, rightBonds: Block): boolean {
  const leftI = leftBonds.viewColU32("atomi");
  const leftJ = leftBonds.viewColU32("atomj");
  const rightI = rightBonds.viewColU32("atomi");
  const rightJ = rightBonds.viewColU32("atomj");

  if (!leftI || !leftJ || !rightI || !rightJ) {
    return false;
  }
  if (!equalNumberArray(leftI, rightI)) return false;
  if (!equalNumberArray(leftJ, rightJ)) return false;

  const leftOrder =
    leftBonds.dtype("order") === "u32"
      ? leftBonds.viewColU32("order")
      : undefined;
  const rightOrder =
    rightBonds.dtype("order") === "u32"
      ? rightBonds.viewColU32("order")
      : undefined;
  const count = leftBonds.nrows();

  for (let i = 0; i < count; i++) {
    if (getBondOrder(leftOrder, i) !== getBondOrder(rightOrder, i)) {
      return false;
    }
  }
  return true;
}

export function classifyFrameTransition(
  previous: Frame | null,
  next: Frame,
): FrameTransitionDecision {
  const nextAtoms = next.getBlock("atoms");
  const nextAtomCount = nextAtoms?.nrows() ?? 0;
  const nextBondCount = next.getBlock("bonds")?.nrows() ?? 0;

  if (!previous) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "No previous frame available",
    );
  }

  const prevAtoms = previous.getBlock("atoms");
  if (!prevAtoms || !nextAtoms) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "Atoms block is missing in previous or next frame",
    );
  }

  const prevAtomCount = prevAtoms.nrows();
  if (prevAtomCount !== nextAtomCount) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      `Atom count changed: ${prevAtomCount} -> ${nextAtomCount}`,
    );
  }

  if (!compareOptionalStringColumns(prevAtoms, nextAtoms, "element")) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "Atom element column changed",
    );
  }

  if (!compareOptionalStringColumns(prevAtoms, nextAtoms, "type")) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "Atom type column changed",
    );
  }

  const prevBonds = previous.getBlock("bonds");
  const nextBonds = next.getBlock("bonds");
  const prevHasBonds = !!prevBonds && prevBonds.nrows() > 0;
  const nextHasBonds = !!nextBonds && nextBonds.nrows() > 0;

  if (prevHasBonds !== nextHasBonds) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "Bond block presence changed",
    );
  }

  if (!prevHasBonds && !nextHasBonds) {
    return decision(
      "position",
      nextAtomCount,
      0,
      "No bonds in both frames; only positions can change",
    );
  }

  const prevBondCount = prevBonds?.nrows() ?? 0;
  if (prevBondCount !== nextBondCount) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      `Bond count changed: ${prevBondCount} -> ${nextBondCount}`,
    );
  }

  if (!prevBonds || !nextBonds) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "Bond block missing unexpectedly",
    );
  }

  if (!hasSameBondTopology(prevBonds, nextBonds)) {
    return decision(
      "bond",
      nextAtomCount,
      nextBondCount,
      "Bond topology/order changed while counts remained stable",
    );
  }

  return decision(
    "position",
    nextAtomCount,
    nextBondCount,
    "Topology unchanged; position-only update",
  );
}
