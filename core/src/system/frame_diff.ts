import type { Block, Frame } from "@molcrafts/molrs";
import { DType } from "../utils/dtype";

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

function compareOptionalElement(leftAtoms: Block, rightAtoms: Block): boolean {
  // Canonical identity column is `element: String`. LAMMPS data/dump without
  // element simply have no identity column — both sides missing is "equal".
  const leftHas = leftAtoms.dtype("element") === DType.String;
  const rightHas = rightAtoms.dtype("element") === DType.String;
  if (!leftHas && !rightHas) return true;
  if (!leftHas || !rightHas) return false;
  const left = leftAtoms.copyColStr("element");
  const right = rightAtoms.copyColStr("element");
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
    leftBonds.dtype("order") === DType.U32
      ? leftBonds.viewColU32("order")
      : undefined;
  const rightOrder =
    rightBonds.dtype("order") === DType.U32
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

  if (!compareOptionalElement(prevAtoms, nextAtoms)) {
    return decision(
      "full",
      nextAtomCount,
      nextBondCount,
      "Atom element column changed",
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
