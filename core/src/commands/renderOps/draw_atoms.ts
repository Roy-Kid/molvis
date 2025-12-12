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
  CreateSphereVertexData,
} from "@babylonjs/core";
import { DefaultPalette } from "../palette";

const palette = new DefaultPalette();
const DEFAULT_ATOM_RADIUS = palette.getDefaultRadius();
const DEFAULT_ATOM_COLOR = Color3.FromHexString(palette.getDefaultAtomColor());

/**
 * Options for DrawAtomsOp.
 */
export interface DrawAtomsOpOptions {
  /** Custom radii for atoms (array matching atom count) */
  radii?: number[];
  /** Custom colors for atoms (array of hex color strings) */
  color?: string[];
  /** Mesh name prefix (default: "atoms") */
  meshName?: string;
}

/**
 * DrawAtomsOp renders atoms from a Frame as spheres in the scene.
 * 
 * Uses thin instancing for efficient rendering of many atoms.
 * Reads atom positions and properties from Frame.
 */
export class DrawAtomsOp extends BaseRenderOp {
  private options: DrawAtomsOpOptions;
  private mesh: Mesh | null = null;

  constructor(options: DrawAtomsOpOptions = {}, id?: string) {
    super(id);
    this.options = options;
  }

  render(scene: Scene, frame: Frame, _ctx: RenderOpContext): void {
    const atomBlock = frame.atomBlock;
    const count = atomBlock.n_atoms;
    if (count <= 0) return;

    // Dispose existing mesh if present
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }

    const geometry = CreateSphereVertexData({ diameter: 1, segments: 16 });
    const meshName = this.options.meshName || "atoms";
    const mesh = new Mesh(meshName, scene);
    geometry.applyToMesh(mesh);

    const material = new StandardMaterial(`${meshName}_mat`, scene);
    (material as any).useVertexColor = true;
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    mesh.material = material;

    const matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 4);

    const pos = new Vector3();
    const scale = new Vector3();
    const qIdentity = Quaternion.Identity();
    const tmpMat = new Matrix();

    // Get element and name arrays from block
    let elements: string[] = [];
    let name: string[] = [];
    try {
      elements = atomBlock.get<string[]>("element") ?? [];
    } catch {
      // element not found, will use defaults
    }
    try {
      name = atomBlock.get<string[]>("name") ?? [];
    } catch {
      // name not found, will use defaults
    }

    const atom_radii = new Float32Array(count);
    const atom_colors = new Float32Array(count * 4);

    const haveElements = !!elements && elements.length === count;
    for (let i = 0; i < count; i++) {
      const el = haveElements ? elements![i] : undefined;

      atom_radii[i] = el ? palette.getAtomRadius(el) : DEFAULT_ATOM_RADIUS;

      const c = el ? Color3.FromHexString(palette.getAtomColor(el)) : DEFAULT_ATOM_COLOR;
      const off = i * 4;
      atom_colors[off] = c.r;
      atom_colors[off + 1] = c.g;
      atom_colors[off + 2] = c.b;
      atom_colors[off + 3] = 1;
    }

    // Apply user-provided radii
    const userR = this.options.radii;
    if (Array.isArray(userR) && userR.length === count) {
      atom_radii.set(userR);
    }

    // Apply user-provided colors
    const userC = this.options.color;
    if (Array.isArray(userC)) {
      for (let i = 0; i < count; i++) {
        const c = Color3.FromHexString(userC[i]);
        const off = i * 4;
        atom_colors[off] = c.r;
        atom_colors[off + 1] = c.g;
        atom_colors[off + 2] = c.b;
        atom_colors[off + 3] = 1;
      }
    }

    // Build transformation matrices and colors
    for (let i = 0; i < count; i++) {
      pos.set(atomBlock.x[i], atomBlock.y[i], atomBlock.z[i]);

      const r = atom_radii[i];
      scale.set(r, r, r);
      const c = atom_colors.subarray(i * 4, i * 4 + 4);

      Matrix.ComposeToRef(scale, qIdentity, pos, tmpMat);
      tmpMat.copyToArray(matrices, i * 16);

      const off = i * 4;
      colors[off] = c[0];
      colors[off + 1] = c[1];
      colors[off + 2] = c[2];
      colors[off + 3] = 1;
    }


    mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    mesh.thinInstanceSetBuffer("color", colors, 4, false); // false = updatable for highlighting
    mesh.thinInstanceEnablePicking = true;
    mesh.metadata = { meshType: "atom", matrices: matrices, names: name, colorBuffer: colors };

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

