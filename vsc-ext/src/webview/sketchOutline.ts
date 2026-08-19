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
  }));

  const roots: StructureOutlinePayload["roots"] = [
    {
      id: "atoms",
      label: "Atoms",
      kind: "chain",
      atomIndices: atomNodes.map((n) => n.atomIndices[0]),
      children: atomNodes,
    },
  ];

  if (data.bonds.length > 0) {
    roots.push({
      id: "bonds",
      label: "Bonds",
      kind: "source",
      atomIndices: data.bonds.flatMap((b) => [b.i, b.j]),
      children: data.bonds.map((bond, i) => ({
        id: `bond:${i}`,
        label: `${data.atoms[bond.i]?.element ?? "?"}–${data.atoms[bond.j]?.element ?? "?"} (${bond.order})`,
        kind: "source" as const,
        atomIndices: [bond.i, bond.j],
      })),
    });
  }

  return { roots };
}
