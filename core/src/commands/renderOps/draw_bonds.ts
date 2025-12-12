import { BaseRenderOp } from "./base";
import type { RenderOpContext } from "../types";
import type { Scene } from "@babylonjs/core";
import type { Frame } from "../../structure/frame";
import {
  Mesh,
  StandardMaterial,
  Color3,
  Vector3,
  Quaternion,
  Matrix,
  CreateCylinderVertexData,
} from "@babylonjs/core";
import { DefaultPalette } from "../palette";

const palette = new DefaultPalette();
const DEFAULT_BOND_RADIUS = palette.getDefaultBondRadius();
const DEFAULT_BOND_COLOR = Color3.FromHexString(palette.getDefaultBondColor());

/**
 * Options for DrawBondsOp.
 */
export interface DrawBondsOpOptions {
  /** Bond radius (default: from palette) */
  radius?: number;
  /** Mesh name prefix (default: "bonds") */
  meshName?: string;
}

/**
 * DrawBondsOp renders bonds from a Frame as cylinders in the scene.
 * 
 * Uses thin instancing for efficient rendering of many bonds.
 * Reads bond connectivity from Frame.bondBlock.
 */
export class DrawBondsOp extends BaseRenderOp {
  private options: DrawBondsOpOptions;
  private mesh: Mesh | null = null;

  constructor(options: DrawBondsOpOptions = {}, id?: string) {
    super(id);
    this.options = options;
  }

  render(scene: Scene, frame: Frame, _ctx: RenderOpContext): void {
    const { atomBlock, bondBlock } = frame;
    if (!bondBlock) return;

    const total = bondBlock.n_bonds;
    if (total <= 0) return;

    // Dispose existing mesh if present
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }

    const geometry = CreateCylinderVertexData({ height: 1, diameter: 1, tessellation: 16 });
    const meshName = this.options.meshName || "bonds";
    const mesh = new Mesh(meshName, scene);
    geometry.applyToMesh(mesh);

    const material = new StandardMaterial(`${meshName}_mat`, scene);
    material.diffuseColor = DEFAULT_BOND_COLOR;
    mesh.material = material;

    const matrices = new Float32Array(total * 16);
    const colors = new Float32Array(total * 4);

    const pos = new Vector3();
    const scale = new Vector3();
    const tmpMat = new Matrix();
    const dir = new Vector3();

    const radius = this.options.radius ?? DEFAULT_BOND_RADIUS;

    for (let i = 0; i < total; i++) {
      const idxI = bondBlock.i[i];
      const idxJ = bondBlock.j[i];

      const start = new Vector3(atomBlock.x[idxI], atomBlock.y[idxI], atomBlock.z[idxI]);
      const end = new Vector3(atomBlock.x[idxJ], atomBlock.y[idxJ], atomBlock.z[idxJ]);

      dir.copyFrom(end).subtractInPlace(start);
      const length = dir.length();
      dir.normalize();

      pos.copyFrom(start).addInPlace(end).scaleInPlace(0.5);
      scale.set(radius, length, radius);

      const q = Quaternion.FromUnitVectorsToRef(Vector3.Up(), dir, Quaternion.Identity());
      Matrix.ComposeToRef(scale, q, pos, tmpMat);
      tmpMat.copyToArray(matrices, i * 16);

      const off = i * 4;
      colors[off] = DEFAULT_BOND_COLOR.r;
      colors[off + 1] = DEFAULT_BOND_COLOR.g;
      colors[off + 2] = DEFAULT_BOND_COLOR.b;
      colors[off + 3] = 1;
    }

    mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    mesh.thinInstanceSetBuffer("color", colors, 4);
    mesh.metadata = { meshType: "bond" };

    this.mesh = mesh;
  }

  /**
   * Dispose resources used by this operation.
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      options: this.options,
    };
  }
}

