import { describe, expect, it } from "@rstest/core";
import type { MountOpts } from "../../src/lib/mount-opts";
import { MountOptsStore } from "../../src/lib/mount-opts-store";

describe("MountOptsStore", () => {
  it("merges a patch into a new snapshot without mutating the old one", () => {
    const seed: MountOpts = { surface: "canvas", wsUrl: "ws://x" };
    const store = new MountOptsStore(seed);
    const before = store.get();

    store.patch({ surface: "full" });

    const after = store.get();
    expect(after.surface).toBe("full");
    // Unrelated fields survive the merge.
    expect(after.wsUrl).toBe("ws://x");
    // The captured snapshot is untouched — transforms return new objects.
    expect(before.surface).toBe("canvas");
    expect(after).not.toBe(before);
  });

  it("returns a referentially stable snapshot while nothing changes", () => {
    const store = new MountOptsStore({ surface: "canvas" });
    // `useSyncExternalStore` re-renders on snapshot identity change, so an
    // always-fresh object would spin forever.
    expect(store.get()).toBe(store.get());

    store.patch({ surface: "canvas" });
    // A patch that changes nothing must not mint a new identity either.
    expect(store.get()).toBe(store.get());
    expect(store.get().surface).toBe("canvas");
  });

  it("notifies subscribers once per effective patch and stops after unsubscribe", () => {
    const store = new MountOptsStore({ surface: "canvas" });
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.patch({ surface: "full" });
    expect(calls).toBe(1);

    unsubscribe();
    store.patch({ surface: "canvas" });
    expect(calls).toBe(1);
  });

  it("ignores patches once closed but keeps serving the last snapshot", () => {
    const store = new MountOptsStore({ surface: "canvas" });
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });

    store.close();
    store.patch({ surface: "full" });

    expect(calls).toBe(0);
    expect(store.get().surface).toBe("canvas");
  });

  it("survives being called detached from the instance", () => {
    const store = new MountOptsStore({ surface: "canvas" });
    // This is exactly how `useSyncExternalStore(store.subscribe, store.get)`
    // invokes them: a prototype method would see `this === undefined`.
    const { get, subscribe, patch } = store;

    expect(() => subscribe(() => {})).not.toThrow();
    expect(get().surface).toBe("canvas");
    patch({ surface: "full" });
    expect(get().surface).toBe("full");
  });
});
