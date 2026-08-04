import { Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { ModifierPipeline } from "../src/pipeline/pipeline";
import { SceneSession, type SceneSessionHost } from "../src/scene_session";
import { System } from "../src/system";
import { Trajectory } from "../src/system/trajectory";

/** Host stub: enough for replaceScene without Babylon / artist. */
function hostStub(): {
  host: SceneSessionHost;
  system: System;
  pipeline: ModifierPipeline;
} {
  const system = new System();
  const pipeline = new ModifierPipeline();
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
  return { host, system, pipeline };
}

function oneOxygenFrame(): Frame {
  const frame = new Frame();
  const atoms = frame.createBlock("atoms");
  atoms.setColF("x", new Float64Array([0]));
  atoms.setColF("y", new Float64Array([0]));
  atoms.setColF("z", new Float64Array([0]));
  atoms.setColStr("element", ["O"]);
  return frame;
}

describe("SceneSession.replaceScene", () => {
  it("auto-attaches Particles on replaceScene (file load / set_trajectory)", async () => {
    // Load paths still replace the primary source; they must attach Draws so
    // the loaded trajectory paints. RPC draw_frame is append-only and does
    // not go through replaceScene.
    const { host, pipeline } = hostStub();
    const session = new SceneSession(host);

    await session.replaceScene(new Trajectory([oneOxygenFrame()]), {
      sourceType: "backend",
      filename: "backend",
    });

    const names = pipeline.getModifiers().map((m) => m.name);
    expect(names).toContain("Particles");
    expect(
      pipeline.getModifiers().filter((m) => m.name === "Particles"),
    ).toHaveLength(1);
  });

  it("attaches nothing drawable for an empty frame", async () => {
    const { host, pipeline } = hostStub();
    const session = new SceneSession(host);

    await session.replaceScene(new Trajectory([new Frame()]), {
      sourceType: "empty",
      filename: "",
    });

    expect(pipeline.getModifiers().map((m) => m.name)).not.toContain(
      "Particles",
    );
  });
});
