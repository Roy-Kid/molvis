import type { Molvis } from "@molcrafts/molvis-stage";
import { describe, expect, it } from "@rstest/core";
import { PipelineOperationProvider } from "../../../../../src/components/viewer/PipelineOperationProvider";
import { MolecularSurfaceModifier } from "../../../../../src/ui/modes/view/modifiers/MolecularSurfaceModifier";
import { mountComponent } from "../../../../react_harness";

type Algorithm = "vdw" | "sas" | "ses" | "gaussian";

interface FakeOverrides {
  algorithm?: Algorithm;
  report?: {
    shape: [number, number, number];
    spacing: number;
    resolutionClamped: boolean;
    usedFallbackRadius: boolean;
  } | null;
}

function fakeModifier({
  algorithm = "ses",
  report = null,
}: FakeOverrides = {}) {
  return {
    algorithm,
    report,
    solventParams: { resolution: 0.5, probeRadius: 1.4, radiusScale: 1 },
    gaussianParams: { resolution: 0.5, sigma: 1, cutoff: null },
    style: { isovalue: 0.05, opacity: 0.6, color: [0.4, 0.65, 1] },
    setAlgorithm: () => undefined,
    setSolventParams: () => undefined,
    setGaussianParams: () => undefined,
    setStyle: () => undefined,
  };
}

function fakeApp() {
  return { applyPipeline: async () => null } as unknown as Molvis;
}

async function mountPanel(
  overrides: FakeOverrides = {},
  surface: "compute" | "draw" = "compute",
) {
  return mountComponent(
    <PipelineOperationProvider>
      <MolecularSurfaceModifier
        modifier={fakeModifier(overrides) as never}
        app={fakeApp()}
        onUpdate={() => undefined}
        surface={surface}
      />
    </PipelineOperationProvider>,
  );
}

const has = (host: HTMLElement, label: string) =>
  host.querySelector(`[aria-label="${label}"]`) !== null;

describe("TestMolecularSurfaceModifier", () => {
  it("offers every algorithm as one flat list", async () => {
    const mounted = await mountPanel();
    try {
      expect(has(mounted.host, "Surface algorithm")).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it("vdw shows radius scale but no probe radius", async () => {
    const mounted = await mountPanel({ algorithm: "vdw" });
    try {
      expect(has(mounted.host, "Resolution (Å) slider")).toBe(true);
      expect(has(mounted.host, "Radius scale slider")).toBe(true);
      expect(has(mounted.host, "Probe radius (Å) slider")).toBe(false);
      expect(has(mounted.host, "Sigma (Å) slider")).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });

  it("sas adds the probe radius", async () => {
    const mounted = await mountPanel({ algorithm: "sas" });
    try {
      expect(has(mounted.host, "Probe radius (Å) slider")).toBe(true);
      expect(has(mounted.host, "Radius scale slider")).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it("ses adds the probe radius", async () => {
    const mounted = await mountPanel({ algorithm: "ses" });
    try {
      expect(has(mounted.host, "Probe radius (Å) slider")).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it("gaussian swaps the whole solvent param set for its own", async () => {
    const mounted = await mountPanel({ algorithm: "gaussian" });
    try {
      expect(has(mounted.host, "Sigma (Å) slider")).toBe(true);
      expect(has(mounted.host, "Probe radius (Å) slider")).toBe(false);
      expect(has(mounted.host, "Radius scale slider")).toBe(false);
      expect(mounted.host.textContent ?? "").toMatch(/Cutoff/);
    } finally {
      await mounted.cleanup();
    }
  });

  it("exposes isovalue on draw only for the density surface", async () => {
    const density = await mountPanel({ algorithm: "gaussian" }, "draw");
    try {
      expect(has(density.host, "Isovalue slider")).toBe(true);
    } finally {
      await density.cleanup();
    }

    // The solvent envelopes are defined by their radii; a threshold there
    // would be a second, redundant way to say the same thing.
    const ses = await mountPanel({ algorithm: "ses" }, "draw");
    try {
      expect(has(ses.host, "Isovalue slider")).toBe(false);
      expect(has(ses.host, "Opacity slider")).toBe(true);
    } finally {
      await ses.cleanup();
    }
  });

  it("reports the grid it actually built as one meta line", async () => {
    const mounted = await mountPanel({
      algorithm: "ses",
      report: {
        shape: [74, 61, 58],
        spacing: 0.5,
        resolutionClamped: false,
        usedFallbackRadius: false,
      },
    });
    try {
      const copy = mounted.host.textContent ?? "";
      expect(copy).toMatch(/74×61×58/);
      expect(copy).toMatch(/0\.50 Å/);
      expect(copy).not.toMatch(/coarsened/);
      expect(copy).not.toMatch(/uniform radius/);
    } finally {
      await mounted.cleanup();
    }
  });

  it("says so when the resolution was coarsened", async () => {
    const mounted = await mountPanel({
      algorithm: "ses",
      report: {
        shape: [160, 160, 160],
        spacing: 0.82,
        resolutionClamped: true,
        usedFallbackRadius: false,
      },
    });
    try {
      expect(mounted.host.textContent ?? "").toMatch(/coarsened/);
    } finally {
      await mounted.cleanup();
    }
  });

  it("warns about a uniform radius only where radii matter", async () => {
    const report = {
      shape: [40, 40, 40] as [number, number, number],
      spacing: 0.5,
      resolutionClamped: false,
      usedFallbackRadius: true,
    };

    const solvent = await mountPanel({ algorithm: "vdw", report });
    try {
      expect(solvent.host.textContent ?? "").toMatch(/uniform radius/);
    } finally {
      await solvent.cleanup();
    }

    // Gaussian density never reads van der Waals radii, so the warning
    // would be noise there.
    const density = await mountPanel({ algorithm: "gaussian", report });
    try {
      expect(density.host.textContent ?? "").not.toMatch(/uniform radius/);
    } finally {
      await density.cleanup();
    }
  });

  it("shows no grid meta line before the first run", async () => {
    const mounted = await mountPanel({ algorithm: "ses", report: null });
    try {
      expect(mounted.host.textContent ?? "").not.toMatch(/voxels/);
    } finally {
      await mounted.cleanup();
    }
  });
});
