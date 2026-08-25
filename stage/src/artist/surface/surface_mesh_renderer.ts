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
import type { SurfaceMesh, SurfacePart } from "../../algo/surface_mesh";
import { registerSurfaceShaders } from "../../shaders/surface";

/** Real-time fragment treatment applied to a surface. */
export type SurfaceFinish = "solid" | "mesh" | "contour" | "dot";

/**
 * How a surface looks. Owned by the artist because it is the rendering
 * vocabulary; `Draw surface` holds one of these and nothing else does.
 */
export interface SurfaceDrawStyle {
  /** Linear RGB in [0, 1]. */
  color: [number, number, number];
  /** 0..1. Below 1 enables alpha blending and the depth pre-pass. */
  opacity: number;
  finish: SurfaceFinish;
  /** Distance in Å between view-depth contour bands. */
  contourSpacing: number;
}

export const DEFAULT_SURFACE_DRAW_STYLE: SurfaceDrawStyle = {
  color: [0.4, 0.65, 1.0],
  opacity: 0.6,
  finish: "solid",
  contourSpacing: 0.45,
};

const FINISH_CODE: Readonly<Record<SurfaceFinish, number>> = {
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
    source: SurfaceMesh,
    color: readonly [number, number, number],
    style: SurfaceDrawStyle,
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

  /**
   * Live colour update. Splitting compute from draw is what makes this
   * possible: repainting a surface must not re-run marching cubes, let alone
   * a Delaunay tetrahedralisation.
   */
  setColor(color: readonly [number, number, number]): void {
    for (const mesh of this.meshes) {
      const mat = mesh.material as ShaderMaterial | null;
      mat?.setColor3("surfaceColor", new Color3(color[0], color[1], color[2]));
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
    style: SurfaceDrawStyle,
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
    mat.setFloat("surfaceStyle", FINISH_CODE[style.finish] ?? 0);
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
function applyGeometry(mesh: Mesh, source: SurfaceMesh): void {
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

/** The complement lobe of a signed field, so the two lobes read apart. */
export function complementColor(
  color: readonly [number, number, number],
): [number, number, number] {
  return [1 - color[0], 1 - color[1], 1 - color[2]];
}

export function colorForRole(
  style: SurfaceDrawStyle,
  part: SurfacePart,
): [number, number, number] {
  return part.role === "complement"
    ? complementColor(style.color)
    : [...style.color];
}
