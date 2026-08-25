import { NullEngine } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import type { MolvisApp } from "../../src/app";
import { EventEmitter, type MolvisEventMap } from "../../src/events";
import { loadFileContent, loadFileStream } from "../../src/io";
import { ModifierPipeline } from "../../src/pipeline/pipeline";
import { MolvisRenderer } from "../../src/renderer";
import { SceneSession, type SceneSessionHost } from "../../src/scene_session";
import { System } from "../../src/system";
import { composeSources } from "../../src/system/source_composition";
import { buildMultiDcd } from "../fixtures/dcd";

/** Real System + pipeline + a thin SceneSession-backed host; stub the rest. */
function fakeApp(): {
  app: unknown;
  system: System;
  pipeline: ModifierPipeline;
} {
  const events = new EventEmitter<MolvisEventMap>();
  const system = new System(events);
  const pipeline = new ModifierPipeline();
  const host: SceneSessionHost = {
    artist: { clear: () => {} } as SceneSessionHost["artist"],
    commandManager: {
      clearHistory: () => {},
    } as SceneSessionHost["commandManager"],
    pipeline,
    system,
    isRunning: () => true,
    setFrameIndex: () => {},
    clearLastRenderedFrame: () => {},
    renderActiveTrajectoryFrame: async () => {},
    applyPipeline: async () => null,
  };
  const session = new SceneSession(host);
  const app = {
    modifierPipeline: pipeline,
    system,
    events,
    addDataSource: (ds: unknown) => session.addDataSource(ds as never),
    replaceScene: (traj: unknown, meta?: unknown) =>
      session.replaceScene(traj as never, meta as never),
    applyPipeline: host.applyPipeline,
    world: { fit: () => {} },
    setMode: () => {},
  };
  return { app, system, pipeline };
}

/**
 * Multi-frame DCD bytes: 3 atoms, coordinates only (no `id` column), so
 * composition against the `.data` topology falls back to row order.
 */
function dcdBytes(seeds: number[]): Uint8Array {
  return buildMultiDcd(seeds, { atomCount: 3, withId: false });
}

describe("loadFileContent data -> dcd augment", () => {
  it("promotes System and advances composed coords through seek", async () => {
    const data = `LAMMPS data file via molvis test

3 atoms
1 atom types

0.0 10.0 xlo xhi
0.0 10.0 ylo yhi
0.0 10.0 zlo zhi

Masses

1 12.0

Atoms # atomic

3 1 1.0 2.0 3.0
1 1 4.0 5.0 6.0
2 1 7.0 8.0 9.0
`;
    const { app, system, pipeline } = fakeApp();

    await loadFileContent(
      app as unknown as MolvisApp,
      data,
      "sys.data",
      "lammps",
      "replace",
    );
    expect(system.trajectory.indexedLength).toBe(1);

    const bytes = dcdBytes([0, 1, 2]);
    await loadFileContent(
      app as unknown as MolvisApp,
      bytes,
      "sys.dcd",
      "dcd",
      "augment",
    );

    expect(system.trajectory.indexedLength).toBe(3);

    const sources = pipeline.sources().map((s) => ({
      id: s.id,
      trajectory: s.trajectory,
    }));

    const ok1 = await system.seekFrame(1);
    expect(ok1).toBe(true);
    const composed1 = await composeSources(
      sources,
      system.trajectory.currentIndex,
    );
    const x1 = composed1.getBlock("atoms")?.viewColF("x");
    // data row 1 is atom id 1 -> DCD row 0 x = seed + 0*0.1 = 1 at frame 1
    expect(x1?.[1]).toBeCloseTo(1, 5);

    const ok2 = await system.seekFrame(2);
    expect(ok2).toBe(true);
    const composed2 = await composeSources(
      sources,
      system.trajectory.currentIndex,
    );
    const x2 = composed2.getBlock("atoms")?.viewColF("x");
    expect(x2?.[1]).toBeCloseTo(2, 5);
  });
});

const LAMMPS_DATA = `LAMMPS data file via molvis test

3 atoms
1 atom types

0.0 10.0 xlo xhi
0.0 10.0 ylo yhi
0.0 10.0 zlo zhi

Masses

1 12.0

Atoms # atomic

3 1 1.0 2.0 3.0
1 1 4.0 5.0 6.0
2 1 7.0 8.0 9.0
`;

describe("running app data+dcd seek updates GPU positions", () => {
  it("applyPipeline follows System playhead after seekFrame", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    const app = renderer.app;
    try {
      await app.start();
      await loadFileContent(app, LAMMPS_DATA, "sys.data", "lammps", "replace");
      await loadFileContent(
        app,
        dcdBytes([0, 1, 2]),
        "sys.dcd",
        "dcd",
        "augment",
      );

      await app.system.seekFrame(1);
      expect(app.system.trajectory.currentIndex).toBe(1);
      const composed = await app.applyPipeline({ changeKind: "full" });
      const x = composed?.getBlock("atoms")?.viewColF("x");
      // Playhead is System.currentIndex. A stale MolvisApp._currentFrame
      // must not keep composing frame 0 after the trajectory has moved.
      expect(x?.[1]).toBeCloseTo(1, 5);
    } finally {
      renderer.dispose();
    }
  });

  it("next frame changes impostor matrix x after .data then .dcd", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    const app = renderer.app;
    try {
      await app.start();
      await loadFileContent(app, LAMMPS_DATA, "sys.data", "lammps", "replace");
      await loadFileContent(
        app,
        dcdBytes([0, 1, 2]),
        "sys.dcd",
        "dcd",
        "augment",
      );

      expect(app.system.trajectory.indexedLength).toBe(3);
      expect(app.modifierPipeline.enabledSourceCount()).toBe(2);

      const composed0 = await app.applyPipeline({ changeKind: "full" });
      const x0 = composed0?.getBlock("atoms")?.viewColF("x");
      const gpu0 =
        app.world.sceneIndex.meshRegistry.getAtomState()?.buffers.get("matrix")
          ?.data[12] ?? Number.NaN;

      expect(app.system.trajectory.currentIndex).toBe(0);
      await app.seekFrame(1);
      expect(app.system.trajectory.currentIndex).toBe(1);
      const composed1 = await app.applyPipeline({ changeKind: "full" });
      const x1 = composed1?.getBlock("atoms")?.viewColF("x");
      const gpu1 =
        app.world.sceneIndex.meshRegistry.getAtomState()?.buffers.get("matrix")
          ?.data[12] ?? Number.NaN;

      expect(x1?.[1]).toBeCloseTo(1, 5);
      expect(x1?.[1]).not.toBeCloseTo(x0?.[1] ?? -999, 5);
      expect(gpu1).not.toBeCloseTo(gpu0, 5);
    } finally {
      renderer.dispose();
    }
  });

  it("next frame advances after streaming-augmenting a DCD onto .data", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    const app = renderer.app;
    try {
      await app.start();
      await loadFileContent(app, LAMMPS_DATA, "sys.data", "lammps", "replace");
      await loadFileStream(
        app,
        new Blob([dcdBytes([0, 1, 2]) as BlobPart]),
        "sys.dcd",
        "dcd",
        {},
        "augment",
      );

      expect(app.system.trajectory.indexedLength).toBe(3);
      expect(app.modifierPipeline.enabledSourceCount()).toBe(2);

      const composed0 = await app.applyPipeline({ changeKind: "full" });
      const x0 = composed0?.getBlock("atoms")?.viewColF("x");

      await app.seekFrame(1);
      expect(app.system.trajectory.currentIndex).toBe(1);
      const composed1 = await app.applyPipeline({ changeKind: "full" });
      const x1 = composed1?.getBlock("atoms")?.viewColF("x");
      expect(x1?.[1]).toBeCloseTo(1, 5);
      expect(x1?.[1]).not.toBeCloseTo(x0?.[1] ?? -999, 5);
    } finally {
      renderer.dispose();
    }
  });
});
