import { BaseRenderOp } from "./base";
import type { RenderOpContext } from "../types";
import type { Scene } from "@babylonjs/core";
import type { Frame } from "../../structure/frame";
import type { Box } from "../../structure";
import { MeshBuilder, Vector3, type LinesMesh, Color3 } from "@babylonjs/core";
import { DefaultPalette } from "../palette";

const palette = new DefaultPalette();
const DEFAULT_BOX_COLOR = Color3.FromHexString(palette.getDefaultBoxColor());

/**
 * Options for DrawBoxOp.
 */
export interface DrawBoxOpOptions {
  /** Whether box is visible (default: true) */
  visible?: boolean;
  /** Box color (default: from palette) */
  color?: Color3;
  /** Line width (not used in BabylonJS lines, but kept for API compatibility) */
  lineWidth?: number;
}

/**
 * DrawBoxOp renders a box (periodic boundary conditions) as line edges in the scene.
 * 
 * Reads box from frame.meta["box"] or options.
 * Draws 12 edges forming a rectangular box.
 */
export class DrawBoxOp extends BaseRenderOp {
  private options: DrawBoxOpOptions;
  private meshes: LinesMesh[] = [];

  constructor(options: DrawBoxOpOptions = {}, id?: string) {
    super(id);
    this.options = options;
  }

  render(scene: Scene, frame: Frame, _ctx: RenderOpContext): void {
    // Get box from frame.box property or frame metadata
    const box = frame.box || (frame.meta.get("box") as Box | undefined);
    if (!box) {
      // No box to draw
      return;
    }

    const visible = this.options.visible ?? true;
    if (!visible) {
      this.dispose();
      return;
    }

    // Remove existing box meshes
    this.dispose();

    // Also remove any existing box meshes from scene
    for (const mesh of scene.meshes) {
      if (mesh.name.startsWith("box:")) {
        mesh.dispose();
      }
    }

    const color = this.options.color ?? DEFAULT_BOX_COLOR;
    const lines: LinesMesh[] = [];

    // Define box edges (12 edges of a rectangular box)
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
      [4, 5], [5, 6], [6, 7], [7, 4], // top face
      [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
    ];

    // Get box corners
    const corners = box.get_corners(); // Float32Array(24)
    
    // Reshape corners to 2D array
    const corners2D: number[][] = [];
    for (let i = 0; i < corners.length; i += 3) {
      corners2D.push([corners[i], corners[i + 1], corners[i + 2]]);
    }

    // Create line meshes for each edge
    for (let i = 0; i < edges.length; i++) {
      const [start, end] = edges[i];
      const points = [
        Vector3.FromArray(corners2D[start]),
        Vector3.FromArray(corners2D[end])
      ];
      const line = MeshBuilder.CreateLines(`box:edge:${i}`, { points }, scene);
      line.color = color;
      lines.push(line);
    }

    this.meshes = lines;
  }

  /**
   * Dispose resources used by this operation.
   */
  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes = [];
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      options: {
        visible: this.options.visible,
        color: this.options.color ? {
          r: this.options.color.r,
          g: this.options.color.g,
          b: this.options.color.b,
        } : undefined,
        lineWidth: this.options.lineWidth,
      },
    };
  }
}

