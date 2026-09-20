/**
 * Replaying a saved pipeline must not grow it.
 *
 * `addModifier` pairs a geometry producer with a `Draw surface`. Project load
 * and backend state-sync replay a saved list *verbatim* — that list already
 * holds each producer's draw — so pairing there would add a second one on
 * every round trip, and the extra one would point at an id from the file that
 * no longer exists: a permanently dead row.
 */

import { describe, expect, it } from "@rstest/core";
import { MolecularSurfaceModifier } from "../../src/modifiers/MolecularSurfaceModifier";
import { DrawSurfaceModifier } from "../../src/pipeline/draw_surface";
import { ModifierPipeline } from "../../src/pipeline/pipeline";

function drawsIn(pipeline: ModifierPipeline): DrawSurfaceModifier[] {
  return pipeline
    .modifiers()
    .filter((m): m is DrawSurfaceModifier => m instanceof DrawSurfaceModifier);
}

describe("surface pipeline replay", () => {
  it("attachDraw: false leaves the caller to supply the draw", () => {
    const pipeline = new ModifierPipeline();
    pipeline.addModifier(new MolecularSurfaceModifier(), {
      attachDraw: false,
    });
    expect(drawsIn(pipeline).length).toBe(0);
  });

  it("a verbatim replay reproduces the pipeline exactly once", () => {
    // What project load does: producer, then the draw that was saved with it.
    const live = new ModifierPipeline();
    live.addModifier(new MolecularSurfaceModifier());
    expect(drawsIn(live).length).toBe(1);

    const replayed = new ModifierPipeline();
    const replayedProducer = new MolecularSurfaceModifier();
    replayed.addModifier(replayedProducer, { attachDraw: false });
    replayed.addModifier(
      new DrawSurfaceModifier("draw-surface", replayedProducer.id),
      { attachDraw: false },
    );

    expect(drawsIn(replayed).length).toBe(1);
    expect(drawsIn(replayed)[0].producerId).toBe(replayedProducer.id);
  });

  it("the default still pairs, so ordinary adds are unaffected", () => {
    const pipeline = new ModifierPipeline();
    pipeline.addModifier(new MolecularSurfaceModifier());
    expect(drawsIn(pipeline).length).toBe(1);
  });

  it("a draw round-trips its appearance and its producer link", () => {
    // Without the link a restored draw paints nothing; without the style it
    // comes back default blue, which is the persistence bug the producer
    // already fixed for itself.
    const saved = new DrawSurfaceModifier("draw-surface", "Alpha");
    saved.setStyle({
      color: [0.1, 0.2, 0.3],
      opacity: 0.25,
      finish: "contour",
      contourSpacing: 1.5,
    });

    const restored = new DrawSurfaceModifier();
    restored.fromProjectParams(saved.toProjectParams());

    expect(restored.producerId).toBe("Alpha");
    expect(restored.style.color).toEqual([0.1, 0.2, 0.3]);
    expect(restored.style.opacity).toBeCloseTo(0.25, 6);
    expect(restored.style.finish).toBe("contour");
    expect(restored.style.contourSpacing).toBeCloseTo(1.5, 6);
  });

  it("a junk record leaves the draw at its defaults", () => {
    const mod = new DrawSurfaceModifier();
    const before = mod.style;
    mod.fromProjectParams({
      producerId: 42,
      color: "blue",
      opacity: null,
      finish: "glitter",
    });

    expect(mod.producerId).toBeNull();
    expect(mod.style.finish).toBe(before.finish);
    expect(mod.style.opacity).toBe(before.opacity);
    expect(mod.style.color).toEqual(before.color);
  });
});
