import { buildSourceColorLegend } from "@molvis/core";

/** A modifier the combine node may reference as a branch. */
export interface BranchOption {
  id: string;
  name: string;
}

/**
 * Candidate branches a combine modifier may reference: every modifier except
 * itself and any id the engine has rejected (cycle / invalid set). Pure — the
 * engine remains the authority; this only pre-filters the picker so obviously
 * invalid choices aren't offered.
 */
export function getReferenceableBranches(
  selfId: string,
  allModifiers: readonly { id: string; name: string }[],
  rejectedIds: readonly string[],
): BranchOption[] {
  const rejected = new Set<string>([selfId, ...rejectedIds]);
  return allModifiers
    .filter((m) => !rejected.has(m.id))
    .map((m) => ({ id: m.id, name: m.name }));
}

/**
 * Format an RMSD-to-reference value for a status line: 3 decimals + Å, or an
 * em dash for null / non-finite (reference branch, or not-yet-computed).
 */
export function formatRmsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(3)} Å`;
}

/** A source→color legend row: branch id label + its palette hex. */
export interface LegendEntry {
  label: string;
  color: string;
}

/**
 * Map referenced branch ids (in order) to their per-source legend color. The
 * i-th branch gets the categorical palette color for ordinal i — the same
 * mapping `CombineSystemsModifier`'s `source_id` and the color-by-source mode
 * use, so the legend matches the canvas. Cycles past the palette length.
 */
export function buildSourceLegend(branchIds: readonly string[]): LegendEntry[] {
  // Look up by ordinal id, not array position: buildSourceColorLegend dedups
  // and re-sorts its rows, so positional indexing would couple to an unstated
  // invariant of that function.
  const byOrdinal = new Map(
    buildSourceColorLegend(branchIds.map((_, i) => i)).map((e) => [
      e.sourceId,
      e.hex,
    ]),
  );
  return branchIds.map((id, i) => ({
    label: id,
    color: byOrdinal.get(i) ?? "#000000",
  }));
}
