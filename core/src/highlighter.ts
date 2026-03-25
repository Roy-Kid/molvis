import { Color3, Color4, type Mesh, type Scene } from "@babylonjs/core";
import type { MolvisApp } from "./app";
import { type SelectionState, parseSelectionKey } from "./selection_manager";

/**
 * Highlighter: Mode-aware highlighting in a single module.
 * All highlighting uses thin instance colorBuffer (impostor pipeline).
 *
 * Responsibilities:
 * - Apply highlights based on selection state
 * - Restore original colors on deselect
 * - Handle mode switches (invalidate and rebuild)
 */
export class Highlighter {
  private scene: Scene;

  // Sparse storage for thin instance original colors
  // Key: `${uniqueId}:${thinIndex}`
  private thinOriginalColors = new Map<
    string,
    Array<{ bufferName: string; r: number; g: number; b: number; a: number }>
  >();

  // State
  private lastSelectionState: SelectionState = {
    atoms: new Set(),
    bonds: new Set(),
  };
  private previewKeys: Set<string> = new Set();

  private app: MolvisApp;

  constructor(app: MolvisApp, scene: Scene) {
    this.app = app;
    this.scene = scene;
  }

  /**
   * Set the current selection state (redrawn immediately).
   */
  highlightSelection(state: SelectionState): void {
    this.lastSelectionState = state;
    this.render();
  }

  /**
   * Set the current preview (hover) keys.
   */
  highlightPreview(keys: string[]): void {
    this.previewKeys.clear();
    for (const k of keys) {
      this.previewKeys.add(k);
    }
    this.render();
  }

  /**
   * Main render loop: Clears all, then applies Preview, then Selection (Selection overrides Preview).
   */
  private render(): void {
    this.clearAll();

    // 1. Apply Preview
    for (const key of this.previewKeys) {
      // If already selected, skip preview (Selection wins)
      if (
        this.lastSelectionState.atoms.has(key) ||
        this.lastSelectionState.bonds.has(key)
      ) {
        continue;
      }
      this.applyHighlight(key, [0.4, 0.8, 1.0, 0.8]); // Soft Cyan (with alpha)
    }

    // 2. Apply Selection
    const selectionColorHex = this.app.styleManager.getTheme().selectionColor;

    let r: number;
    let g: number;
    let b: number;

    // Check if hex includes alpha (length > 7, e.g. #RRGGBBAA)
    if (selectionColorHex.length > 7) {
      const c4 = Color4.FromHexString(selectionColorHex);
      // Manual approximation for linear space (Gamma 2.2) since Color4 doesn't have toLinearSpace
      r = c4.r ** 2.2;
      g = c4.g ** 2.2;
      b = c4.b ** 2.2;
    } else {
      const c3 = Color3.FromHexString(selectionColorHex).toLinearSpace();
      r = c3.r;
      g = c3.g;
      b = c3.b;
    }

    const selectionColor = [r, g, b, 1.0];

    for (const key of this.lastSelectionState.atoms) {
      this.applyHighlight(key, selectionColor);
    }
    for (const key of this.lastSelectionState.bonds) {
      this.applyHighlight(key, selectionColor);
    }
  }

  private applyHighlight(key: string, colorBufferVal: number[]): void {
    const ref = parseSelectionKey(key);
    if (!ref) return;

    const mesh = this.scene.getMeshByUniqueId(ref.meshId) as Mesh;
    if (!mesh) return;

    if (ref.subIndex !== undefined) {
      this.highlightThinInstance(mesh, ref.subIndex, colorBufferVal);
    }
  }

  /**
   * Highlight a thin instance.
   */
  private highlightThinInstance(
    mesh: Mesh,
    thinIndex: number,
    color: number[],
  ): void {
    const key = `${mesh.uniqueId}:${thinIndex}`;
    const colorBuffers = this.getThinInstanceColorBuffers(mesh);
    if (colorBuffers.length === 0) return;

    // Store original color (sparse) if not already stored
    if (!this.thinOriginalColors.has(key)) {
      this.thinOriginalColors.set(
        key,
        colorBuffers.map(({ name, data }) => {
          const offset = thinIndex * 4;
          return {
            bufferName: name,
            r: data[offset],
            g: data[offset + 1],
            b: data[offset + 2],
            a: data[offset + 3],
          };
        }),
      );
    }

    for (const { name, data } of colorBuffers) {
      const offset = thinIndex * 4;
      // Overwrite RGB but preserve the existing alpha so that pipeline-computed
      // transparency (e.g. TransparentSelectionModifier) is not destroyed.
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      // Keep data[offset + 3] unchanged
      mesh.thinInstanceSetBuffer(name, data, 4, false);
    }
  }

  /**
   * Clear all highlights and restore original colors.
   */
  clearAll(): void {
    // Restore thin instance colors
    for (const [key, colors] of this.thinOriginalColors) {
      const [uniqueIdStr, thinIndexStr] = key.split(":");
      const uniqueId = Number.parseInt(uniqueIdStr);
      const thinIndex = Number.parseInt(thinIndexStr);

      const mesh = this.scene.getMeshByUniqueId(uniqueId) as Mesh;
      if (!mesh) continue;

      const buffers = new Map(
        this.getThinInstanceColorBuffers(mesh).map(({ name, data }) => [
          name,
          data,
        ]),
      );
      for (const color of colors) {
        const buffer = buffers.get(color.bufferName);
        if (!buffer) continue;

        const offset = thinIndex * 4;
        buffer[offset] = color.r;
        buffer[offset + 1] = color.g;
        buffer[offset + 2] = color.b;
        // Do NOT restore alpha — it is managed by the pipeline
        // (TransparentSelectionModifier, SliceModifier, globalOpacity).

        mesh.thinInstanceSetBuffer(color.bufferName, buffer, 4, false);
      }
    }
    this.thinOriginalColors.clear();
  }

  /**
   * Discard saved originals without restoring them.
   * Use after a full scene rebuild when the old buffer data is stale.
   */
  discardSavedOriginals(): void {
    this.thinOriginalColors.clear();
  }

  /**
   * Invalidate and rebuild highlights (called on mode switch).
   */
  invalidateAndRebuild(): void {
    this.clearAll();
    this.render();
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    this.clearAll();
  }

  private getThinInstanceColorBuffers(
    mesh: Mesh,
  ): Array<{ name: string; data: Float32Array }> {
    const storage = (
      mesh as unknown as {
        _userThinInstanceBuffersStorage?: {
          data?: Record<string, Float32Array>;
        };
      }
    )._userThinInstanceBuffersStorage;

    const buffers: Array<{ name: string; data: Float32Array }> = [];
    const single = storage?.data?.instanceColor;
    if (single instanceof Float32Array) {
      buffers.push({ name: "instanceColor", data: single });
    }
    const start = storage?.data?.instanceColor0;
    if (start instanceof Float32Array) {
      buffers.push({ name: "instanceColor0", data: start });
    }
    const end = storage?.data?.instanceColor1;
    if (end instanceof Float32Array) {
      buffers.push({ name: "instanceColor1", data: end });
    }
    return buffers;
  }
}
