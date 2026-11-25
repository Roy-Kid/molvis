import { describe, expect, it } from "@rstest/core";
import { DEFAULT_THEME } from "../../src/board/sketch_renderer";
import { SketchImageExporter } from "../../src/export/sketch_image_exporter";
import { MoleculeGraph } from "../../src/molecule_graph";
import { DEPICTION_TOKENS } from "../../src/style/depiction-tokens";
import type { MoleculeData } from "../../src/types";

function svgOf(data: MoleculeData): string {
  const graph = new MoleculeGraph();
  graph.loadMoleculeData(data);
  return new SketchImageExporter(graph, DEFAULT_THEME, true).toSvg();
}

function texts(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
}

describe("SketchImageExporter.toSvg", () => {
  it("draws hydroxide as O, H and a minus charge", () => {
    const svg = svgOf({
      atoms: [{ element: "O", x: 0, y: 0, charge: -1, hydrogens: 1 }],
      bonds: [],
    });
    expect(texts(svg)).toEqual(["O", "H", "−"]);
    expect(svg).not.toContain("<rect x=");
  });

  it("writes an NH3 count as a subscript run and the charge after it", () => {
    const svg = svgOf({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "N", x: 1, y: 0, charge: 1, hydrogens: 3 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
    // Bond comes from the left, so the hydrogens read to the right.
    expect(texts(svg)).toEqual(["N", "H", "3", "+"]);
  });

  it("marks a port atom with a dashed ring and its descriptor", () => {
    const svg = svgOf({
      atoms: [
        { element: "C", x: 0, y: 0, port: "<" },
        { element: "C", x: 1, y: 0 },
        { element: "O", x: 2, y: 0, port: "$R" },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 1, j: 2, order: 1 },
      ],
    });
    const ports = [
      ...svg.matchAll(/<g class="msk-port" data-port="([^"]*)">/g),
    ].map((m) => m[1]);
    expect(ports).toEqual(["&lt;", "$R"]);
    expect(svg).toContain(`stroke="${DEFAULT_THEME.portStroke}"`);
    const dash = svg.match(/stroke-dasharray="([\d.]+) ([\d.]+)"/);
    expect(dash).not.toBeNull();
    const [on, off] = [Number(dash?.[1]), Number(dash?.[2])];
    expect(on / off).toBeCloseTo(
      DEPICTION_TOKENS.portDashRatio[0] / DEPICTION_TOKENS.portDashRatio[1],
      2,
    );
  });

  it("leaves documents without ports or hydrogens unchanged in shape", () => {
    const svg = svgOf({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "Br", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
    expect(svg).not.toContain("msk-port");
    expect(svg).not.toContain("<rect x=");
    expect(texts(svg)).toEqual(["Br"]);
  });

  it("stops a bond at the letter without an opaque patch on transparent paper", () => {
    const graph = new MoleculeGraph();
    graph.loadMoleculeData({
      atoms: [
        { element: "O", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
    const svg = new SketchImageExporter(graph, DEFAULT_THEME, true).toSvg({
      background: "transparent",
    });
    expect(svg).toContain('fill="transparent"');
    expect(svg).not.toContain("<circle ");
    expect(svg).not.toContain("<rect x=");
    expect(texts(svg)).toEqual(["O"]);
    const labelX = Number(svg.match(/<text x="([^"]+)"/)?.[1]);
    const bondStart = Number(svg.match(/<line x1="([^"]+)"/)?.[1]);
    expect(bondStart).toBeGreaterThan(labelX);
  });

  it("layers colored panels, atoms, repeat marks, and escaped figure labels", () => {
    const graph = new MoleculeGraph();
    graph.loadMoleculeData({
      atoms: [{ element: "O", x: 0, y: 0 }],
      bonds: [],
    });
    const svg = new SketchImageExporter(graph, DEFAULT_THEME, true, [
      {
        kind: "rectangle",
        x: 0,
        y: 0,
        width: 5,
        height: 3,
        fill: "#e9f5ec",
        radius: 0.4,
      },
      {
        kind: "bracket",
        variant: "round",
        x: 0,
        y: 0,
        width: 3,
        height: 2,
        label: { text: "7", size: 0.5 },
      },
      {
        kind: "ellipse",
        x: 9,
        y: 0,
        width: 2,
        height: 2,
        fill: "#f13321",
        label: { text: "−", size: 1 },
      },
      {
        kind: "text",
        x: 6,
        y: 2,
        label: {
          text: "A & B\n<repeat>",
          size: 0.6,
          family: "serif",
          bold: true,
        },
      },
    ]).toSvg({ width: 640, height: 240 });
    expect(texts(svg)).toEqual(["O", "7", "−", "A &amp; B", "&lt;repeat&gt;"]);
    expect(svg).toMatch(/<rect[^>]*rx="[0-9.]+" fill="#e9f5ec"/);
    expect(svg).not.toContain("<circle ");
    expect(svg).toMatch(/<ellipse[^>]*fill="#f13321"/);
    expect(svg).toMatch(/<path d="M [^"]+ Q [^"]+"/);
    expect(svg.indexOf("<ellipse")).toBeLessThan(svg.indexOf(">O</text>"));
    expect(svg.indexOf(">O</text>")).toBeLessThan(svg.indexOf("<path"));
  });

  it("exports curly repeat brackets as two mirrored vector strokes", () => {
    const graph = new MoleculeGraph();
    const svg = new SketchImageExporter(graph, DEFAULT_THEME, true, [
      {
        kind: "bracket",
        variant: "curly",
        x: 0,
        y: 0,
        width: 3,
        height: 2,
        label: { text: "n", size: 0.5 },
      },
    ]).toSvg({ width: 640, height: 240 });
    const path = svg.match(/<path d="([^"]+)"/)?.[1] ?? "";
    expect(path.match(/M /g)).toHaveLength(2);
    expect(path.match(/C /g)).toHaveLength(8);
    const leftCusp = path.split(" C ")[2].split(" ").slice(-2).map(Number);
    const rightCusp = path.split(" C ")[6].split(" ").slice(-2).map(Number);
    expect(leftCusp[0]).toBeLessThan(rightCusp[0]);
    expect(leftCusp[1]).toBeCloseTo(rightCusp[1]);
    expect(texts(svg)).toEqual(["n"]);
  });

  it("exports only the filled corners when bracket strokes are hidden", () => {
    const graph = new MoleculeGraph();
    const svg = new SketchImageExporter(graph, DEFAULT_THEME, true, [
      {
        kind: "bracket",
        variant: "none",
        x: 0,
        y: 0,
        width: 3,
        height: 2,
        label: { text: "legacy", size: 0.5 },
        cornerLabels: {
          topLeft: { text: "L", size: 0.5 },
          topRight: { text: "R", size: 0.5 },
          bottomRight: { text: "n", size: 0.5 },
          bottomLeft: { text: " ", size: 0.5 },
        },
      },
    ]).toSvg({ width: 640, height: 240 });

    expect(svg).not.toContain("<path");
    expect(texts(svg)).toEqual(["L", "R", "n"]);
    const coordinates = [
      ...svg.matchAll(
        /<text x="([^"]+)" y="([^"]+)"[^>]+text-anchor="([^"]+)"/g,
      ),
    ];
    const [, leftX, topY, leftAnchor] = coordinates[0];
    const [, rightX, rightY, rightAnchor] = coordinates[1];
    const [, bottomX, bottomY] = coordinates[2];
    expect(Number(leftX)).toBeLessThan(Number(rightX));
    expect(leftAnchor).toBe("end");
    expect(rightAnchor).toBe("start");
    expect(rightY).toBe(topY);
    expect(bottomX).toBe(rightX);
    expect(Number(bottomY)).toBeGreaterThan(Number(topY));
  });

  it("fits rotated shapes in the export and keeps repeat labels upright", () => {
    const graph = new MoleculeGraph();
    const svg = new SketchImageExporter(graph, DEFAULT_THEME, true, [
      {
        kind: "bracket",
        variant: "round",
        x: 0,
        y: 0,
        width: 8,
        height: 2,
        rotation: 90,
        cornerLabels: { bottomRight: { text: "7", size: 0.5 } },
      },
      { kind: "rectangle", x: 3, y: 0, width: 2, height: 1, rotation: 30 },
      { kind: "ellipse", x: 6, y: 0, width: 3, height: 1, rotation: 45 },
    ]).toSvg({ width: 640, height: 240, padding: 20 });
    const bracket = svg.match(
      /<path[^>]*transform="rotate\(90 ([\d.]+) ([\d.]+)\)"[^>]*\/>/,
    );
    if (!bracket) throw new Error("Missing rotated bracket");
    const [, cx, cy] = bracket.map(Number);
    const label = svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>7<\/text>/);
    if (!label) throw new Error("Missing repeat label");
    expect(Number(label[1])).toBeLessThan(cx);
    expect(Number(label[2])).toBeGreaterThan(cy);
    expect(Number(label[2])).toBeLessThan(220);
    expect(label[0]).not.toContain("transform");
    expect(svg).toMatch(/<rect[^>]*rotate\(30 /);
    expect(svg).toMatch(/<ellipse[^>]*rotate\(45 /);
  });
});
