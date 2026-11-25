import { distance, type Point } from "../geometry/plane";
import type { MoleculeData } from "../types";
import { findAtomLabel } from "./hit_test";

export type BondSnapSelection = { kind: "atom" | "bond"; index: number };

/** Join one movable, implicit carbon tip to a visible atom label. */
export function snapMovedBond(
  data: MoleculeData,
  selection: BondSnapSelection,
  dx: number,
  dy: number,
  pointer: Point,
  fontSize: number,
  padding: number,
): MoleculeData | undefined {
  const { atoms, bonds } = data;
  const degrees = new Uint32Array(atoms.length);
  let bondIndex = selection.kind === "bond" ? selection.index : -1;
  for (const [index, bond] of bonds.entries()) {
    degrees[bond.i]++;
    degrees[bond.j]++;
    if (
      selection.kind === "atom" &&
      (bond.i === selection.index || bond.j === selection.index)
    ) {
      bondIndex = index;
    }
  }
  const bond = bonds[bondIndex];
  if (!bond) return undefined;

  const endpoints = [bond.i, bond.j];
  const pointerLabel =
    selection.kind === "bond"
      ? findAtomLabel(atoms, pointer, fontSize, padding, endpoints)
      : undefined;
  let tip: number | undefined;
  let target: number | undefined;
  let nearest = Infinity;
  for (const index of endpoints) {
    if (selection.kind === "atom" && selection.index !== index) continue;
    const atom = atoms[index];
    if (
      degrees[index] !== 1 ||
      atom.element !== "C" ||
      atom.label ||
      atom.charge ||
      atom.port ||
      atom.hydrogens
    ) {
      continue;
    }
    const moved = { x: atom.x + dx, y: atom.y + dy };
    const label =
      findAtomLabel(atoms, moved, fontSize, padding, endpoints) ?? pointerLabel;
    if (label === undefined) continue;
    const gap = distance(atoms[label], moved);
    if (gap < nearest) {
      tip = index;
      target = label;
      nearest = gap;
    }
  }
  if (tip === undefined || target === undefined) return undefined;
  const anchor = tip === bond.i ? bond.j : bond.i;
  const translateAnchor = selection.kind === "bond" && degrees[anchor] === 1;
  const deltaX = atoms[target].x - atoms[tip].x;
  const deltaY = atoms[target].y - atoms[tip].y;
  const remap = (index: number) => {
    const retained = index === tip ? target : index;
    return retained > tip ? retained - 1 : retained;
  };
  return {
    atoms: atoms.flatMap((atom, index) => {
      if (index === tip) return [];
      if (index === anchor && translateAnchor)
        return [{ ...atom, x: atom.x + deltaX, y: atom.y + deltaY }];
      return [atom];
    }),
    bonds: bonds.map((edge) => ({
      ...edge,
      i: remap(edge.i),
      j: remap(edge.j),
    })),
  };
}
