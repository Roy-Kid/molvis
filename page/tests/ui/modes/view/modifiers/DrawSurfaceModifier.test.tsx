import type { Molvis } from "@molcrafts/molvis-stage";
import { describe, expect, it } from "@rstest/core";
import { act } from "react";
import { PipelineOperationProvider } from "../../../../../src/components/viewer/PipelineOperationProvider";
import { DrawSurfaceModifier } from "../../../../../src/ui/modes/view/modifiers/DrawSurfaceModifier";
import { mountComponent } from "../../../../react_harness";

function fakeModifier(finish: "solid" | "contour" = "solid") {
  const style = {
    color: [0.4, 0.65, 1] as [number, number, number],
    opacity: 0.6,
    finish,
    contourSpacing: 0.45,
  };
  return {
    id: "Bravo",
    style,
    setStyle: (patch: Partial<typeof style>) => Object.assign(style, patch),
  };
}

/** Records what the panel pushes straight at the renderer. */
function fakeApp(log: string[]) {
  return {
    applyPipeline: async () => {
      log.push("pipeline");
      return null;
    },
    artist: {
      surfaceLayer: () => ({
        setColor: () => log.push("color"),
        setOpacity: () => log.push("opacity"),
      }),
    },
  } as unknown as Molvis;
}

async function mountPanel(
  finish: "solid" | "contour" = "solid",
  log: string[] = [],
) {
  const modifier = fakeModifier(finish);
  const mounted = await mountComponent(
    <PipelineOperationProvider>
      <DrawSurfaceModifier
        modifier={modifier as never}
        app={fakeApp(log)}
        onUpdate={() => undefined}
      />
    </PipelineOperationProvider>,
  );
  return { mounted, modifier, log };
}

const has = (host: HTMLElement, label: string) =>
  host.querySelector(`[aria-label="${label}"]`) !== null;

describe("TestDrawSurfaceModifier", () => {
  it("owns the appearance controls for any surface", async () => {
    const { mounted } = await mountPanel();
    try {
      expect(has(mounted.host, "Surface color")).toBe(true);
      expect(has(mounted.host, "Opacity slider")).toBe(true);
      expect(has(mounted.host, "Surface finish")).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it("carries no algorithm controls — those belong to the producer", async () => {
    const { mounted } = await mountPanel();
    try {
      expect(has(mounted.host, "Surface algorithm")).toBe(false);
      expect(has(mounted.host, "Resolution (Å) slider")).toBe(false);
      expect(has(mounted.host, "Isovalue slider")).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });

  it("repaints colour through the renderer, never the pipeline", async () => {
    // The producer above may be a Delaunay tetrahedralisation; re-running it
    // to darken a blue is the exact cost the compute/draw split removes.
    const { mounted, log } = await mountPanel();
    try {
      const input = mounted.host.querySelector<HTMLInputElement>(
        '[aria-label="Surface color"]',
      );
      await act(async () => {
        const desc = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        );
        desc?.set?.call(input, "#112233");
        input?.dispatchEvent(new Event("input", { bubbles: true }));
        input?.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(log).toContain("color");
      expect(log).not.toContain("pipeline");
    } finally {
      await mounted.cleanup();
    }
  });

  it("contour spacing appears only for the contour finish", async () => {
    const solid = await mountPanel("solid");
    try {
      expect(has(solid.mounted.host, "Contour spacing (Å) slider")).toBe(false);
    } finally {
      await solid.mounted.cleanup();
    }

    const contour = await mountPanel("contour");
    try {
      expect(has(contour.mounted.host, "Contour spacing (Å) slider")).toBe(
        true,
      );
    } finally {
      await contour.mounted.cleanup();
    }
  });
});
