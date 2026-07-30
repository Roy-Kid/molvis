import type { Molvis } from "@molvis/stage";

export function getSelectedAtomIndices(app: Molvis): number[] {
  const selection = app.world.selectionManager.getState();
  return [...selection.atoms];
}
