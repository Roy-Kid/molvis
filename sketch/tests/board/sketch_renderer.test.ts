import { describe, expect, it } from "@rstest/core";
import { ViewportCoords } from "../../src/board/coords";
import { SketchRenderer } from "../../src/board/sketch_renderer";
import { MoleculeGraph } from "../../src/molecule_graph";

function mockCtx() {
  const calls: string[] = [];
  const ctx = {
    setTransform: () => calls.push("setTransform"),
    clearRect: () => calls.push("clearRect"),
    fillRect: () => calls.push("fillRect"),
    beginPath: () => calls.push("beginPath"),
    arc: () => calls.push("arc"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    closePath: () => calls.push("closePath"),
    fillText: (t: string) => calls.push(`fillText:${t}`),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("SketchRenderer", () => {
  it("draws water atoms and labels non-C; C omits letter", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "O", x: 0, y: 0 },
        { element: "H", x: 1, y: 0.5 },
        { element: "H", x: 1, y: -0.5 },
        { element: "C", x: -1, y: 0 },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
        { i: 0, j: 3, order: 1 },
      ],
    });
    const vp = new ViewportCoords();
    vp.resize(200, 200, 1);
    const { ctx, calls } = mockCtx();
    new SketchRenderer().paint(ctx, g, vp, {
      selectedAtoms: new Set(),
      selectedBonds: new Set(),
      omitCarbonLabel: true,
      atomRadiusDoc: 0.35,
    });
    expect(calls.filter((c) => c.startsWith("fillText:O")).length).toBe(1);
    expect(calls.filter((c) => c.startsWith("fillText:H")).length).toBe(2);
    expect(calls.filter((c) => c.startsWith("fillText:C")).length).toBe(0);
    expect(calls.filter((c) => c === "arc").length).toBe(4);
  });

  it("double bond emits multiple stroke paths", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1.2, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 2 }],
    });
    const vp = new ViewportCoords();
    vp.resize(100, 100, 1);
    const { ctx, calls } = mockCtx();
    new SketchRenderer().paint(ctx, g, vp, {
      selectedAtoms: new Set(),
      selectedBonds: new Set(),
      omitCarbonLabel: true,
      atomRadiusDoc: 0.35,
    });
    // two parallel bond strokes + atom strokes
    expect(calls.filter((c) => c === "stroke").length).toBeGreaterThanOrEqual(2);
  });
});
