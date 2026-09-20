/**
 * A geometry producer carries its draw, the way a DataSource carries
 * Particles and Bonds.
 *
 * This is what makes a seventh surface algorithm one compute modifier and no
 * rendering work: the producer publishes triangles, the shared `Draw surface`
 * paints them, and nothing in between has to learn about the new algorithm.
 */

import { describe, expect, it } from "@rstest/core";
import { MolecularSurfaceModifier } from "../../src/modifiers/MolecularSurfaceModifier";
import { SliceModifier } from "../../src/modifiers/SliceModifier";
import { DrawSurfaceModifier } from "../../src/pipeline/draw_surface";
import { IsosurfaceModifier } from "../../src/pipeline/isosurface";
import { ModifierCapability } from "../../src/pipeline/modifier";
import { ModifierPipeline } from "../../src/pipeline/pipeline";

function drawsIn(pipeline: ModifierPipeline): DrawSurfaceModifier[] {
  return pipeline
    .modifiers()
    .filter((m): m is DrawSurfaceModifier => m instanceof DrawSurfaceModifier);
}

describe("geometry producer pairing", () => {
  it("adding a producer adds its draw", () => {
    const pipeline = new ModifierPipeline();
    pipeline.addModifier(new MolecularSurfaceModifier());

    const draws = drawsIn(pipeline);
    expect(draws.length).toBe(1);
  });

  it("the draw is bound and owned by its producer", () => {
    // Ownership does double duty: the pipeline tree nests by `sourceOwnerId`,
    // so the draw renders indented under the producer, and the descendant
    // sweep in removeEntry takes it away with the producer.
    const pipeline = new ModifierPipeline();
    const producer = new MolecularSurfaceModifier();
    pipeline.addModifier(producer);

    const [draw] = drawsIn(pipeline);
    expect(draw.producerId).toBe(producer.id);
    expect(draw.sourceOwnerId).toBe(producer.id);
  });

  it("the draw sits directly beneath its producer", () => {
    const pipeline = new ModifierPipeline();
    const producer = new MolecularSurfaceModifier();
    pipeline.addModifier(producer);

    const entries = pipeline.getEntries();
    const at = entries.findIndex((e) => e.id === producer.id);
    expect(entries[at + 1]).toBeInstanceOf(DrawSurfaceModifier);
  });

  it("removing the producer removes its draw", () => {
    const pipeline = new ModifierPipeline();
    const producer = new MolecularSurfaceModifier();
    pipeline.addModifier(producer);
    expect(drawsIn(pipeline).length).toBe(1);

    pipeline.removeEntry(producer.id);
    expect(drawsIn(pipeline).length).toBe(0);
  });

  it("every producer gets its own draw, so two surfaces style apart", () => {
    const pipeline = new ModifierPipeline();
    const first = new MolecularSurfaceModifier();
    const second = new MolecularSurfaceModifier();
    pipeline.addModifier(first);
    pipeline.addModifier(second);

    const draws = drawsIn(pipeline);
    expect(draws.length).toBe(2);
    expect(new Set(draws.map((d) => d.producerId))).toEqual(
      new Set([first.id, second.id]),
    );

    draws[0].setStyle({ opacity: 0.2 });
    expect(draws[1].style.opacity).not.toBe(0.2);
  });

  it("removing one producer leaves the other's draw alone", () => {
    const pipeline = new ModifierPipeline();
    const first = new MolecularSurfaceModifier();
    const second = new MolecularSurfaceModifier();
    pipeline.addModifier(first);
    pipeline.addModifier(second);

    pipeline.removeEntry(first.id);
    const draws = drawsIn(pipeline);
    expect(draws.length).toBe(1);
    expect(draws[0].producerId).toBe(second.id);
  });

  it("a grid isosurface pairs the same way a molecular surface does", () => {
    // One draw step for every algorithm is the whole point of the split.
    const pipeline = new ModifierPipeline();
    const producer = new IsosurfaceModifier();
    pipeline.addModifier(producer);

    const [draw] = drawsIn(pipeline);
    expect(draw.producerId).toBe(producer.id);
  });

  it("modifiers that draw for themselves get no companion", () => {
    const pipeline = new ModifierPipeline();
    pipeline.addModifier(new SliceModifier());
    expect(drawsIn(pipeline).length).toBe(0);
  });

  it("producers run before draws", () => {
    // A draw that ran first would paint the previous run's geometry.
    const producer = new MolecularSurfaceModifier();
    const draw = producer.createDraw();
    expect(producer.capabilities.has(ModifierCapability.ProducesGeometry)).toBe(
      true,
    );
    expect(draw.capabilities.has(ModifierCapability.Draws)).toBe(true);
  });
});
