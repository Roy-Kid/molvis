import { parseSelectionKey, type Molvis } from "@molvis/core";

export function getSelectedAtomIndices(app: Molvis): number[] {
  const atomIndices = new Set<number>();
  const selection = app.world.selectionManager.getState();

  for (const key of selection.atoms) {
    const ref = parseSelectionKey(key);
    if (!ref) {
      continue;
    }

    const meta = app.world.sceneIndex.getMeta(ref.meshId, ref.subIndex);
    if (meta?.type !== "atom") {
      continue;
    }

    atomIndices.add(meta.atomId);
  }

  return [...atomIndices];
}
