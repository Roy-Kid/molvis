import {
  ANNOTATION_ROTATION_HANDLE_PX,
  annotationBounds,
  annotationCorners,
  annotationFont,
  annotationRadius,
  annotationRotationHandle,
  annotationRotationRadians,
  annotationTexts,
  bracketCommands,
  DEFAULT_ANNOTATION_STROKE,
  type SketchAnnotation,
} from "../annotations";
import { bondRingCentroid } from "../geometry/bond_ring";
import type { MoleculeGraph } from "../molecule_graph";
import { AtomLabel } from "../style/atom_label";
import {
  type BondMark,
  depictionInk,
  labelInset,
  labelMask,
  planBondMarks,
} from "../style/depiction-tokens";
import { colorForElement, isLabeledElement } from "../style/element_colors";
import { defaultCanvasTheme } from "../style/tokens";
import type { MoleculeData } from "../types";
import type { ViewportCoords } from "./coords";

export interface SketchRenderTheme {
  /** Paper background — token `--msk-stage-bg`. */
  background: string;
  /** Bond / carbon skeleton stroke — token `--msk-ink`. */
  bondStroke: string;
  /** Selection / hover / marquee — token `--msk-active-ink`. */
  selectionStroke: string;
  /** Fallback label fill — token `--msk-ink`. */
  labelFill: string;
  /** Port (attachment point) markers — token `--msk-port`. */
  portStroke: string;
}

/**
 * Token fallbacks for headless / pre-mount. Hosts override via `--msk-*`
 * (see {@link readCanvasThemeFromHost}).
 */
export const DEFAULT_THEME: SketchRenderTheme = defaultCanvasTheme();
export interface SketchRenderState {
  selectedAtoms: ReadonlySet<number>;
  selectedBonds: ReadonlySet<number>;
  hoveredAtom?: number;
  hoveredBond?: number;
  annotations?: readonly SketchAnnotation[];
  selectedAnnotations?: ReadonlySet<number>;
  hoveredAnnotation?: number;
  annotationPreview?: SketchAnnotation;
  atomLabelDraft?: { index: number; text: string };
  moleculePreview?: MoleculeData;
  resizeAnnotation?: number;
  omitCarbonLabel: boolean;
  /** Hit-test / label clearance radius in document units. */
  atomRadiusDoc: number;
  /** Non-destructive translation shown while a selection drag is active. */
  movePreview?: {
    atomIndices: ReadonlySet<number>;
    dx: number;
    dy: number;
  };
  /** Rubber-band rectangle in document coordinates. */
  marquee?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  /** Prospective bond/chain polyline in document coordinates. */
  gesturePreview?: {
    points: ReadonlyArray<{ x: number; y: number }>;
    startAtom?: number;
    endAtom?: number;
  };
}

/**
 * Canvas 2D structure-formula renderer.
 *
 * - Skeleton: black bonds; carbon vertices have no filled balls
 * - Heteroatoms / H: element symbols only (optional element-colored text)
 * - Bonds stop short of labeled atoms so lines do not cross letters
 * - Selection: open ring / bold bond — never CPK spheres
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

    const annotations = state.annotations ?? [];
    for (const item of annotations) {
      if (item.kind === "rectangle" || item.kind === "ellipse") {
        this.paintAnnotationShape(ctx, viewport, item);
      }
    }

    const data = state.moleculePreview ?? graph.getMoleculeData();
    const editing = state.atomLabelDraft;
    if (editing && data.atoms[editing.index]) {
      data.atoms[editing.index].label = editing.text || " ";
    }
    const scale = viewport.getScale();
    const ink = depictionInk(scale);
    const fontPx = ink.fontPx;

    const labeled = data.atoms.map((atom) =>
      isLabeledElement(atom.element, {
        omitCarbonLabel: state.omitCarbonLabel,
        charge: atom.charge,
        forceLabel: Boolean(atom.label),
      }),
    );
    const degrees = new Uint32Array(data.atoms.length);
    for (const bond of data.bonds) {
      if (bond.i < degrees.length) degrees[bond.i] += 1;
      if (bond.j < degrees.length) degrees[bond.j] += 1;
    }
    const atomPoints = data.atoms.map((atom, atomIndex) => {
      const moving = state.movePreview?.atomIndices.has(atomIndex) ?? false;
      return viewport.docToScreen(
        atom.x + (moving ? (state.movePreview?.dx ?? 0) : 0),
        atom.y + (moving ? (state.movePreview?.dy ?? 0) : 0),
      );
    });
    const adjacency = Array.from(
      { length: data.atoms.length },
      (): Array<{ atom: number; bond: number }> => [],
    );
    for (let bondIndex = 0; bondIndex < data.bonds.length; bondIndex++) {
      const bond = data.bonds[bondIndex];
      adjacency[bond.i]?.push({ atom: bond.j, bond: bondIndex });
      adjacency[bond.j]?.push({ atom: bond.i, bond: bondIndex });
    }

    const labels = data.atoms.map(
      (atom, index) =>
        new AtomLabel(
          atom,
          atomPoints[index],
          (adjacency[index] ?? []).map((edge) => atomPoints[edge.atom]),
        ),
    );
    const masks = labels.map((label, index) =>
      labeled[index]
        ? labelMask(label.extent(fontPx), fontPx, label.hasHydrogens)
        : null,
    );

    // --- Bonds (under labels) ---
    for (let bi = 0; bi < data.bonds.length; bi++) {
      const bond = data.bonds[bi];
      const a = data.atoms[bond.i];
      const b = data.atoms[bond.j];
      if (!a || !b) continue;
      const p1 = atomPoints[bond.i];
      const p2 = atomPoints[bond.j];
      if (!p1 || !p2) continue;
      const maskI = masks[bond.i];
      const maskJ = masks[bond.j];
      const trimmed = trimBondSegment(
        p1.x,
        p1.y,
        p2.x,
        p2.y,
        maskI ? labelInset(maskI, p1, p2) : 0,
        maskJ ? labelInset(maskJ, p2, p1) : 0,
      );
      if (!trimmed) continue;
      const selected = state.selectedBonds.has(bi);
      const hovered = state.hoveredBond === bi;
      const width = selected
        ? ink.selectedWidth
        : hovered
          ? ink.hoverWidth
          : ink.lineWidth;
      paintMarks(
        ctx,
        planBondMarks(
          { x: trimmed.x1, y: trimmed.y1 },
          { x: trimmed.x2, y: trimmed.y2 },
          bond.order,
          bond.stereo ?? "none",
          ink,
          width,
          bond.order === 2
            ? bondRingCentroid(data, atomPoints, adjacency, bi)
            : null,
        ),
        selected || hovered
          ? this.theme.selectionStroke
          : (bond.color ?? this.theme.bondStroke),
      );
    }

    const gesture = state.gesturePreview;
    const preview = gesture?.points.map((point) =>
      viewport.docToScreen(point.x, point.y),
    );
    if (gesture && preview?.length === 2) {
      const [start, end] = preview;
      const startMask =
        gesture.startAtom === undefined ? null : masks[gesture.startAtom];
      const endMask =
        gesture.endAtom === undefined ? null : masks[gesture.endAtom];
      const trimmed = trimBondSegment(
        start.x,
        start.y,
        end.x,
        end.y,
        startMask ? labelInset(startMask, start, end) : 0,
        endMask ? labelInset(endMask, end, start) : 0,
      );
      if (trimmed) {
        preview[0] = { x: trimmed.x1, y: trimmed.y1 };
        preview[1] = { x: trimmed.x2, y: trimmed.y2 };
      } else {
        preview.length = 0;
      }
    }
    if (preview && preview.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(preview[0].x, preview[0].y);
      for (let index = 1; index < preview.length; index++) {
        ctx.lineTo(preview[index].x, preview[index].y);
      }
      ctx.strokeStyle = this.theme.selectionStroke;
      ctx.lineWidth = ink.gestureWidthPx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(ink.gestureDashPx);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- Atom labels & selection rings ---
    for (let i = 0; i < data.atoms.length; i++) {
      const atom = data.atoms[i];
      const p = atomPoints[i];
      const selected = i !== editing?.index && state.selectedAtoms.has(i);
      const hovered = i !== editing?.index && state.hoveredAtom === i;
      const showLabel = labeled[i];
      const label = labels[i];

      if (selected || hovered) {
        // Open selection ring — structure-formula style, not a ball
        const r = showLabel
          ? ink.selectionRingLabeledPx
          : ink.selectionRingPlainPx;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = this.theme.selectionStroke;
        ctx.lineWidth = selected ? ink.hoverWidth : ink.lineWidth;
        ctx.globalAlpha = selected ? 1 : ink.hoverRingAlpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (!showLabel) {
        // Only an isolated implicit carbon gets an endpoint, using its custom
        // color and larger size when present.
        if (degrees[i] === 0) {
          ctx.beginPath();
          ctx.arc(
            p.x,
            p.y,
            atom.color ? ink.isolatedColoredRadiusPx : ink.isolatedRadiusPx,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = atom.color ?? this.theme.bondStroke;
          ctx.fill();
        }
      } else {
        ctx.textBaseline = "middle";
        for (const run of label.runs(fontPx)) {
          ctx.font = `${run.weight} ${run.size}px ${ink.fontFamily}`;
          ctx.textAlign = run.anchor === "middle" ? "center" : "left";
          ctx.fillStyle =
            run.role === "charge"
              ? (atom.color ?? this.theme.labelFill)
              : (atom.color ?? colorForElement(atom.element));
          ctx.fillText(
            run.text,
            p.x + run.dx,
            p.y + run.dy + ink.baselineNudgePx,
          );
        }
      }

      if (atom.port !== undefined) {
        this.paintPort(
          ctx,
          p,
          label.freeDirection,
          atom.port,
          showLabel ? ink.portLabeledRadiusPx : ink.portPlainRadiusPx,
          ink,
        );
      }
    }

    for (const [index, item] of annotations.entries()) {
      if (item.kind === "bracket")
        this.paintAnnotationShape(ctx, viewport, item);
      this.paintAnnotationText(ctx, viewport, item);
      if (
        state.selectedAnnotations?.has(index) ||
        state.hoveredAnnotation === index
      ) {
        ctx.strokeStyle = this.theme.selectionStroke;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        if (item.kind !== "text" && item.rotation) {
          const corners = annotationCorners({
            ...item,
            width: item.width + 6 / scale,
            height: item.height + 6 / scale,
          });
          ctx.beginPath();
          for (const [index, corner] of corners.entries()) {
            const { x, y } = viewport.docToScreen(corner.x, corner.y);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        } else {
          const bounds = annotationBounds(item);
          const start = viewport.docToScreen(bounds.minX, bounds.maxY);
          const end = viewport.docToScreen(bounds.maxX, bounds.minY);
          ctx.strokeRect(
            start.x - 3,
            start.y - 3,
            end.x - start.x + 6,
            end.y - start.y + 6,
          );
        }
        ctx.setLineDash([]);
      }
    }
    const resizable =
      state.resizeAnnotation === undefined
        ? undefined
        : annotations[state.resizeAnnotation];
    if (resizable && resizable.kind !== "text") {
      ctx.fillStyle = this.theme.background;
      ctx.strokeStyle = this.theme.selectionStroke;
      ctx.lineWidth = 1;
      for (const corner of annotationCorners(resizable)) {
        const { x, y } = viewport.docToScreen(corner.x, corner.y);
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.strokeRect(x - 3, y - 3, 6, 6);
      }
      const base = annotationRotationHandle(resizable, 0);
      const handle = annotationRotationHandle(
        resizable,
        ANNOTATION_ROTATION_HANDLE_PX / scale,
      );
      const start = viewport.docToScreen(base.x, base.y);
      const end = viewport.docToScreen(handle.x, handle.y);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (state.annotationPreview) {
      const item = state.annotationPreview;
      ctx.save();
      ctx.globalAlpha = 0.65;
      if (item.kind !== "text") this.paintAnnotationShape(ctx, viewport, item);
      this.paintAnnotationText(ctx, viewport, item);
      ctx.restore();
    }

    if (state.marquee) {
      const start = viewport.docToScreen(state.marquee.x0, state.marquee.y0);
      const end = viewport.docToScreen(state.marquee.x1, state.marquee.y1);
      const left = Math.min(start.x, end.x);
      const right = Math.max(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const bottom = Math.max(start.y, end.y);
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.fillStyle = this.theme.selectionStroke;
      ctx.globalAlpha = ink.marqueeFillAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = this.theme.selectionStroke;
      ctx.lineWidth = ink.marqueeWidthPx;
      ctx.setLineDash(ink.marqueeDashPx);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private paintAnnotationShape(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportCoords,
    item: Exclude<SketchAnnotation, { kind: "text" }>,
  ): void {
    if (item.kind === "bracket" && item.variant === "none") return;
    const { x, y } = viewport.docToScreen(item.x, item.y);
    const scale = viewport.getScale();
    const halfWidth = (item.width * scale) / 2;
    const halfHeight = (item.height * scale) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(annotationRotationRadians(item));
    ctx.beginPath();
    if (item.kind === "rectangle") {
      ctx.roundRect(
        -halfWidth,
        -halfHeight,
        halfWidth * 2,
        halfHeight * 2,
        annotationRadius(item) * scale,
      );
    } else if (item.kind === "ellipse") {
      ctx.ellipse(0, 0, halfWidth, halfHeight, 0, 0, Math.PI * 2);
    } else {
      for (const command of bracketCommands(item, 0, 0, scale)) {
        switch (command[0]) {
          case "M":
            ctx.moveTo(command[1], command[2]);
            break;
          case "L":
            ctx.lineTo(command[1], command[2]);
            break;
          case "Q":
            ctx.quadraticCurveTo(
              command[1],
              command[2],
              command[3],
              command[4],
            );
            break;
          case "C":
            ctx.bezierCurveTo(
              command[1],
              command[2],
              command[3],
              command[4],
              command[5],
              command[6],
            );
            break;
        }
      }
    }
    if (item.kind !== "bracket" && item.fill) {
      ctx.fillStyle = item.fill;
      ctx.fill();
    }
    const lineWidth = (item.strokeWidth ?? DEFAULT_ANNOTATION_STROKE) * scale;
    if (lineWidth > 0) {
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = item.stroke ?? this.theme.bondStroke;
      ctx.stroke();
    }
    ctx.restore();
  }

  private paintAnnotationText(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportCoords,
    item: SketchAnnotation,
  ): void {
    const scale = viewport.getScale();
    ctx.textBaseline = "middle";
    for (const text of annotationTexts(item)) {
      const { label, align, lines, step } = text;
      const { x, y } = viewport.docToScreen(text.x, text.y);
      ctx.font = annotationFont(label, scale);
      ctx.fillStyle = label.color ?? this.theme.labelFill;
      ctx.textAlign = align;
      for (const [index, line] of lines.entries()) {
        ctx.fillText(
          line,
          x,
          y + (index - (lines.length - 1) / 2) * step * scale,
        );
      }
    }
  }

  /**
   * Port (attachment point) marker: a dashed ring around the atom and the
   * descriptor (`<`, `>`, `$R` …) on a short stub pointing away from the
   * bonds — where the next unit would attach.
   */
  private paintPort(
    ctx: CanvasRenderingContext2D,
    p: { x: number; y: number },
    direction: { x: number; y: number },
    descriptor: string,
    ringRadius: number,
    ink: ReturnType<typeof depictionInk>,
  ): void {
    const color = this.theme.portStroke;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = ink.portLineWidthPx;
    ctx.setLineDash(ink.portDashPx);
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const stubEnd = ringRadius + ink.portStubPx;
    ctx.beginPath();
    ctx.moveTo(p.x + direction.x * ringRadius, p.y + direction.y * ringRadius);
    ctx.lineTo(p.x + direction.x * stubEnd, p.y + direction.y * stubEnd);
    ctx.stroke();
    const textAt = stubEnd + ink.portTextGapPx;
    ctx.font = `${ink.labelWeight} ${ink.portFontPx}px ${ink.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      descriptor,
      p.x + direction.x * textAt,
      p.y + direction.y * textAt,
    );
  }
}

function paintMarks(
  ctx: CanvasRenderingContext2D,
  marks: readonly BondMark[],
  stroke: string,
): void {
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const mark of marks) {
    if (mark.kind === "polygon") {
      ctx.beginPath();
      ctx.moveTo(mark.points[0].x, mark.points[0].y);
      ctx.lineTo(mark.points[1].x, mark.points[1].y);
      ctx.lineTo(mark.points[2].x, mark.points[2].y);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.lineWidth = mark.width;
    ctx.moveTo(mark.from.x, mark.from.y);
    ctx.lineTo(mark.to.x, mark.to.y);
    ctx.stroke();
  }
}

/** Shorten a segment from each end by inset pixels; null if degenerate. */
function trimBondSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  inset1: number,
  inset2: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  if (inset1 + inset2 >= len * 0.92) {
    // Still draw a short mid segment so topology is visible
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: mx - ux * 2,
      y1: my - uy * 2,
      x2: mx + ux * 2,
      y2: my + uy * 2,
    };
  }
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * inset1,
    y1: y1 + uy * inset1,
    x2: x2 - ux * inset2,
    y2: y2 - uy * inset2,
  };
}
