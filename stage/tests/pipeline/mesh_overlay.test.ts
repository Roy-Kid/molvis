/**
 * MeshOverlayModifier.
 *
 * The point of the type is that its geometry does not depend on the frame:
 * whatever the pipeline is composing, and whichever trajectory step it is
 * composing it at, the same triangles come back out. These cover that, the
 * producer/draw pairing, and the array identity `Draw surface` relies on to
 * skip a GPU re-upload per step.
 */

import { Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import type { SurfaceMesh } from "../../src/algo/surface_mesh";
import { DrawSurfaceModifier } from "../../src/pipeline/draw_surface";
import { MeshOverlayModifier } from "../../src/pipeline/mesh_overlay";
import { ModifierCapability } from "../../src/pipeline/modifier";
import { type PipelineContext, SelectionMask } from "../../src/pipeline/types";

/** One triangle, enough to be non-empty geometry. */
function triangle(): SurfaceMesh {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  };
}

/** The slice of the context a producer touches; no app, no renderer. */
function context(frameIndex: number): PipelineContext {
  return {
    selectionSet: new Map(),
    currentSelection: SelectionMask.none(0),
    selectedBondIds: [],
    suppressHighlight: false,
    postRenderEffects: [],
    selectionCache: new Map(),
    surfaces: new Map(),
    frameIndex,
    app: undefined as never,
    changeKind: "full",
  };
}

describe("MeshOverlayModifier", () => {
  it("produces geometry rather than drawing it", () => {
    const mod = new MeshOverlayModifier();
    expect(mod.capabilities.has(ModifierCapability.ProducesGeometry)).toBe(
      true,
    );
    expect(mod.capabilities.has(ModifierCapability.Draws)).toBe(false);
  });

  it("brings a Draw surface bound to itself", () => {
    const mod = new MeshOverlayModifier("mesh-1");
    const draw = mod.createDraw();
    expect(draw).toBeInstanceOf(DrawSurfaceModifier);
    expect(draw.producerId).toBe("mesh-1");
  });

  it("never auto-attaches: geometry arrives with a file, not with a frame", () => {
    const frame = new Frame();
    expect(new MeshOverlayModifier().matches(frame)).toBe(false);
    frame.free();
  });

  it("publishes its triangles for the draw companion", () => {
    const mod = new MeshOverlayModifier("mesh-1");
    mod.setMesh(triangle(), "cube.stl");
    const ctx = context(0);
    const frame = new Frame();

    mod.apply(frame, ctx);

    const parts = ctx.surfaces.get("mesh-1");
    expect(parts?.length).toBe(1);
    expect(parts?.[0].role).toBe("primary");
    expect(parts?.[0].mesh.indices.length).toBe(3);
    frame.free();
  });

  it("publishes the same geometry at every trajectory step", () => {
    // The whole reason a mesh is a modifier and not a source: playback must
    // not move it, and seeking must not drop it.
    const mod = new MeshOverlayModifier("mesh-1");
    mod.setMesh(triangle(), "cube.stl");
    const frame = new Frame();

    const first = context(0);
    mod.apply(frame, first);
    const later = context(37);
    mod.apply(frame, later);

    expect(later.surfaces.get("mesh-1")).toBe(first.surfaces.get("mesh-1"));
    frame.free();
  });

  it("publishes nothing until a mesh is set", () => {
    const ctx = context(0);
    const frame = new Frame();
    new MeshOverlayModifier("mesh-1").apply(frame, ctx);
    expect(ctx.surfaces.has("mesh-1")).toBe(false);
    frame.free();
  });

  it("reports the file it came from and how big it is", () => {
    const mod = new MeshOverlayModifier();
    expect(mod.hasMesh).toBe(false);
    mod.setMesh(triangle(), "cavity.stl");
    expect(mod.hasMesh).toBe(true);
    expect(mod.sourceName).toBe("cavity.stl");
    expect(mod.triangleCount).toBe(1);
  });

  it("saves the source name but not the geometry", () => {
    // Triangles are file bytes, not parameters. A restored project keeps the
    // row and the name; the file has to be opened again to paint it.
    const saved = new MeshOverlayModifier();
    saved.setMesh(triangle(), "cavity.stl");
    const restored = new MeshOverlayModifier();
    restored.fromProjectParams(saved.toProjectParams());

    expect(restored.sourceName).toBe("cavity.stl");
    expect(restored.hasMesh).toBe(false);
  });
});
