import { NullEngine } from "@babylonjs/core";
import { afterEach, describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import {
  type ComputeWorkloadHost,
  disposeComputeRuntime,
  setComputeRuntimeForTests,
  warmComputeWorker,
} from "../src/compute/runtime";
import { MolvisRenderer } from "../src/renderer";
import { Trajectory } from "../src/system/trajectory";
import {
  TrajectoryRuntime,
  type WorkerLike,
} from "../src/transport/trajectory_worker";

class TerminatingFakeWorker implements WorkerLike {
  terminated = false;
  private readonly listeners = new Map<string, Array<(e: Event) => void>>();

  addEventListener(type: string, listener: (e: Event) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
    if (type === "message") {
      queueMicrotask(() =>
        this.emit({ type: "ready" } as unknown as MessageEvent),
      );
    }
  }

  removeEventListener(type: string, listener: (e: Event) => void): void {
    const arr = this.listeners.get(type);
    if (arr) {
      this.listeners.set(
        type,
        arr.filter((l) => l !== listener),
      );
    }
  }

  postMessage(): void {}

  terminate(): void {
    this.terminated = true;
  }

  private emit(msg: MessageEvent): void {
    for (const l of [...(this.listeners.get("message") ?? [])]) {
      l(msg as unknown as Event);
    }
  }
}

describe("MolvisApp.destroy teardown", () => {
  afterEach(() => {
    disposeComputeRuntime();
  });

  it("streaming trajectory dispose terminates the worker (loadFileStream cleanup path)", async () => {
    const worker = new TerminatingFakeWorker();
    const runtime = new TrajectoryRuntime(worker, "xyz");
    const trajectory = Trajectory.fromAsyncProvider({
      get: (index) => runtime.loadFrameLatest(index),
      dispose: () => {
        void runtime.close();
      },
    });
    trajectory.dispose();
    await Promise.resolve();
    expect(worker.terminated).toBe(true);
  });

  it("destroy disposes the warmed compute singleton worker", async () => {
    let disposed = false;
    setComputeRuntimeForTests({
      whenReady: () => Promise.resolve(),
      dispose: () => {
        disposed = true;
      },
      isDead: false,
    } as unknown as ComputeWorkloadHost);

    await warmComputeWorker();

    const canvas = document.createElement("canvas");
    const renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    renderer.dispose();

    expect(disposed).toBe(true);
  });
});
