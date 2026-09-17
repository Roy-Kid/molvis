import type { StructureOutlinePayload } from "../protocol";

export type SketchOutlineAtom = { element: string };
export type SketchOutlineBond = { i: number; j: number; order: number };

/** Native sidebar tree for a Sketch molecule (atoms + bonds). */
export function buildSketchOutline(data: {
  atoms: readonly SketchOutlineAtom[];
  bonds: readonly SketchOutlineBond[];
}): StructureOutlinePayload {
  if (data.atoms.length === 0 && data.bonds.length === 0) {
    return { roots: [] };
  }

  const atomNodes = data.atoms.map((atom, i) => ({
    id: `atom:${i}`,
    label: `${atom.element}${i + 1}`,
    kind: "atom" as const,
    atomIndices: [i],
    atomCount: 1,
  }));

  const roots: StructureOutlinePayload["roots"] = [
    {
      id: "atoms",
      label: "Atoms",
      kind: "chain",
      atomCount: atomNodes.length,
      children: atomNodes,
    },
  ];

  if (data.bonds.length > 0) {
    roots.push({
      id: "bonds",
      label: "Bonds",
      kind: "source",
      atomCount: data.bonds.length * 2,
      children: data.bonds.map((bond, i) => ({
        id: `bond:${i}`,
        label: `${data.atoms[bond.i]?.element ?? "?"}–${data.atoms[bond.j]?.element ?? "?"} (${bond.order})`,
        kind: "source" as const,
        atomIndices: [bond.i, bond.j],
        atomCount: 2,
      })),
    });
  }

  return { roots };
}
