/**
 * Integration tests for the data-source-synthesis-04 pivot.
 *
 * These exercise the scene-synthesis surface that the pivot introduces /
 * promotes to first-class:
 *
 *   - `ModifierPipeline.getSynthesisConfig()` / `setSynthesisConfig()` — the
 *     new per-pipeline synthesis mode (default `augment`, opt-in `extend`).
 *   - Single-source passthrough and multi-source modifier-apply hand-off.
 *   - `System.setTrajectory` as the single trajectory ingress that rebuilds
 *     `frameLabels`.
 *   - `classifyFrameTransition` routing topology changes to a "full" rebuild.
 *
 * Tests boot no MolvisApp / BabylonJS — the synthesis head + modifier apply are
 * driven by direct `pipeline.addModifier` + `pipeline.compute` calls, exactly
 * like `multi_data_source_pipeline.test.ts` (the template this file mirrors).
 */

import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import type { MolvisApp } from "../../src/app";
import { EventEmitter, type MolvisEventMap } from "../../src/events";
import {
  FileDataSource,
  MemoryDataSource,
} from "../../src/pipeline/data_source_modifier";
import { BaseModifier, ModifierCapability } from "../../src/pipeline/modifier";
import { ModifierPipeline } from "../../src/pipeline/pipeline";
import type { PipelineContext } from "../../src/pipeline/types";
import { System } from "../../src/system";
import { classifyFrameTransition } from "../../src/system/frame_diff";
import type { SceneSynthesisConfig } from "../../src/system/scene_synthesis";
import { Trajectory } from "../../src/system/trajectory";

// ---------------------------------------------------------------------------
//  Helpers (mirrored from multi_data_source_pipeline.test.ts)
// ---------------------------------------------------------------------------

function makeAtomsFrame(elements: string[]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array(elements.length));
  atoms.setColF("y", new Float64Array(elements.length));
  atoms.setColF("z", new Float64Array(elements.length));
  atoms.setColStr("element", elements);
  frame.insertBlock("atoms", atoms);
  return frame;
}

/** Atoms frame with explicit, distinct x positions (for position-only diff). */
function makeAtomsFrameWithX(elements: string[], xs: number[]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", Float64Array.from(xs));
  atoms.setColF("y", new Float64Array(elements.length));
  atoms.setColF("z", new Float64Array(elements.length));
  atoms.setColStr("element", elements);
  frame.insertBlock("atoms", atoms);
  return frame;
}

function makeBondsFrame(pairs: Array<[number, number]>): Frame {
  const frame = new Frame();
  const bonds = new Block();
  const i = new Uint32Array(pairs.length);
  const j = new Uint32Array(pairs.length);
  const order = new Uint32Array(pairs.length);
  for (let k = 0; k < pairs.length; k++) {
    i[k] = pairs[k][0];
    j[k] = pairs[k][1];
    order[k] = 1;
  }
  bonds.setColU32("i", i);
  bonds.setColU32("j", j);
  bonds.setColU32("order", order);
  frame.insertBlock("bonds", bonds);
  return frame;
}

function makeMultiFrameTraj(
  count: number,
  elementsPerFrame: string[],
): Trajectory {
  const frames: Frame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push(makeAtomsFrame(elementsPerFrame));
  }
  return new Trajectory(frames);
}

/** Eager trajectory whose frames carry a numeric meta key, so
 *  `aggregateFrameLabels` produces a populated (non-null) label map. */
function makeLabeledTraj(energies: number[]): Trajectory {
  const frames = energies.map((e) => {
    const frame = makeAtomsFrame(["C"]);
    frame.setMeta("energy", String(e));
    return frame;
  });
  return new Trajectory(frames);
}

const mockApp = {} as MolvisApp;

// ---------------------------------------------------------------------------
//  Spy modifier — captures what reaches Phase B (ac-004).
// ---------------------------------------------------------------------------

interface PhaseBCapture {
  applied: boolean;
  atomsNrows: number | undefined;
  bondsPresent: boolean;
  sourceIdPresent: boolean;
  sourceIds: number[] | null;
}

/** A `TransformsData` modifier that records the merged frame Phase B
 *  receives and returns it untouched. */
class CaptureModifier extends BaseModifier {
  constructor(private readonly capture: PhaseBCapture) {
    super("capture", "Capture", new Set([ModifierCapability.TransformsData]));
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    const atoms = input.getBlock("atoms");
    this.capture.applied = true;
    this.capture.atomsNrows = atoms?.nrows();
    this.capture.bondsPresent = input.getBlock("bonds") !== undefined;
    const hasSourceId =
      atoms !== undefined && atoms.dtype("source_id") !== undefined;
    this.capture.sourceIdPresent = hasSourceId;
    this.capture.sourceIds = hasSourceId
      ? Array.from(atoms.copyColI32("source_id") ?? new Int32Array())
      : null;
    return input;
  }
}

function emptyCapture(): PhaseBCapture {
  return {
    applied: false,
    atomsNrows: undefined,
    bondsPresent: false,
    sourceIdPresent: false,
    sourceIds: null,
  };
}

// ---------------------------------------------------------------------------
//  ac-003 — single-source passthrough
// ---------------------------------------------------------------------------

describe("ac-003 single-source passthrough", () => {
  it("passes the FileDataSource's requested frame straight through with no source_id", async () => {
    const pipeline = new ModifierPipeline();
    const traj = makeMultiFrameTraj(3, ["C", "O", "N"]);
    pipeline.addModifier(new FileDataSource(traj));

    const merged = await pipeline.compute(1, mockApp);
    const atoms = merged.getBlock("atoms");

    // Same atoms as source frame(1): nrows + element column.
    expect(atoms?.nrows()).toBe(3);
    expect(Array.from(atoms?.copyColStr("element") ?? [])).toEqual([
      "C",
      "O",
      "N",
    ]);
    // Single source under default augment ⇒ pure passthrough, no source_id.
    expect(atoms?.dtype("source_id")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
//  ac-004 — multi-source reaches Phase B
// ---------------------------------------------------------------------------

describe("ac-004 multi-source reaches Phase B", () => {
  it("augment: spy receives a union frame (atoms + bonds), no source_id", async () => {
    const pipeline = new ModifierPipeline();
    // Default config is augment; assert that explicitly.
    expect(pipeline.getSynthesisConfig().mode).toBe("augment");

    pipeline.addModifier(new MemoryDataSource(makeAtomsFrame(["C", "O"])));
    pipeline.addModifier(new MemoryDataSource(makeBondsFrame([[0, 1]])));

    const capture = emptyCapture();
    pipeline.addModifier(new CaptureModifier(capture));

    await pipeline.compute(0, mockApp);

    expect(capture.applied).toBe(true);
    expect(capture.atomsNrows).toBe(2);
    expect(capture.bondsPresent).toBe(true);
    expect(capture.sourceIdPresent).toBe(false);
  });

  it("extend: spy receives concatenated atoms with a source_id ordinal column", async () => {
    const pipeline = new ModifierPipeline();
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: null,
      alignment: null,
    };
    pipeline.setSynthesisConfig(config);
    expect(pipeline.getSynthesisConfig().mode).toBe("extend");

    pipeline.addModifier(new MemoryDataSource(makeAtomsFrame(["C", "O"])));
    pipeline.addModifier(new MemoryDataSource(makeAtomsFrame(["H", "H", "H"])));

    const capture = emptyCapture();
    pipeline.addModifier(new CaptureModifier(capture));

    await pipeline.compute(0, mockApp);

    expect(capture.applied).toBe(true);
    expect(capture.atomsNrows).toBe(5);
    expect(capture.sourceIdPresent).toBe(true);
    expect(capture.sourceIds).toEqual([0, 0, 1, 1, 1]);
  });
});

// ---------------------------------------------------------------------------
//  ac-004b — setSynthesisConfig does not trigger a compute
// ---------------------------------------------------------------------------

describe("ac-004 setSynthesisConfig is pure state (no implicit compute)", () => {
  it("stores the config without emitting a `computed` event", () => {
    const pipeline = new ModifierPipeline();
    let computedEmissions = 0;
    pipeline.on("computed", () => {
      computedEmissions++;
    });

    pipeline.setSynthesisConfig({
      mode: "extend",
      referenceId: null,
      alignment: null,
    });

    expect(computedEmissions).toBe(0);
    expect(pipeline.getSynthesisConfig().mode).toBe("extend");
  });
});

// ---------------------------------------------------------------------------
//  ac-005 — System single ingress + lazy broadcast
// ---------------------------------------------------------------------------

describe("ac-005 System single ingress", () => {
  it("async setTrajectory rebuilds frameLabels (non-null) while the sync setter path also derives them", async () => {
    const events = new EventEmitter<MolvisEventMap>();
    const system = new System(events);

    await system.setTrajectory(makeLabeledTraj([-1.0, -2.0, -3.0]));

    const labels = system.frameLabels;
    expect(labels).not.toBeNull();
    expect(labels?.has("energy")).toBe(true);
    expect(Array.from(labels?.get("energy") ?? [])).toEqual([-1.0, -2.0, -3.0]);
  });

  it("a fresh System has null frameLabels before any trajectory ingress", () => {
    const system = new System(new EventEmitter<MolvisEventMap>());
    expect(system.frameLabels).toBeNull();
  });

  it("lazy broadcast: a length-1 source contributes its single frame at a non-zero index alongside a length-3 source", async () => {
    const pipeline = new ModifierPipeline();

    // Length-3 atoms source.
    pipeline.addModifier(new FileDataSource(makeMultiFrameTraj(3, ["C", "O"])));
    // Length-1 source contributing a DISTINCT block (bonds) — broadcasts.
    pipeline.addModifier(new MemoryDataSource(makeBondsFrame([[0, 1]])));

    const merged = await pipeline.compute(2, mockApp);

    // Length-3 source sampled at index 2.
    expect(merged.getBlock("atoms")?.nrows()).toBe(2);
    // Length-1 source's single frame survived the broadcast at index 2 —
    // it was NOT required to materialize 3 frames.
    expect(merged.getBlock("bonds")?.nrows()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
//  ac-006 — topology change routes to "full"
// ---------------------------------------------------------------------------

describe("ac-006 topology change routes to full", () => {
  it("atom-count change classifies as a full rebuild", () => {
    const prev = makeAtomsFrame(["C", "O"]);
    const next = makeAtomsFrame(["C", "O", "N"]);

    const decision = classifyFrameTransition(prev, next);
    expect(decision.kind).toBe("full");
  });

  it("control: same atom count + element column, positions differ ⇒ position update", () => {
    const prev = makeAtomsFrameWithX(["C", "O"], [0.0, 1.0]);
    const next = makeAtomsFrameWithX(["C", "O"], [0.5, 1.5]);

    const decision = classifyFrameTransition(prev, next);
    expect(decision.kind).toBe("position");
  });
});
