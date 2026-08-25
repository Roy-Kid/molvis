/**
 * Two surface-drawing modifiers in one pipeline must not overwrite each
 * other's mesh.
 *
 * `IsosurfaceRenderer` used to be a single artist-wide instance with fixed
 * mesh names, so adding a `Molecular surface` next to a CUBE file's
 * `Create isosurface` silently erased the first. Each owner now gets its own
 * renderer and its own mesh names; this pins that.
 */

import { NullEngine, Scene } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import type { MCMesh } from "../../../src/algo/marching_cubes";
import {
  DEFAULT_ISOSURFACE_STYLE,
  IsosurfaceRenderer,
} from "../../../src/artist/isosurface/isosurface_renderer";

function triangle(): MCMesh {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
  };
}

describe("surface layer isolation", () => {
  it("two owners keep separate meshes in one scene", () => {
    const scene = new Scene(new NullEngine());
    const alpha = new IsosurfaceRenderer(scene, "Alpha");
    const bravo = new IsosurfaceRenderer(scene, "Bravo");

    alpha.drawMesh(triangle(), [1, 0, 0], DEFAULT_ISOSURFACE_STYLE);
    bravo.drawMesh(triangle(), [0, 1, 0], DEFAULT_ISOSURFACE_STYLE);

    expect(alpha.hasData).toBe(true);
    expect(bravo.hasData).toBe(true);
    const names = scene.meshes.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    scene.dispose();
  });

  it("disposing one owner leaves the other drawn", () => {
    const scene = new Scene(new NullEngine());
    const alpha = new IsosurfaceRenderer(scene, "Alpha");
    const bravo = new IsosurfaceRenderer(scene, "Bravo");
    alpha.drawMesh(triangle(), [1, 0, 0], DEFAULT_ISOSURFACE_STYLE);
    bravo.drawMesh(triangle(), [0, 1, 0], DEFAULT_ISOSURFACE_STYLE);

    alpha.dispose();
    expect(alpha.hasData).toBe(false);
    expect(bravo.hasData).toBe(true);
    scene.dispose();
  });

  it("hiding one owner does not hide the other", () => {
    const scene = new Scene(new NullEngine());
    const alpha = new IsosurfaceRenderer(scene, "Alpha");
    const bravo = new IsosurfaceRenderer(scene, "Bravo");
    alpha.drawMesh(triangle(), [1, 0, 0], DEFAULT_ISOSURFACE_STYLE);
    bravo.drawMesh(triangle(), [0, 1, 0], DEFAULT_ISOSURFACE_STYLE);

    alpha.setVisible(false);
    const enabled = scene.meshes.filter((m) => m.isEnabled());
    expect(enabled.length).toBe(1);
    scene.dispose();
  });

  it("redrawing an owner replaces its own mesh rather than stacking", () => {
    const scene = new Scene(new NullEngine());
    const alpha = new IsosurfaceRenderer(scene, "Alpha");
    alpha.drawMesh(triangle(), [1, 0, 0], DEFAULT_ISOSURFACE_STYLE);
    const afterFirst = scene.meshes.length;
    alpha.drawMesh(triangle(), [1, 0, 0], DEFAULT_ISOSURFACE_STYLE);
    expect(scene.meshes.length).toBe(afterFirst);
    scene.dispose();
  });
});
