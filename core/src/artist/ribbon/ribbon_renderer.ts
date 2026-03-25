/**
 * RibbonRenderer — manages BabylonJS mesh creation from ribbon geometry data.
 */

import {
  Color4,
  Mesh,
  type Scene,
  StandardMaterial,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import type { SecondaryStructureType } from "./pdb_backbone";
import { type ChainTrace, parsePdbBackbone } from "./pdb_backbone";
import { buildRibbonGeometry } from "./ribbon_geometry";
import { type SplinePoint, catmullRomSpline } from "./spline";

const RIBBON_SUBDIVISIONS = 6;

export class RibbonRenderer {
  private meshes: Mesh[] = [];
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Build ribbon meshes from raw PDB text.
   * Call this after loading a PDB file. Disposes any previous ribbon meshes.
   */
  public buildFromPdb(pdbText: string): void {
    this.dispose();
    const chains = parsePdbBackbone(pdbText);
    if (chains.length === 0) return;

    const material = this.getOrCreateMaterial();

    for (const chain of chains) {
      const mesh = this.buildChainMesh(chain, material);
      if (mesh) {
        this.meshes.push(mesh);
      }
    }
  }

  /**
   * Show or hide all ribbon meshes.
   */
  public setVisible(visible: boolean): void {
    for (const mesh of this.meshes) {
      mesh.setEnabled(visible);
    }
  }

  /**
   * Whether ribbon data exists (i.e., a PDB with backbone was loaded).
   */
  public get hasData(): boolean {
    return this.meshes.length > 0;
  }

  public dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes = [];
  }

  private buildChainMesh(
    chain: ChainTrace,
    material: StandardMaterial,
  ): Mesh | null {
    const residues = chain.residues;
    const n = residues.length;
    if (n < 2) return null;

    // Build control point arrays
    const positions = new Float64Array(n * 3);
    const normals = new Float64Array(n * 3);
    const ssTypes: SecondaryStructureType[] = [];

    for (let i = 0; i < n; i++) {
      const r = residues[i];
      const ca = r.ca;
      if (!ca) continue;

      positions[i * 3 + 0] = ca.x;
      positions[i * 3 + 1] = ca.y;
      positions[i * 3 + 2] = ca.z;

      // Normal from CA → O direction (peptide plane)
      if (r.o) {
        let nx = r.o.x - ca.x;
        let ny = r.o.y - ca.y;
        let nz = r.o.z - ca.z;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-8) {
          nx /= len;
          ny /= len;
          nz /= len;
        }
        normals[i * 3 + 0] = nx;
        normals[i * 3 + 1] = ny;
        normals[i * 3 + 2] = nz;
      } else {
        // Fallback: use up vector
        normals[i * 3 + 0] = 0;
        normals[i * 3 + 1] = 1;
        normals[i * 3 + 2] = 0;
      }

      ssTypes.push(r.ss);
    }

    // Generate spline
    const splinePoints = catmullRomSpline(
      positions,
      normals,
      RIBBON_SUBDIVISIONS,
    );
    if (splinePoints.length < 2) return null;

    // Map spline points back to secondary structure type
    const ssPerPoint: SecondaryStructureType[] = splinePoints.map((pt) => {
      const idx = Math.min(Math.floor(pt.t), n - 1);
      return ssTypes[idx];
    });

    // Build geometry
    const geo = buildRibbonGeometry(splinePoints, ssPerPoint);

    // Create BabylonJS mesh
    const mesh = new Mesh(`ribbon_${chain.chainId}`, this.scene);
    const vertexData = new VertexData();
    vertexData.positions = geo.positions;
    vertexData.normals = geo.normals;
    vertexData.indices = geo.indices;
    vertexData.applyToMesh(mesh);

    // Apply vertex colors
    mesh.setVerticesBuffer(
      new VertexBuffer(
        this.scene.getEngine(),
        geo.colors,
        VertexBuffer.ColorKind,
        false,
        false,
        4,
      ),
    );

    mesh.material = material;
    mesh.isPickable = false;

    return mesh;
  }

  private getOrCreateMaterial(): StandardMaterial {
    const name = "__molvis_ribbon_mat__";
    const existing = this.scene.getMaterialByName(
      name,
    ) as StandardMaterial | null;
    if (existing) return existing;

    const mat = new StandardMaterial(name, this.scene);
    mat.backFaceCulling = false;
    // Vertex colors are enabled automatically by BabylonJS when the mesh
    // has a color vertex buffer — set diffuse to white so colors pass through.
    mat.diffuseColor.set(1, 1, 1);
    mat.specularColor.set(0.3, 0.3, 0.3);
    return mat;
  }
}
