/**
 * RPC router — `scene.set_synthesis` surface (data-source-synthesis-05).
 *
 * Module under test:
 *   `core/src/transport/rpc/router.ts` — `RPCRouter`
 *
 * Dispatch shape (verbatim, as used here):
 *   const router = new RPCRouter(app);
 *   const res = await router.execute({ jsonrpc: "2.0", id: 1, method, params });
 *   // res.content is a JsonRPCResponse: { jsonrpc, id, result?, error? }
 *
 * The `scene.set_synthesis` handler does NOT exist yet, so requests that
 * invoke it currently route to MethodNotFound (-32601). These tests are RED
 * until the handler is registered and wired to
 * `app.modifierPipeline.setSynthesisConfig(...)` + `app.applyPipeline({ fullRebuild: true })`.
 *
 * Mock app: a minimal object exposing a REAL `ModifierPipeline` (so
 * getSynthesisConfig/setSynthesisConfig behave for real) and a hand-rolled
 * typed spy for `applyPipeline`. No full MolvisApp boot (would need BabylonJS).
 *
 * Wire params are snake_case (`reference_id`, `mass_weight`); config fields
 * are camelCase (`referenceId`, `massWeight`). Determinism: literal fixtures
 * only — no clock, no RNG.
 *
 * Acceptance criteria: ac-002, ac-003, ac-004, ac-005, ac-006, ac-008.
 */

import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import type { MolvisApp } from "../src/app";
import {
  DataSourceModifier,
  FileDataSource,
  MemoryDataSource,
} from "../src/pipeline/data_source_modifier";
import { ModifierPipeline } from "../src/pipeline/pipeline";
import type { SceneSynthesisConfig } from "../src/system/scene_synthesis";
import type { Trajectory } from "../src/system/trajectory";
import { RPCRouter } from "../src/transport/rpc/router";
import type {
  JsonRPCResponse,
  SerializedFrameData,
} from "../src/transport/rpc/types";

/** Build an atoms-only Frame at the origin with `count` carbons. */
function makeAtomsFrame(count: number): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array(count));
  atoms.setColF("y", new Float64Array(count));
  atoms.setColF("z", new Float64Array(count));
  atoms.setColStr("element", new Array(count).fill("C"));
  frame.insertBlock("atoms", atoms);
  return frame;
}

/**
 * The wire `frame` payload `scene.draw_frame` / `scene.set_trajectory` decode:
 * a JSON {@link SerializedFrameData} with an atoms block carrying plain
 * number/string column arrays. `decodeBinaryPayload` passes these through
 * unchanged (no `__molvis_buffer__` markers → JSON-only path), then
 * `buildFrame` lands them in molrs. Element strings stay an `f64`-free string
 * column; coordinates are distinct per frame so the passthrough assertion can
 * tell frame[0] from frame[1].
 */
function serializedFrame(
  elements: ReadonlyArray<string>,
  baseX: number,
): SerializedFrameData {
  const n = elements.length;
  return {
    blocks: {
      atoms: {
        x: Array.from({ length: n }, (_v, i) => baseX + i + 0.5),
        y: Array.from({ length: n }, () => 0.25),
        z: Array.from({ length: n }, () => 0.75),
        element: [...elements],
      },
    },
  };
}

// ── Mock app / spy harness ──────────────────────────────────────────────────

interface ApplyPipelineOptions {
  fullRebuild?: boolean;
}

interface ApplyPipelineSpy {
  (options?: ApplyPipelineOptions): Promise<null>;
  calls: ReadonlyArray<ApplyPipelineOptions | undefined>;
}

function makeApplyPipelineSpy(): ApplyPipelineSpy {
  const calls: Array<ApplyPipelineOptions | undefined> = [];
  const spy = (options?: ApplyPipelineOptions): Promise<null> => {
    calls.push(options);
    return Promise.resolve(null);
  };
  (spy as ApplyPipelineSpy).calls = calls;
  return spy as ApplyPipelineSpy;
}

interface SynthesisHarness {
  router: RPCRouter;
  pipeline: ModifierPipeline;
  applyPipeline: ApplyPipelineSpy;
}

/**
 * Build a router over a stub app exposing only what `scene.set_synthesis`
 * touches: a real `ModifierPipeline` (as `modifierPipeline`) and a spied
 * `applyPipeline`. Everything else on MolvisApp is intentionally absent —
 * the cast narrows the surface this test depends on.
 */
function makeHarness(): SynthesisHarness {
  const pipeline = new ModifierPipeline();
  const applyPipeline = makeApplyPipelineSpy();
  const app = {
    modifierPipeline: pipeline,
    applyPipeline,
  } as unknown as MolvisApp;
  const router = new RPCRouter(app);
  return { router, pipeline, applyPipeline };
}

interface BackCompatHarness {
  router: RPCRouter;
  pipeline: ModifierPipeline;
  applyPipeline: ApplyPipelineSpy;
  app: MolvisApp;
}

/**
 * Harness for the back-compat `scene.draw_frame` / `scene.set_trajectory`
 * passthrough (ac-008). These handlers touch more of `app` than
 * `scene.set_synthesis`: `setTrajectory` (async pipeline sync),
 * `applyPipeline`, and `world.resetCamera`. The mock `setTrajectory` mirrors
 * `app.ts` minimally — drop any existing DataSourceModifier, then install a
 * `FileDataSource` wrapping the pushed trajectory — so a subsequent
 * `pipeline.compute` runs the SAME single-source synthesis passthrough the
 * live app feeds. `world.resetCamera` is a no-op; `frame` is left absent
 * (no `options` in the payload → `manualAtomRadii` is null → that branch is
 * skipped). System/frameLabels are not needed for the passthrough assertion.
 */
function makeBackCompatHarness(): BackCompatHarness {
  const pipeline = new ModifierPipeline();
  const applyPipeline = makeApplyPipelineSpy();
  const setTrajectory = async (traj: Trajectory): Promise<void> => {
    for (const m of pipeline.getModifiers()) {
      if (m instanceof DataSourceModifier) {
        pipeline.removeModifier(m.id);
      }
    }
    pipeline.addModifier(new FileDataSource(traj));
  };
  const app = {
    modifierPipeline: pipeline,
    applyPipeline,
    setTrajectory,
    world: { resetCamera: (): void => {} },
    // sessionLabel() reads system.trajectory?.length to size the DS label;
    // an undefined trajectory yields the bare "backend" label (frame count 0).
    system: { trajectory: undefined },
  } as unknown as MolvisApp;
  const router = new RPCRouter(app);
  return { router, pipeline, applyPipeline, app };
}

function dispatch(
  router: RPCRouter,
  method: string,
  params: Record<string, unknown>,
): Promise<JsonRPCResponse> {
  return router
    .execute({ jsonrpc: "2.0", id: 1, method, params })
    .then((envelope) => envelope.content);
}

const InvalidParams = -32602;
const MethodNotFound = -32601;

// ── Tests ───────────────────────────────────────────────────────────────────

describe("RPCRouter scene.set_synthesis (data-source-synthesis-05)", () => {
  it("ac-002: pipeline.set_references is gone → MethodNotFound (-32601)", async () => {
    const { router } = makeHarness();
    const res = await dispatch(router, "pipeline.set_references", {});
    expect(res.error?.code).toBe(MethodNotFound);
    expect(res.result).toBeUndefined();
  });

  it("ac-003: valid extend payload writes the synthesis config (snake→camel)", async () => {
    const { router, pipeline } = makeHarness();
    const res = await dispatch(router, "scene.set_synthesis", {
      mode: "extend",
      reference_id: "ds-1",
      alignment: { enabled: true, mass_weight: true },
    });
    expect(res.error).toBeUndefined();

    const config: SceneSynthesisConfig = pipeline.getSynthesisConfig();
    expect(config.mode).toBe("extend");
    expect(config.referenceId).toBe("ds-1");
    expect(config.alignment?.enabled).toBe(true);
    expect(config.alignment?.massWeight).toBe(true);
  });

  it("ac-004: a valid set_synthesis triggers exactly one full-rebuild applyPipeline", async () => {
    const { router, applyPipeline } = makeHarness();
    await dispatch(router, "scene.set_synthesis", {
      mode: "augment",
      reference_id: null,
    });
    expect(applyPipeline.calls.length).toBe(1);
    expect(applyPipeline.calls[0]).toEqual({ fullRebuild: true });
  });

  it("ac-005: bad mode → invalidParams, config untouched, no rebuild", async () => {
    const { router, pipeline, applyPipeline } = makeHarness();
    const before = pipeline.getSynthesisConfig().mode;

    const res = await dispatch(router, "scene.set_synthesis", {
      mode: "bogus",
    });
    expect(res.error?.code).toBe(InvalidParams);
    expect(pipeline.getSynthesisConfig().mode).toBe(before);
    expect(applyPipeline.calls.length).toBe(0);
  });

  it("ac-005: non-boolean alignment.enabled → invalidParams, config untouched, no rebuild", async () => {
    const { router, pipeline, applyPipeline } = makeHarness();
    const before = pipeline.getSynthesisConfig();

    const res = await dispatch(router, "scene.set_synthesis", {
      alignment: { enabled: "yes", mass_weight: true },
    });
    expect(res.error?.code).toBe(InvalidParams);
    const after = pipeline.getSynthesisConfig();
    expect(after.mode).toBe(before.mode);
    expect(after.referenceId).toBe(before.referenceId);
    expect(after.alignment).toBe(before.alignment);
    expect(applyPipeline.calls.length).toBe(0);
  });

  it("ac-006: reference_id: null clears a previously-set reference", async () => {
    const { router, pipeline } = makeHarness();

    const first = await dispatch(router, "scene.set_synthesis", {
      reference_id: "ds-9",
    });
    expect(first.error).toBeUndefined();
    expect(pipeline.getSynthesisConfig().referenceId).toBe("ds-9");

    const second = await dispatch(router, "scene.set_synthesis", {
      reference_id: null,
    });
    expect(second.error).toBeUndefined();
    expect(pipeline.getSynthesisConfig().referenceId).toBe(null);
  });

  // ac-008: the back-compat bar. A single `scene.draw_frame` (one frame) and a
  // single-source `scene.set_trajectory` (N frames) must each land in the
  // synthesis head as a ZERO-CONFIG passthrough: the merged frame is
  // atom-for-atom equal to the decoded input, with NO `source_id` column
  // added — and each handler drives exactly one full-rebuild applyPipeline.
  it("ac-008: scene.draw_frame is an atom-for-atom passthrough (no source_id, full rebuild)", async () => {
    const { router, pipeline, applyPipeline, app } = makeBackCompatHarness();
    // Default synthesis mode is augment — do NOT call set_synthesis.
    expect(pipeline.getSynthesisConfig().mode).toBe("augment");

    const res = await dispatch(router, "scene.draw_frame", {
      frame: serializedFrame(["C", "O", "N"], 0),
    });
    expect(res.error).toBeUndefined();
    expect(applyPipeline.calls.length).toBe(1);
    expect(applyPipeline.calls[0]).toEqual({ fullRebuild: true });

    const merged = await pipeline.compute(0, app);
    const atoms = merged.getBlock("atoms");
    expect(atoms?.nrows()).toBe(3);
    expect(atoms?.copyColStr("element")).toEqual(["C", "O", "N"]);
    expect(Array.from(atoms?.copyColF("x") ?? [])).toEqual([0.5, 1.5, 2.5]);
    // Passthrough: a single source adds no provenance column.
    expect(atoms?.dtype("source_id")).toBeUndefined();
  });

  it("ac-008: scene.set_trajectory (single source, N frames) passes each frame through unchanged", async () => {
    const { router, pipeline, applyPipeline, app } = makeBackCompatHarness();
    expect(pipeline.getSynthesisConfig().mode).toBe("augment");

    // Two frames from one source: distinct element sets + distinct coordinates.
    const res = await dispatch(router, "scene.set_trajectory", {
      frames: [
        serializedFrame(["C", "O"], 0),
        serializedFrame(["N", "F", "S"], 10),
      ],
    });
    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({ success: true, nFrames: 2 });
    expect(applyPipeline.calls.length).toBe(1);
    expect(applyPipeline.calls[0]).toEqual({ fullRebuild: true });

    // Frame 1 of the trajectory must come back atom-for-atom, no source_id.
    const merged = await pipeline.compute(1, app);
    const atoms = merged.getBlock("atoms");
    expect(atoms?.nrows()).toBe(3);
    expect(atoms?.copyColStr("element")).toEqual(["N", "F", "S"]);
    expect(Array.from(atoms?.copyColF("x") ?? [])).toEqual([10.5, 11.5, 12.5]);
    expect(atoms?.dtype("source_id")).toBeUndefined();
  });

  // Approach (b): the binary `frame` wire payload that scene.add_data_source
  // decodes (decodeBinaryPayload + buildFrame) is brittle to hand-assemble in a
  // stub, so we add the two sources directly to the REAL pipeline as
  // MemoryDataSources, then drive the synthesis MODE through the RPC router
  // (scene.set_synthesis extend) — exercising the RPC config path — and let
  // `pipeline.compute` run the same synthesis head the live add_data_source
  // path feeds. That still verifies ac-007's substance: the RPC-configured
  // extend mode drives compute to emit a source_id column distinguishing the
  // two sources. source_id values asserted: [0, 0, 1] (2-atom source A + 1-atom
  // source B).
  it("ac-007: extend over two added sources yields a merged frame with source_id", async () => {
    const { router, pipeline } = makeHarness();
    const app = { modifierPipeline: pipeline } as unknown as MolvisApp;

    // Primary source: 2 atoms; second source: 1 atom (added under extend).
    pipeline.addModifier(new MemoryDataSource(makeAtomsFrame(2)));
    pipeline.addModifier(new MemoryDataSource(makeAtomsFrame(1)));

    const res = await dispatch(router, "scene.set_synthesis", {
      mode: "extend",
      reference_id: null,
    });
    expect(res.error).toBeUndefined();
    expect(pipeline.getSynthesisConfig().mode).toBe("extend");

    const merged = await pipeline.compute(0, app);
    const atoms = merged.getBlock("atoms");
    expect(atoms?.nrows()).toBe(3);

    const sourceId = atoms?.copyColI32("source_id");
    expect(Array.from(sourceId ?? new Int32Array())).toEqual([0, 0, 1]);
  });
});
