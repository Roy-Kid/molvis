/**
 * Turns triangle soup into styled, theme-aware BabylonJS surface meshes.
 *
 * Extracted from {@link ./isosurface_renderer IsosurfaceRenderer} once a
 * second producer appeared: marching cubes is not the only way to get a
 * molecular envelope — convex hull and alpha shape emit triangles directly,
 * with no grid anywhere in sight. Everything downstream of "here are the
 * triangles" is identical, so it lives here.
 *
 * Meshes are `isPickable = false`: picking through a surface should still
 * hit the atoms underneath, the same convention as `sim_box`.
 */

import {
  Color3,
  Material,
  Mesh,
  type Scene,
  ShaderMaterial,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import type { MCMesh } from "../../algo/marching_cubes";
import { registerSurfaceShaders } from "../../shaders/surface";

/** Real-time fragment treatment applied to an extracted surface. */
export type SurfaceStyle = "solid" | "mesh" | "contour" | "dot";

/** The subset of a style that reaches the mesh — no grid concepts here. */
export interface SurfaceMeshStyle {
  opacity: number;
  surfaceStyle: SurfaceStyle;
  /** Distance in Å between view-depth contour bands. */
  contourSpacing: number;
}

const SURFACE_STYLE_CODE: Readonly<Record<SurfaceStyle, number>> = {
  solid: 0,
  mesh: 1,
  contour: 2,
  dot: 3,
};

/**
 * Owns a set of triangle meshes. `add` installs one; `dispose` drops them
 * all. Visibility and opacity apply to every mesh it holds.
 */
export class SurfaceMeshRenderer {
  private readonly scene: Scene;
  private meshes: Mesh[] = [];

  constructor(scene: Scene) {
    registerSurfaceShaders();
    this.scene = scene;
  }

  get hasData(): boolean {
    return this.meshes.length > 0;
  }

  /**
   * Install one triangle mesh. Returns `null` for empty geometry — an
   * isovalue outside the data range, or a hull of collinear points.
   */
  add(
    name: string,
    source: MCMesh,
    color: readonly [number, number, number],
    style: SurfaceMeshStyle,
  ): Mesh | null {
    if (source.positions.length === 0 || source.indices.length === 0) {
      return null;
    }
    const mesh = new Mesh(name, this.scene);
    applyGeometry(mesh, source);
    mesh.material = this.buildMaterial(name, color, style);
    mesh.isPickable = false;
    this.meshes.push(mesh);
    return mesh;
  }

  setVisible(visible: boolean): void {
    for (const mesh of this.meshes) mesh.setEnabled(visible);
  }

  /** Live opacity update, without re-extracting any geometry. */
  setOpacity(opacity: number): void {
    for (const mesh of this.meshes) {
      const mat = mesh.material as ShaderMaterial | null;
      if (mat) applyOpacity(mat, opacity);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.material?.dispose();
      mesh.dispose();
    }
    this.meshes = [];
  }

  private buildMaterial(
    name: string,
    color: readonly [number, number, number],
    style: SurfaceMeshStyle,
  ): ShaderMaterial {
    const mat = new ShaderMaterial(
      `${name}_mat`,
      this.scene,
      { vertex: "molvisSurface", fragment: "molvisSurface" },
      {
        attributes: ["position", "normal", "barycentric"],
        uniforms: [
          "world",
          "worldViewProjection",
          "view",
          "surfaceColor",
          "backgroundColor",
          "lightDir",
          "opacity",
          "surfaceStyle",
          "contourSpacing",
        ],
        needAlphaBlending: true,
      },
    );
    mat.backFaceCulling = false;
    mat.setColor3("surfaceColor", new Color3(color[0], color[1], color[2]));
    mat.setFloat("surfaceStyle", SURFACE_STYLE_CODE[style.surfaceStyle] ?? 0);
    mat.setFloat("contourSpacing", Math.max(0.01, style.contourSpacing));
    mat.setVector3("lightDir", new Vector3(-0.45, 0.6, 0.72).normalize());

    // The shader fades the surface toward the viewport background, so it has
    // to follow a theme switch without a rebuild.
    const backgroundColor = new Color3();
    const syncBackground = () => {
      const background = this.scene.clearColor;
      backgroundColor.set(background.r, background.g, background.b);
      mat.setColor3("backgroundColor", backgroundColor);
    };
    syncBackground();
    mat.onBindObservable.add(syncBackground);

    applyOpacity(mat, style.opacity);
    return mat;
  }
}

/**
 * Expand to one vertex per triangle corner so each corner can carry its own
 * barycentric coordinate. That is what the `mesh` / `dot` fragment styles
 * draw their edges from, and the expansion also makes those edges
 * deterministic instead of dependent on how the producer shared vertices.
 */
function applyGeometry(mesh: Mesh, source: MCMesh): void {
  const positions: number[] = [];
  const normals: number[] = [];
  const barycentric: number[] = [];
  const indices: number[] = [];
  const corners = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ] as const;

  for (let t = 0; t < source.indices.length; t += 3) {
    for (let corner = 0; corner < 3; corner++) {
      const at = source.indices[t + corner] * 3;
      positions.push(
        source.positions[at],
        source.positions[at + 1],
        source.positions[at + 2],
      );
      normals.push(
        source.normals[at],
        source.normals[at + 1],
        source.normals[at + 2],
      );
      barycentric.push(...corners[corner]);
      indices.push(indices.length);
    }
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.indices = indices;
  vertexData.applyToMesh(mesh);
  mesh.setVerticesData("barycentric", barycentric, false, 3);
}

/**
 * Below full opacity the surface needs the depth pre-pass and a separate
 * culling pass, or the far side of a closed surface punches through the near
 * side. At full opacity both are wasted work.
 */
function applyOpacity(mat: ShaderMaterial, opacity: number): void {
  const a = Math.max(0, Math.min(1, opacity));
  mat.setFloat("opacity", a);
  if (a < 1) {
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND;
    mat.needDepthPrePass = true;
    mat.separateCullingPass = true;
  } else {
    mat.transparencyMode = Material.MATERIAL_OPAQUE;
    mat.needDepthPrePass = false;
    mat.separateCullingPass = false;
  }
}
