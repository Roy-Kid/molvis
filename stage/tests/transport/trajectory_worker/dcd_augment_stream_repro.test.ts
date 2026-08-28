import { toDomainUint } from "@molcrafts/molvis-core";
import { Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../../setup_wasm";
import { BlobRangeSource } from "../../../src/io/sources";
import { FileDataSource } from "../../../src/pipeline/data_source";
import { ModifierPipeline } from "../../../src/pipeline/pipeline";
import {
  SceneSession,
  type SceneSessionHost,
} from "../../../src/scene_session";
import { System } from "../../../src/system";
import { composeSources } from "../../../src/system/source_composition";
import { Trajectory } from "../../../src/system/trajectory";
import {
  type FrameMessage,
  TrajectoryRuntime,
  type WorkerLike,
} from "../../../src/transport/trajectory_worker";

type RunMessage = { type: "run"; id: number; job: unknown };

/** Fake worker that streams 3 frames and answers load-frame by id. */
class StreamFakeWorker implements WorkerLike {
  private readonly listeners = new Map<string, Array<(e: Event) => void>>();
  private readySent = false;

  addEventListener(type: string, listener: (e: Event) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
    if (type === "message" && !this.readySent) {
      this.readySent = true;
      queueMicrotask(() => this.emit({ type: "ready" }));
    }
  }
  removeEventListener(type: string, listener: (e: Event) => void): void {
    const arr = this.listeners.get(type);
    if (arr)
      this.listeners.set(
        type,
        arr.filter((l) => l !== listener),
      );
  }
  postMessage(message: unknown): void {
    const tagged = message as { type?: unknown; job?: unknown };
    if (tagged?.type === "run") {
      queueMicrotask(() => this.respond(message as RunMessage));
    }
  }
  terminate(): void {}

  private respond(run: RunMessage): void {
    const job = run.job as { kind: string; frameId?: number };
    if (job.kind === "open") {
      this.emit({
        type: "progress",
        id: run.id,
        progress: { bytesScanned: 4, totalBytes: 12, framesIndexedSoFar: 1 },
      });
      queueMicrotask(() => {
        this.emit({
          type: "done",
          id: run.id,
          result: {
            kind: "open-result",
            frameCount: 3,
            totalBytes: 12,
            indexComplete: true,
          },
        });
      });
    } else if (job.kind === "load-frame") {
      this.emit({
        type: "done",
        id: run.id,
        result: frameMessage(job.frameId ?? 0),
      });
    }
  }

  private emit(msg: unknown): void {
    const event = { data: msg } as MessageEvent;
    for (const l of [...(this.listeners.get("message") ?? [])])
      l(event as unknown as Event);
  }
}

function frameMessage(frameId: number): FrameMessage {
  const seed = frameId;
  const x = new Float64Array([seed, seed + 0.1, seed + 0.2]);
  const y = new Float64Array([seed, seed + 0.2, seed + 0.3]);
  const z = new Float64Array([seed, seed + 0.3, seed + 0.4]);
  return {
    kind: "frame",
    frameId,
    blocks: [
      {
        name: "atoms",
        columns: [
          { name: "x", dtype: "f64", data: x },
          { name: "y", dtype: "f64", data: y },
          { name: "z", dtype: "f64", data: z },
        ],
      },
    ],
    box: null,
    grids: [],
  };
}

function hostStub(system: System, pipeline: ModifierPipeline) {
  const host: SceneSessionHost = {
    artist: { clear: () => {} } as SceneSessionHost["artist"],
    commandManager: {
      clearHistory: () => {},
    } as SceneSessionHost["commandManager"],
    pipeline,
    system,
    isRunning: () => false,
    setFrameIndex: () => {},
    clearLastRenderedFrame: () => {},
    renderActiveTrajectoryFrame: async () => {},
    applyPipeline: async () => null,
  };
  return { host, session: new SceneSession(host) };
}

describe("streaming data+dcd augment seam", () => {
  it("promotes System and composes advancing frames from an async provider", async () => {
    const system = new System();
    const pipeline = new ModifierPipeline();
    const { session } = hostStub(system, pipeline);

    // .data structure (length-1, ids permuted).
    const topo = new Trajectory([frameWithIds([3, 1, 2])]);
    await session.replaceScene(topo, { filename: "sys.data" });
    expect(system.trajectory.indexedLength).toBe(1);

    // DCD via async provider (streaming runtime seam).
    const worker = new StreamFakeWorker();
    const runtime = new TrajectoryRuntime(worker, "dcd");
    const provider = {
      get: (index: number) => runtime.loadFrameLatest(index),
      dispose: () => {
        void runtime.close();
      },
    };
    const dcd = Trajectory.fromAsyncProvider(provider);
    await runtime.open(new BlobRangeSource(new Blob(["........"])));
    await runtime.whenIndexComplete;
    dcd.recordIndexedLength(3, 3);
    dcd.markIndexComplete();

    await session.addDataSource(
      new FileDataSource(dcd, { filename: "sys.dcd" }),
    );
    expect(system.trajectory).toBe(dcd);
    expect(system.trajectory.indexedLength).toBe(3);

    const sources = pipeline
      .sources()
      .map((s) => ({ id: s.id, trajectory: s.trajectory }));
    for (let i = 1; i < 3; i++) {
      const ok = await system.seekFrame(i);
      expect(ok).toBe(true);
      const composed = await composeSources(
        sources,
        system.trajectory.currentIndex,
      );
      const x = composed.getBlock("atoms")?.viewColF("x");
      // topo row 1 has id 1 -> DCD row 0, x = frameIndex
      expect(x?.[1]).toBeCloseTo(i, 5);
    }
    await runtime.close();
  });
});

function frameWithIds(ids: number[]): Frame {
  const f = new Frame();
  const b = f.createBlock("atoms");
  const x = new Float64Array([0, 0, 0]);
  const y = new Float64Array([0, 0, 0]);
  const z = new Float64Array([0, 0, 0]);
  b.setColU32("id", toDomainUint(ids));
  b.setColF("x", x);
  b.setColF("y", y);
  b.setColF("z", z);
  return f;
}
