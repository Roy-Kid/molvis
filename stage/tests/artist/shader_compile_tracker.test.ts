import { describe, expect, it } from "@rstest/core";
import { ShaderCompileTracker } from "../../src/artist/shader_compile_tracker";

describe("ShaderCompileTracker", () => {
  it("asks for a warm render only until the target has compiled", async () => {
    const tracker = new ShaderCompileTracker<"atom" | "bond">();
    expect(tracker.needsWarmRender(["atom"])).toBe(true);

    await tracker.ensure("atom", () => Promise.resolve());

    expect(tracker.isReady("atom")).toBe(true);
    expect(tracker.needsWarmRender(["atom"])).toBe(false);
    expect(tracker.needsWarmRender(["atom", "bond"])).toBe(true);
    expect(tracker.needsWarmRender([])).toBe(false);
  });

  it("compiles each target once and shares the in-flight promise", async () => {
    const tracker = new ShaderCompileTracker<string>();
    let compiles = 0;
    let release: () => void = () => {};
    const compile = () => {
      compiles += 1;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };

    const first = tracker.ensure("bond", compile);
    const second = tracker.ensure("bond", compile);
    expect(second).toBe(first);
    expect(tracker.needsWarmRender(["bond"])).toBe(true);

    release();
    await first;
    await tracker.ensure("bond", compile);
    expect(compiles).toBe(1);
  });

  it("forgets a failed compile so the next draw retries", async () => {
    const tracker = new ShaderCompileTracker<string>();
    let attempts = 0;
    const failing = () => {
      attempts += 1;
      return Promise.reject(new Error("no glsl"));
    };
    await expect(tracker.ensure("atom", failing)).rejects.toThrow("no glsl");
    expect(tracker.isReady("atom")).toBe(false);

    await tracker.ensure("atom", () => Promise.resolve());
    expect(attempts).toBe(1);
    expect(tracker.isReady("atom")).toBe(true);
  });
});
