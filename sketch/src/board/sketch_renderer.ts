import type { MoleculeGraph } from "../molecule_graph";
import { colorForElement } from "../style/element_colors";
import type { ViewportCoords } from "./coords";

export interface SketchRenderTheme {
  background: string;
  bondStroke: string;
  selectionStroke: string;
  labelFill: string;
}

const DEFAULT_THEME: SketchRenderTheme = {
  background: "#f7f8fa",
  bondStroke: "#222222",
  selectionStroke: "#2563eb",
  labelFill: "#111111",
};

export interface SketchRenderState {
  selectedAtoms: ReadonlySet<number>;
  selectedBonds: ReadonlySet<number>;
  omitCarbonLabel: boolean;
  atomRadiusDoc: number;
}

/**
 * Immediate-mode Canvas 2D renderer for the sketch graph.
 * No third-party drawing libraries.
 */
export class SketchRenderer {
  private theme: SketchRenderTheme = { ...DEFAULT_THEME };

  setTheme(theme: Partial<SketchRenderTheme>): void {
    this.theme = { ...this.theme, ...theme };
  }

  getTheme(): SketchRenderTheme {
    return { ...this.theme };
  }

  paint(
    ctx: CanvasRenderingContext2D,
    graph: MoleculeGraph,
    viewport: ViewportCoords,
    state: SketchRenderState,
  ): void {
    const { width, height } = viewport.getCssSize();
    const dpr = viewport.getDpr();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, width, height);

    const data = graph.getMoleculeData();
    const rCss = state.atomRadiusDoc * viewport.getScale();

    // Bonds first
    for (let bi = 0; bi < data.bonds.length; bi++) {
      const bond = data.bonds[bi];
      const a = data.atoms[bond.i];
      const b = data.atoms[bond.j];
      if (!a || !b) continue;
      const p1 = viewport.docToScreen(a.x, a.y);
      const p2 = viewport.docToScreen(b.x, b.y);
      const selected = state.selectedBonds.has(bi);
      drawBond(ctx, p1.x, p1.y, p2.x, p2.y, bond.order, bond.stereo ?? "none", {
        stroke: selected ? this.theme.selectionStroke : this.theme.bondStroke,
        width: selected ? 2.5 : 1.5,
      });
    }

    // Atoms
    for (let i = 0; i < data.atoms.length; i++) {
      const atom = data.atoms[i];
      const p = viewport.docToScreen(atom.x, atom.y);
      const fill = colorForElement(atom.element);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rCss, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = state.selectedAtoms.has(i)
        ? this.theme.selectionStroke
        : "#333333";
      ctx.lineWidth = state.selectedAtoms.has(i) ? 2.5 : 1;
      ctx.stroke();

      const showLabel =
        !(state.omitCarbonLabel && atom.element === "C") ||
        (atom.charge !== undefined && atom.charge !== 0);
      if (showLabel && !(state.omitCarbonLabel && atom.element === "C")) {
        ctx.fillStyle = this.theme.labelFill;
        ctx.font = `${Math.max(10, rCss * 0.9)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(atom.element, p.x, p.y);
      }
      if (atom.charge !== undefined && atom.charge !== 0) {
        const sign =
          atom.charge > 0 ? `+${atom.charge === 1 ? "" : atom.charge}` : `${atom.charge}`;
        ctx.fillStyle = this.theme.labelFill;
        ctx.font = `${Math.max(9, rCss * 0.7)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(sign, p.x + rCss * 0.4, p.y - rCss * 0.3);
      }
    }
  }
}

function drawBond(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  order: number,
  stereo: "none" | "up" | "down",
  style: { stroke: string; width: number },
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const spacing = 3.5;

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.width;
  ctx.lineCap = "round";

  if (stereo === "up" && order === 1) {
    // solid wedge
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + nx * 4, y2 + ny * 4);
    ctx.lineTo(x2 - nx * 4, y2 - ny * 4);
    ctx.closePath();
    ctx.fillStyle = style.stroke;
    ctx.fill();
    return;
  }
  if (stereo === "down" && order === 1) {
    const steps = 8;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 0.5) / steps;
      const w = 4 * t1;
      const ax = x1 + dx * t0;
      const ay = y1 + dy * t0;
      const bx = x1 + dx * t1;
      const by = y1 + dy * t1;
      ctx.beginPath();
      ctx.moveTo(ax + nx * w, ay + ny * w);
      ctx.lineTo(bx - nx * w, by - ny * w);
      ctx.stroke();
    }
    return;
  }

  const lines = Math.max(1, Math.min(3, order | 0));
  const offsets =
    lines === 1
      ? [0]
      : lines === 2
        ? [-spacing / 2, spacing / 2]
        : [-spacing, 0, spacing];
  for (const o of offsets) {
    ctx.beginPath();
    ctx.moveTo(x1 + nx * o, y1 + ny * o);
    ctx.lineTo(x2 + nx * o, y2 + ny * o);
    ctx.stroke();
  }
}
