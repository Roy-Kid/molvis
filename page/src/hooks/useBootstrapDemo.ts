import type { Molvis } from "@molvis/core";
import { useEffect } from "react";

/**
 * Seeds a tiny demo frame when pipeline is empty.
 */
export function useBootstrapDemo(
  app: Molvis | null,
  setCurrentMode: (mode: string) => void,
): void {
  useEffect(() => {
    if (!app) {
      return;
    }

    let cameraResetTimer: number | null = null;
    let disposed = false;

    const initDemo = async () => {
      const { DataSourceModifier, Frame, Block } = await import("@molvis/core");
      if (disposed) {
        return;
      }
      const pipeline = app.modifierPipeline;

      if (pipeline.getModifiers().length === 0) {
        const atomsBlock = new Block();
        atomsBlock.setColumnF32("x", new Float32Array([0.0, 0.757, -0.757]));
        atomsBlock.setColumnF32("y", new Float32Array([0.0, 0.586, 0.586]));
        atomsBlock.setColumnF32("z", new Float32Array([0.0, 0.0, 0.0]));
        atomsBlock.setColumnStrings("element", ["O", "H", "H"]);

        const bondsBlock = new Block();
        bondsBlock.setColumnU32("i", new Uint32Array([0, 0]));
        bondsBlock.setColumnU32("j", new Uint32Array([1, 2]));
        bondsBlock.setColumnU8("order", new Uint8Array([1, 1]));

        const frame = new Frame();
        frame.insertBlock("atoms", atomsBlock);
        frame.insertBlock("bonds", bondsBlock);

        const sourceMod = new DataSourceModifier();
        sourceMod.setFrame(frame);
        sourceMod.sourceType = "empty";
        sourceMod.filename = "H2O Demo";

        pipeline.addModifier(sourceMod);
        app.loadFrame(frame);
        app.setMode("view");
        setCurrentMode("view");

        cameraResetTimer = window.setTimeout(() => {
          app.world.resetCamera();
        }, 100);
      }
    };

    void initDemo();

    return () => {
      disposed = true;
      if (cameraResetTimer) {
        window.clearTimeout(cameraResetTimer);
      }
    };
  }, [app, setCurrentMode]);
}
