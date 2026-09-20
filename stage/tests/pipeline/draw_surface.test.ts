/**
 * DrawSurfaceModifier — when it repaints.
 *
 * A producer that recomputes every pass hands back a fresh parts array and
 * must be repainted. One whose geometry is fixed (an imported mesh) hands
 * back the same array every pass, and re-uploading its vertices on every
 * trajectory step would be pure waste. The identity check is what tells the
 * two apart, so it needs to bite in both directions — including after the
 * artist has silently dropped the layer under it (a scene replace).
 */

import { Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import type { SurfacePart } from "../../src/algo/surface_mesh";
import { DrawSurfaceModifier } from "../../src/pipeline/draw_surface";
import { type PipelineContext, SelectionMask } from "../../src/pipeline/types";

class FakeSurfaceLayer {
  hasData = false;
  disposals = 0;

  dispose(): void {
    this.hasData = false;
    this.disposals++;
  }

  setVisible(_visible: boolean): void {}
}

/** The three artist methods `Draw surface` calls, and a paint counter. */
class FakeArtist {
  readonly layers = new Map<string, FakeSurfaceLayer>();
  paints = 0;

  surfaceLayer(ownerId: string): FakeSurfaceLayer {
    const existing = this.layers.get(ownerId);
    if (existing) return existing;
    const created = new FakeSurfaceLayer();
    this.layers.set(ownerId, created);
    return created;
  }

  drawSurfaceParts(ownerId: string): void {
    this.paints++;
    this.surfaceLayer(ownerId).hasData = true;
  }

  releaseSurfaceLayer(ownerId: string): void {
    this.layers.delete(ownerId);
  }
}

function context(
  artist: FakeArtist,
  parts: Map<string, SurfacePart[]>,
): PipelineContext {
  return {
    selectionSet: new Map(),
    currentSelection: SelectionMask.none(0),
    selectedBondIds: [],
    suppressHighlight: false,
    postRenderEffects: [],
    selectionCache: new Map(),
    surfaces: parts,
    frameIndex: 0,
    app: { artist } as never,
    changeKind: "full",
  };
}

function part(): SurfacePart {
  return {
    role: "primary",
    mesh: {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    },
  };
}

describe("DrawSurfaceModifier repaint policy", () => {
  it("paints geometry the first time it sees it", () => {
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", [part()]]])));

    expect(artist.paints).toBe(1);
    frame.free();
  });

  it("skips the repaint when the producer republishes the same array", () => {
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const fixed = [part()];
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));
    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));

    expect(artist.paints).toBe(1);
    frame.free();
  });

  it("repaints when the producer recomputed its geometry", () => {
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", [part()]]])));
    draw.apply(frame, context(artist, new Map([["producer-1", [part()]]])));

    expect(artist.paints).toBe(2);
    frame.free();
  });

  it("repaints after the artist dropped the layer", () => {
    // `artist.clear()` on a scene replace disposes surface layers without
    // telling this modifier; the skip must not survive that.
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const fixed = [part()];
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));
    artist.surfaceLayer("draw-1").dispose();
    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));

    expect(artist.paints).toBe(2);
    frame.free();
  });

  it("repaints after a style change", () => {
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const fixed = [part()];
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));
    draw.setStyle({ opacity: 0.25 });
    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));

    expect(artist.paints).toBe(2);
    frame.free();
  });

  it("clears the layer when its producer publishes nothing", () => {
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const fixed = [part()];
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));
    draw.apply(frame, context(artist, new Map()));

    expect(artist.surfaceLayer("draw-1").hasData).toBe(false);
    expect(artist.surfaceLayer("draw-1").disposals).toBe(1);
    frame.free();
  });

  it("repaints after the layer was cleared and the producer came back", () => {
    const artist = new FakeArtist();
    const draw = new DrawSurfaceModifier("draw-1", "producer-1");
    const fixed = [part()];
    const frame = new Frame();

    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));
    draw.apply(frame, context(artist, new Map()));
    draw.apply(frame, context(artist, new Map([["producer-1", fixed]])));

    expect(artist.paints).toBe(2);
    frame.free();
  });
});
