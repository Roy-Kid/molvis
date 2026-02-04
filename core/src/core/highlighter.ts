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
    { r: number; g: number; b: number; a: number }
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
    const colorBuffer = this.getThinInstanceColorBuffer(mesh);
    if (!colorBuffer) return;

    const offset = thinIndex * 4;
    const key = `${mesh.uniqueId}:${thinIndex}`;

    // Store original color (sparse) if not already stored
    if (!this.thinOriginalColors.has(key)) {
      this.thinOriginalColors.set(key, {
        r: colorBuffer[offset],
        g: colorBuffer[offset + 1],
        b: colorBuffer[offset + 2],
        a: colorBuffer[offset + 3],
      });
    }

    // Apply visual
    colorBuffer.set(color, offset);

    mesh.thinInstanceSetBuffer("color", colorBuffer, 4, false);
  }

  /**
   * Clear all highlights and restore original colors.
   */
  clearAll(): void {
    // Restore thin instance colors
    for (const [key, color] of this.thinOriginalColors) {
      const [uniqueIdStr, thinIndexStr] = key.split(":");
      const uniqueId = Number.parseInt(uniqueIdStr);
      const thinIndex = Number.parseInt(thinIndexStr);

      const mesh = this.scene.getMeshByUniqueId(uniqueId) as Mesh;
      if (!mesh) continue;

      const colorBuffer = this.getThinInstanceColorBuffer(mesh);
      if (!colorBuffer) continue;

      const offset = thinIndex * 4;
      colorBuffer[offset] = color.r;
      colorBuffer[offset + 1] = color.g;
      colorBuffer[offset + 2] = color.b;
      colorBuffer[offset + 3] = color.a;

      mesh.thinInstanceSetBuffer("color", colorBuffer, 4, false);
    }
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

  private getThinInstanceColorBuffer(mesh: Mesh): Float32Array | null {
    const storage = (
      mesh as unknown as {
        _userThinInstanceBuffersStorage?: {
          data?: Record<string, Float32Array>;
        };
      }
    )._userThinInstanceBuffersStorage;

    // Key is 'instanceColor' in storage, but 'color' in public API
    const buffer = storage?.data?.instanceColor ?? null;
    return buffer instanceof Float32Array ? buffer : null;
  }
}
