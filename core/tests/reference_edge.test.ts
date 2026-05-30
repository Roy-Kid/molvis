import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import type { MolvisApp } from "../src/app";
import { BaseModifier, ModifierCapability } from "../src/pipeline/modifier";
import { ModifierPipeline } from "../src/pipeline/pipeline";
import type { PipelineContext } from "../src/pipeline/types";
import { logger } from "../src/utils/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFrame(elements: string[]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array(elements.length));
  atoms.setColF("y", new Float64Array(elements.length));
  atoms.setColF("z", new Float64Array(elements.length));
  atoms.setColStr("element", elements);
  frame.insertBlock("atoms", atoms);
  return frame;
}

const mockApp = {} as MolvisApp;

/**
 * Read the tag carried by a branch frame: the first atom's element string.
 * Returns null if the frame has no atoms block / no rows.
 */
function readTag(frame: Frame): string | null {
  const atoms = frame.getBlock("atoms");
  if (atoms === undefined || atoms.nrows() === 0) {
    return null;
  }
  const elements = atoms.copyColStr("element");
  return elements[0] ?? null;
}

/**
 * A branch modifier that emits a NEW frame whose first element is set to a
 * recognizable tag derived from its own id. Lets a downstream consumer
 * identify which branch's output it read out of the frameCache.
 *
 * TransformsData capability + returns a fresh Frame (immutability).
 */
class BranchTagModifier extends BaseModifier {
  constructor(id: string) {
    super(id, "BranchTag", new Set([ModifierCapability.TransformsData]));
  }

  apply(_input: Frame, _context: PipelineContext): Frame {
    // Fresh, deterministic frame tagged with this modifier's id.
    return makeFrame([`tag:${this.id}`, "C", "O"]);
  }
}

/**
 * A consumer that, for each id in its referencedIds, reads the referenced
 * frame out of context.frameCache and records presence + the tag it carried.
 * Returns its input unchanged.
 */
class ReferenceConsumerSpy extends BaseModifier {
  public seen: Record<string, boolean> = {};
  public seenTags: Record<string, string | null> = {};

  constructor(id: string) {
    super(
      id,
      "ReferenceConsumerSpy",
      new Set([ModifierCapability.ConsumesSelection]),
    );
  }

  apply(input: Frame, context: PipelineContext): Frame {
    this.seen = {};
    this.seenTags = {};
    for (const refId of this.referencedIds) {
      const referenced = context.frameCache.get(refId);
      this.seen[refId] = referenced !== undefined;
      this.seenTags[refId] =
        referenced !== undefined ? readTag(referenced) : null;
    }
    return input;
  }
}

/**
 * Replace logger.warn with a recording stub for the duration of `fn`,
 * restoring the original afterwards. Returns the captured call count.
 */
async function withWarnSpy(
  fn: () => Promise<void>,
): Promise<{ callCount: number }> {
  const original = logger.warn;
  let callCount = 0;
  (logger as { warn: (...args: unknown[]) => void }).warn = (
    ..._args: unknown[]
  ): void => {
    callCount += 1;
  };
  try {
    await fn();
  } finally {
    (logger as { warn: typeof original }).warn = original;
  }
  return { callCount };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reference edge feature", () => {
  // ac-001 -----------------------------------------------------------------
  it("ac-001: BaseModifier subclass has referencedIds === [] by default", () => {
    const branch = new BranchTagModifier("_");
    expect(branch.referencedIds).toEqual([]);
  });

  // ac-002 -----------------------------------------------------------------
  it("ac-002: createDefaultContext initializes an empty frameCache Map", async () => {
    const pipeline = new ModifierPipeline();
    const branch = new BranchTagModifier("_");
    pipeline.addModifier(branch);

    let capturedCtx: PipelineContext | null = null;
    pipeline.on("computed", ({ context }) => {
      capturedCtx = context;
    });

    await pipeline.compute(0, mockApp, "full", makeFrame(["C", "O", "N"]));

    expect(capturedCtx).not.toBeNull();
    const ctx = capturedCtx as PipelineContext | null;
    expect(ctx?.frameCache).toBeInstanceOf(Map);
    // frameCache starts empty (createDefaultContext seeds size 0).
    expect(ctx?.frameCache.size).toBe(0);
  });

  // ac-003 -----------------------------------------------------------------
  it("ac-003: consumer reads referenced branch output from frameCache", async () => {
    const pipeline = new ModifierPipeline();

    const branch = new BranchTagModifier("_");
    pipeline.addModifier(branch);
    const branchId = branch.id;

    const consumer = new ReferenceConsumerSpy("_");
    consumer.referencedIds = [branchId];
    pipeline.addModifier(consumer);

    await pipeline.compute(0, mockApp, "full", makeFrame(["C", "O", "N"]));

    expect(consumer.seen[branchId]).toBe(true);
    expect(consumer.seenTags[branchId]).toBe(`tag:${branchId}`);
  });

  // ac-004 -----------------------------------------------------------------
  it("ac-004: consumer does not observe a branch outside its referencedIds", async () => {
    const pipeline = new ModifierPipeline();

    const branchA = new BranchTagModifier("_");
    pipeline.addModifier(branchA);
    const branchAId = branchA.id;

    const branchB = new BranchTagModifier("_");
    pipeline.addModifier(branchB);
    const branchBId = branchB.id;

    const consumer = new ReferenceConsumerSpy("_");
    consumer.referencedIds = [branchAId];
    pipeline.addModifier(consumer);

    await pipeline.compute(0, mockApp, "full", makeFrame(["C", "O", "N"]));

    expect(consumer.seen[branchAId]).toBe(true);
    expect(consumer.seenTags[branchAId]).toBe(`tag:${branchAId}`);
    // branchB was never referenced — consumer must not have recorded it.
    expect(consumer.seen[branchBId]).toBeUndefined();
    expect(consumer.seenTags[branchBId]).toBeUndefined();
  });

  // ac-005 -----------------------------------------------------------------
  it("ac-005: setReferences(x, [x]) is rejected (self-reference)", () => {
    const pipeline = new ModifierPipeline();

    const x = new BranchTagModifier("_");
    pipeline.addModifier(x);
    const xId = x.id;

    const ok = pipeline.setReferences(xId, [xId]);

    expect(ok).toBe(false);
    expect(x.referencedIds).toEqual([]);
  });

  // ac-006 -----------------------------------------------------------------
  it("ac-006: setReferences rejecting a cycle leaves referencedIds untouched", () => {
    const pipeline = new ModifierPipeline();

    const x = new BranchTagModifier("_");
    pipeline.addModifier(x);
    const xId = x.id;

    const y = new BranchTagModifier("_");
    pipeline.addModifier(y);
    const yId = y.id;

    expect(pipeline.setReferences(xId, [yId])).toBe(true);
    // x -> y already; y -> x would close a cycle.
    expect(pipeline.setReferences(yId, [xId])).toBe(false);
    expect(y.referencedIds).toEqual([]);
  });

  // ac-007 -----------------------------------------------------------------
  it("ac-007: setReferences with a dangling id is rejected", () => {
    const pipeline = new ModifierPipeline();

    const x = new BranchTagModifier("_");
    pipeline.addModifier(x);
    const xId = x.id;

    const ok = pipeline.setReferences(xId, ["nonexistent-id"]);

    expect(ok).toBe(false);
    expect(x.referencedIds).toEqual([]);
  });

  // ac-008 -----------------------------------------------------------------
  it("ac-008: disabled referenced branch is absent and logs a warning", async () => {
    const pipeline = new ModifierPipeline();

    const branch = new BranchTagModifier("_");
    branch.enabled = false;
    pipeline.addModifier(branch);
    const branchId = branch.id;

    const consumer = new ReferenceConsumerSpy("_");
    consumer.referencedIds = [branchId];
    pipeline.addModifier(consumer);

    const { callCount } = await withWarnSpy(async () => {
      await pipeline.compute(0, mockApp, "full", makeFrame(["C", "O", "N"]));
    });

    expect(consumer.seen[branchId]).toBe(false);
    expect(callCount).toBeGreaterThan(0);
  });

  // ac-009 -----------------------------------------------------------------
  it("ac-009: removing a referenced branch auto-drops the ref, keeping the consumer", () => {
    const pipeline = new ModifierPipeline();

    const branch = new BranchTagModifier("_");
    pipeline.addModifier(branch);
    const branchId = branch.id;

    const consumer = new ReferenceConsumerSpy("_");
    consumer.referencedIds = [branchId];
    pipeline.addModifier(consumer);
    const consumerId = consumer.id;

    pipeline.removeModifier(branchId);

    const survivors = pipeline.getModifiers();
    expect(survivors.some((m) => m.id === consumerId)).toBe(true);
    expect(consumer.referencedIds).not.toContain(branchId);
  });

  // ac-010a ----------------------------------------------------------------
  it("ac-010a: branch BEFORE consumer in array order is visible", async () => {
    const pipeline = new ModifierPipeline();

    const branch = new BranchTagModifier("_");
    pipeline.addModifier(branch);
    const branchId = branch.id;

    const consumer = new ReferenceConsumerSpy("_");
    consumer.referencedIds = [branchId];
    pipeline.addModifier(consumer);

    await pipeline.compute(0, mockApp, "full", makeFrame(["C", "O", "N"]));

    expect(consumer.seen[branchId]).toBe(true);
    expect(consumer.seenTags[branchId]).toBe(`tag:${branchId}`);
  });

  // ac-010b ----------------------------------------------------------------
  it("ac-010b: branch AFTER consumer (forward ref) is absent and warns", async () => {
    const pipeline = new ModifierPipeline();

    // Consumer added FIRST, branch added SECOND → branch runs after consumer.
    const consumer = new ReferenceConsumerSpy("_");
    pipeline.addModifier(consumer);

    const branch = new BranchTagModifier("_");
    pipeline.addModifier(branch);
    const branchId = branch.id;

    // Set the reference after both exist so setReferences validation passes.
    consumer.referencedIds = [branchId];

    const { callCount } = await withWarnSpy(async () => {
      await pipeline.compute(0, mockApp, "full", makeFrame(["C", "O", "N"]));
    });

    expect(consumer.seen[branchId]).toBe(false);
    expect(callCount).toBeGreaterThan(0);
  });
});
