import type { MoleculeGraph } from "../molecule_graph";
import { atomLabelWidth } from "../style/atom_label";
import type { Atom2D } from "../types";

/**
 * What the pointer is over on the 2D board, right now.
 *
 * A hit is transient and singular — hover, the target a click would act on,
 * what a context menu is about. It is not a selection: the board's committed
 * multi-select lives in its `selectedAtoms` / `selectedBonds` sets, survives
 * pointer movement, and is what highlighting renders. A hit may *lead* to a
 * selection; it never is one.
 *
 * Named for its surface so it never collides with the 3D scene's
 * `SceneHit`, which describes the same idea over Babylon meshes.
 */
export type BoardHit =
  | { kind: "atom"; index: number }
  | { kind: "bond"; index: number }
  | { kind: "annotation"; index: number }
  | { kind: "none" };

/**
 * Hit-test atoms (disk) and bonds (segment distance) in document space.
 */
export class HitTester {
  constructor(
    private readonly atomRadiusDoc: number,
    private readonly bondHalfWidthDoc: number,
    private readonly labelSizeDoc = 0,
    private readonly multipleBondReachDoc = 0,
  ) {}

  hit(graph: MoleculeGraph, x: number, y: number): BoardHit {
    const data = graph.getMoleculeData();
    const label = findAtomLabel(data.atoms, { x, y }, this.labelSizeDoc);
    if (label !== undefined) return { kind: "atom", index: label };

    let bestAtom = -1;
    let bestAtomDist = Infinity;
    for (let i = 0; i < data.atoms.length; i++) {
      const a = data.atoms[i];
      const dx = a.x - x;
      const dy = a.y - y;
      const d = Math.hypot(dx, dy);
      if (d <= this.atomRadiusDoc && d < bestAtomDist) {
        bestAtomDist = d;
        bestAtom = i;
      }
    }
    if (bestAtom >= 0) return { kind: "atom", index: bestAtom };

    let bestBond = -1;
    let bestBondDist = Infinity;
    for (let b = 0; b < data.bonds.length; b++) {
      const bond = data.bonds[b];
      const a1 = data.atoms[bond.i];
      const a2 = data.atoms[bond.j];
      if (!a1 || !a2) continue;
      const d = pointSegmentDistance(x, y, a1.x, a1.y, a2.x, a2.y);
      const reach =
        bond.order > 1
          ? Math.max(this.bondHalfWidthDoc, this.multipleBondReachDoc)
          : this.bondHalfWidthDoc;
      if (d <= reach && d < bestBondDist) {
        bestBondDist = d;
        bestBond = b;
      }
    }
    if (bestBond >= 0) return { kind: "bond", index: bestBond };
    return { kind: "none" };
  }
}

/** Find the nearest visible symbol whose label area contains this point. */
export function findAtomLabel(
  atoms: readonly Atom2D[],
  point: { x: number; y: number },
  fontSize: number,
  padding = 0,
  exclude?: readonly number[],
): number | undefined {
  if (fontSize <= 0) return undefined;
  let best: number | undefined;
  let bestDistance = Infinity;
  for (const [index, atom] of atoms.entries()) {
    if (exclude?.includes(index)) continue;
    const text = atom.label ?? (atom.element === "C" ? "" : atom.element);
    if (!text) continue;
    const dx = Math.abs(atom.x - point.x);
    const dy = Math.abs(atom.y - point.y);
    if (
      dy <= fontSize / 2 + padding &&
      dx <= atomLabelWidth(text, fontSize) / 2 + padding
    ) {
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function pointSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}
