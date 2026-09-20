/**
 * Unit tests for `src/compute/runtime.ts` — specifically
 * `awaitComputeHostReady` (spec worker-arch-unify-02-runtime, ac-006):
 * the 30s ready timeout moves into the WorkloadHost (`readyTimeoutMs`),
 * so this function keeps only the 2s boot beat plus `await whenReady()`
 * and must no longer own a `Promise.race` timer of its own.
 *
 * `awaitComputeHostReady` consumes exactly one method of the host —
 * `whenReady()` — so a one-method fake keeps the unit isolated from
 * `WorkloadHost` (whose own timeout behavior is covered by
 * core/tests/workload_host.test.ts). The singleton accessors
 * (`getComputeRuntime` / `setComputeRuntimeForTests`) are exercised by the
 * optimize/analysis worker_client suites and need no re-test here.
 */

import { afterEach, describe, expect, it, rstest } from "@rstest/core";
import {
  awaitComputeHostReady,
  type ComputeWorkloadHost,
  disposeComputeRuntime,
  setComputeRuntimeForTests,
} from "../../src/compute/runtime";

function fakeHost(whenReady: () => Promise<void>): ComputeWorkloadHost {
  return { whenReady } as unknown as ComputeWorkloadHost;
}

describe("awaitComputeHostReady", () => {
  afterEach(() => {
    rstest.useRealTimers();
  });

  // Behavior-preservation (GREEN before the rebuild): the first beat is only
  // due after 2s, so an already-warm host resolves without any beat.
  it("resolves without a beat when the host is already ready", async () => {
    const beats: string[] = [];
    await awaitComputeHostReady(
      fakeHost(() => Promise.resolve()),
      (m) => beats.push(m),
    );
    expect(beats).toEqual([]);
  });

  // Behavior-preservation (GREEN before the rebuild): the 2s boot beat is the
  // half the spec explicitly keeps while the race timer is deleted.
  it("beats every 2s while boot is pending, then stops after ready", async () => {
    rstest.useFakeTimers();
    const beats: string[] = [];
    let ready!: () => void;
    const pending = awaitComputeHostReady(
      fakeHost(
        () =>
          new Promise<void>((resolve) => {
            ready = resolve;
          }),
      ),
      (m) => beats.push(m),
    );

    await rstest.advanceTimersByTimeAsync(2_000);
    expect(beats).toEqual(["Starting compute worker…"]);
    await rstest.advanceTimersByTimeAsync(2_000);
    expect(beats.length).toBe(2);

    ready();
    await pending;

    // Interval cleared on resolve — beat count stays put.
    await rstest.advanceTimersByTimeAsync(6_000);
    expect(beats.length).toBe(2);
  });

  // Behavior-preservation (GREEN before the rebuild): after the absorption
  // this rejection is the host's own readyTimeoutMs error — it must surface
  // unchanged (same instance, no wrapping) and kill the beat interval.
  it("propagates a whenReady rejection unchanged and stops beating", async () => {
    rstest.useFakeTimers();
    const beats: string[] = [];
    const bootError = new Error(
      "[molvis-compute] worker failed to start within 30000ms",
    );
    let reject!: (e: Error) => void;
    const outcome = awaitComputeHostReady(
      fakeHost(
        () =>
          new Promise<void>((_resolve, rej) => {
            reject = rej;
          }),
      ),
      (m) => beats.push(m),
    ).then(
      () => null,
      (e: unknown) => e as Error,
    );

    await rstest.advanceTimersByTimeAsync(2_000);
    expect(beats.length).toBe(1);

    reject(bootError);
    const err = await outcome;
    expect(err).toBe(bootError);

    // Interval cleared on rejection — beat count stays put.
    const before = beats.length;
    await rstest.advanceTimersByTimeAsync(10_000);
    expect(beats.length).toBe(before);
  });

  // RED before the rebuild: today's implementation races whenReady() against
  // its own internal 30s setTimeout, so advancing 31s rejects from inside
  // awaitComputeHostReady itself. After the absorption the function owns no
  // timer — with whenReady never settling, the promise must still be pending
  // past the old deadline. (Fake timers make the 30s+ window observable in a
  // unit test; the only rejection source left is the host, which here never
  // settles by construction.)
  it("owns no ready timeout: stays pending past 30s while whenReady hangs", async () => {
    rstest.useFakeTimers();
    let settled: "resolved" | "rejected" | null = null;
    awaitComputeHostReady(
      fakeHost(() => new Promise<void>(() => {})),
      () => {},
    ).then(
      () => {
        settled = "resolved";
      },
      () => {
        settled = "rejected";
      },
    );

    await rstest.advanceTimersByTimeAsync(31_000);
    expect(settled).toBeNull();
  });
});

describe("disposeComputeRuntime", () => {
  afterEach(() => {
    disposeComputeRuntime();
  });

  it("disposes the installed singleton host", () => {
    let disposed = false;
    setComputeRuntimeForTests({
      whenReady: () => Promise.resolve(),
      dispose: () => {
        disposed = true;
      },
      isDead: false,
    } as unknown as ComputeWorkloadHost);

    disposeComputeRuntime();
    expect(disposed).toBe(true);
  });
});
