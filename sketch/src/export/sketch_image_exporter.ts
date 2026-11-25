import {
  annotationBounds,
  annotationRadius,
  annotationTexts,
  bracketCommands,
  DEFAULT_ANNOTATION_STROKE,
  type SketchAnnotation,
} from "../annotations";
import { ViewportCoords } from "../board/coords";
import {
  SketchRenderer,
  type SketchRenderTheme,
} from "../board/sketch_renderer";
import { bondRingCentroid } from "../geometry/bond_ring";
import type { MoleculeGraph } from "../molecule_graph";
import { AtomLabel, atomLabelWidth } from "../style/atom_label";
import {
  type BondMark,
  DEPICTION_TOKENS,
  type DepictionInk,
  depictionInk,
  labelInset,
  labelMask,
  planBondMarks,
  portReachDoc,
} from "../style/depiction-tokens";
import { colorForElement, isLabeledElement } from "../style/element_colors";
import type { MoleculeData } from "../types";

const DEFAULT_EXPORT_WIDTH = 1200;
const DEFAULT_EXPORT_HEIGHT = 800;
const DEFAULT_EXPORT_PADDING = 48;
const DEFAULT_PIXEL_RATIO = 2;
const MAX_EXPORT_DIMENSION = 8192;
const MAX_PIXEL_RATIO = 4;
const MAX_EXPORT_SCALE = 72;

export interface SketchExportView {
  centerX: number;
  centerY: number;
  /** Output CSS pixels per document unit. */
  scale: number;
}

export interface SketchExportOptions {
  /** Export surface width in CSS pixels. Default 1200. */
  width?: number;
  /** Export height in CSS pixels. Defaults to 800 for molecules or the fitted figure height. */
  height?: number;
  /** Minimum whitespace around the fitted molecule in CSS pixels. Default 48. */
  padding?: number;
  /** PNG backing-store multiplier. Default 2; ignored by SVG export. */
  pixelRatio?: number;
  /** Paper color. Defaults to the board render theme background. */
  background?: string;
  /** Reuse an existing camera instead of fitting the drawing. */
  view?: SketchExportView;
}

interface ExportLayout {
  width: number;
  height: number;
  pixelRatio: number;
  background: string;
  centerX: number;
  centerY: number;
  scale: number;
  fontPx: number;
  ink: DepictionInk;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Stateless image exporter owned by a {@link SketchBoard}.
 *
 * The exporter always fits a clean molecule snapshot: editor selection,
 * hover, marquee, and gesture previews never leak into exported artwork.
 */
export class SketchImageExporter {
  constructor(
    private readonly graph: MoleculeGraph,
    private readonly theme: SketchRenderTheme,
    private readonly omitCarbonLabel: boolean,
    private readonly annotations: readonly SketchAnnotation[] = [],
  ) {}

  getView(options: SketchExportOptions): SketchExportView {
    const { centerX, centerY, scale } = resolveLayout(
      this.graph.getMoleculeData(),
      this.annotations,
      this.theme,
      options,
    );
    return { centerX, centerY, scale };
  }

  toSvg(options: SketchExportOptions = {}): string {
    const data = this.graph.getMoleculeData();
    const layout = resolveLayout(data, this.annotations, this.theme, options);
    const atomPoints = data.atoms.map((atom) =>
      toScreen(atom.x, atom.y, layout),
    );
    const labeled = data.atoms.map((atom) =>
      isLabeledElement(atom.element, {
        omitCarbonLabel: this.omitCarbonLabel,
        charge: atom.charge,
        forceLabel: Boolean(atom.label),
      }),
    );
    const degrees = atomDegrees(data);
    const { ink } = layout;
    const adjacency = Array.from(
      { length: data.atoms.length },
      (): Array<{ atom: number; bond: number }> => [],
    );
    data.bonds.forEach((bond, bondIndex) => {
      adjacency[bond.i]?.push({ atom: bond.j, bond: bondIndex });
      adjacency[bond.j]?.push({ atom: bond.i, bond: bondIndex });
    });
    const labels = data.atoms.map((atom, index) => {
      const point = atomPoints[index] ?? { x: 0, y: 0 };
      return new AtomLabel(
        atom,
        point,
        (adjacency[index] ?? []).map((edge) => atomPoints[edge.atom] ?? point),
      );
    });
    const masks = labels.map((label, index) =>
      labeled[index]
        ? labelMask(label.extent(ink.fontPx), ink.fontPx, label.hasHydrogens)
        : null,
    );
    const body: string[] = [
      `<rect width="${layout.width}" height="${layout.height}" fill="${escapeXml(layout.background)}"/>`,
    ];

    for (const item of this.annotations) {
      if (item.kind === "rectangle" || item.kind === "ellipse") {
        body.push(svgAnnotationShape(item, layout, this.theme.bondStroke));
      }
    }

    data.bonds.forEach((bond, bondIndex) => {
      const first = atomPoints[bond.i];
      const second = atomPoints[bond.j];
      if (!first || !second) return;
      const maskI = masks[bond.i];
      const maskJ = masks[bond.j];
      const segment = trimSegment(
        first,
        second,
        maskI ? labelInset(maskI, first, second) : 0,
        maskJ ? labelInset(maskJ, second, first) : 0,
      );
      if (!segment) return;
      body.push(
        ...svgMarks(
          planBondMarks(
            segment.start,
            segment.end,
            bond.order,
            bond.stereo ?? "none",
            ink,
            ink.lineWidth,
            bond.order === 2
              ? bondRingCentroid(data, atomPoints, adjacency, bondIndex)
              : null,
          ),
          bond.color ?? this.theme.bondStroke,
        ),
      );
    });

    for (let index = 0; index < data.atoms.length; index++) {
      const atom = data.atoms[index];
      const point = atomPoints[index];
      const label = labels[index];
      if (!atom || !point || !label) continue;
      if (!labeled[index]) {
        if (degrees[index] === 0) {
          const r = atom.color
            ? ink.isolatedColoredRadiusPx
            : ink.isolatedRadiusPx;
          body.push(
            `<circle cx="${num(point.x)}" cy="${num(point.y)}" r="${num(r)}" fill="${escapeXml(atom.color ?? this.theme.bondStroke)}"/>`,
          );
        }
      } else {
        for (const run of label.runs(ink.fontPx)) {
          const fill =
            run.role === "charge"
              ? (atom.color ?? this.theme.labelFill)
              : (atom.color ?? colorForElement(atom.element));
          body.push(
            `<text x="${num(point.x + run.dx)}" y="${num(point.y + run.dy + ink.baselineNudgePx)}" fill="${escapeXml(fill)}" font-family="${escapeXml(ink.fontFamily)}" font-size="${num(run.size)}" font-weight="${run.weight}" text-anchor="${run.anchor}" dominant-baseline="central">${escapeXml(run.text)}</text>`,
          );
        }
      }

      if (atom.port !== undefined) {
        body.push(
          ...svgPort(
            point,
            label.freeDirection,
            atom.port,
            labeled[index] ? ink.portLabeledRadiusPx : ink.portPlainRadiusPx,
            ink,
            this.theme.portStroke,
          ),
        );
      }
    }

    for (const item of this.annotations) {
      if (item.kind === "bracket" && item.variant !== "none")
        body.push(svgAnnotationShape(item, layout, this.theme.bondStroke));
      body.push(...svgAnnotationText(item, layout, this.theme.labelFill));
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${this.annotations.length ? "Sketch figure" : "Molecule structure"}">`,
      ...body,
      "</svg>",
    ].join("\n");
  }

  async toPng(options: SketchExportOptions = {}): Promise<Blob> {
    const data = this.graph.getMoleculeData();
    const layout = resolveLayout(data, this.annotations, this.theme, options);
    const canvas = document.createElement("canvas");
    const viewport = new ViewportCoords();
    viewport.resize(layout.width, layout.height, layout.pixelRatio);
    viewport.setPan(layout.centerX, layout.centerY);
    viewport.setScale(layout.scale);
    const backingStore = viewport.getBackingStoreSize();
    canvas.width = backingStore.width;
    canvas.height = backingStore.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable");
    }
    const renderer = new SketchRenderer();
    renderer.setTheme({
      ...this.theme,
      background: layout.background,
    });
    renderer.paint(context, this.graph, viewport, {
      annotations: this.annotations,
      selectedAtoms: new Set(),
      selectedBonds: new Set(),
      omitCarbonLabel: this.omitCarbonLabel,
      atomRadiusDoc: 0,
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("PNG encoding failed"));
        }
      }, "image/png");
    });
  }
}

function resolveLayout(
  data: MoleculeData,
  annotations: readonly SketchAnnotation[],
  theme: SketchRenderTheme,
  options: SketchExportOptions,
): ExportLayout {
  const bounds = moleculeBounds(data, annotations);
  // Leave room for atom labels and stroke ends.
  const spanX = Math.max(bounds.maxX - bounds.minX + 1, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY + 1, 1);
  const width = integerOption(
    "width",
    options.width,
    DEFAULT_EXPORT_WIDTH,
    MAX_EXPORT_DIMENSION,
  );
  const height = integerOption(
    "height",
    options.height,
    annotations.length > 0 && options.width === undefined
      ? Math.min(
          MAX_EXPORT_DIMENSION,
          Math.round(((width - DEFAULT_EXPORT_PADDING * 2) * spanY) / spanX) +
            DEFAULT_EXPORT_PADDING * 2,
        )
      : DEFAULT_EXPORT_HEIGHT,
    MAX_EXPORT_DIMENSION,
  );
  const padding = finiteOption(
    "padding",
    options.padding,
    DEFAULT_EXPORT_PADDING,
    0,
    Math.min(width, height) / 2,
  );
  const pixelRatio = finiteOption(
    "pixelRatio",
    options.pixelRatio,
    DEFAULT_PIXEL_RATIO,
    Number.EPSILON,
    MAX_PIXEL_RATIO,
  );
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const fittedScale = Math.min(
    usableWidth / spanX,
    usableHeight / spanY,
    MAX_EXPORT_SCALE,
  );
  const scale = options.view
    ? finiteOption(
        "view.scale",
        options.view.scale,
        fittedScale,
        Number.EPSILON,
        Infinity,
      )
    : fittedScale;

  // Same ratios as the canvas. A pixel ceiling here is what made labels and
  // double-bond gaps stay small while the fitted bond grew.
  const ink = depictionInk(scale);

  return {
    width,
    height,
    pixelRatio,
    background: options.background ?? theme.background,
    centerX: finiteOption(
      "view.centerX",
      options.view?.centerX,
      (bounds.minX + bounds.maxX) / 2,
      -Infinity,
      Infinity,
    ),
    centerY: finiteOption(
      "view.centerY",
      options.view?.centerY,
      (bounds.minY + bounds.maxY) / 2,
      -Infinity,
      Infinity,
    ),
    scale,
    fontPx: ink.fontPx,
    ink,
  };
}

function moleculeBounds(
  data: MoleculeData,
  annotations: readonly SketchAnnotation[],
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (data.atoms.length === 0 && annotations.length === 0) {
    return { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const atom of data.atoms) {
    // A port marker reaches about one bond past its atom; keep it on paper.
    const reach = atom.port !== undefined ? portReachDoc() : 0;
    const labelReach = atom.label
      ? atomLabelWidth(atom.label, DEPICTION_TOKENS.fontSizeRatio) / 2
      : 0;
    minX = Math.min(minX, atom.x - Math.max(reach, labelReach));
    minY = Math.min(minY, atom.y - reach);
    maxX = Math.max(maxX, atom.x + Math.max(reach, labelReach));
    maxY = Math.max(maxY, atom.y + reach);
  }
  for (const item of annotations) {
    const bounds = annotationBounds(item);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  return { minX, minY, maxX, maxY };
}

function atomDegrees(data: MoleculeData): Uint32Array {
  const degrees = new Uint32Array(data.atoms.length);
  for (const bond of data.bonds) {
    if (bond.i < degrees.length) degrees[bond.i] += 1;
    if (bond.j < degrees.length) degrees[bond.j] += 1;
  }
  return degrees;
}

function toScreen(x: number, y: number, layout: ExportLayout): Point {
  return {
    x: (x - layout.centerX) * layout.scale + layout.width / 2,
    y: layout.height / 2 - (y - layout.centerY) * layout.scale,
  };
}

function trimSegment(
  start: Point,
  end: Point,
  startInset: number,
  endInset: number,
): { start: Point; end: Point } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;
  if (startInset + endInset >= length * 0.92) {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const unitX = dx / length;
    const unitY = dy / length;
    return {
      start: { x: midX - unitX * 2, y: midY - unitY * 2 },
      end: { x: midX + unitX * 2, y: midY + unitY * 2 },
    };
  }
  const unitX = dx / length;
  const unitY = dy / length;
  return {
    start: {
      x: start.x + unitX * startInset,
      y: start.y + unitY * startInset,
    },
    end: {
      x: end.x - unitX * endInset,
      y: end.y - unitY * endInset,
    },
  };
}

function svgAnnotationShape(
  item: Exclude<SketchAnnotation, { kind: "text" }>,
  layout: ExportLayout,
  ink: string,
): string {
  const { x, y } = toScreen(item.x, item.y, layout);
  const halfWidth = (item.width * layout.scale) / 2;
  const halfHeight = (item.height * layout.scale) / 2;
  const left = x - halfWidth;
  const top = y - halfHeight;
  const fill = item.kind === "bracket" ? "none" : (item.fill ?? "none");
  const strokeWidth =
    (item.strokeWidth ?? DEFAULT_ANNOTATION_STROKE) * layout.scale;
  const transform = item.rotation
    ? ` transform="rotate(${num(item.rotation)} ${num(x)} ${num(y)})"`
    : "";
  const style = `fill="${escapeXml(fill)}" stroke="${escapeXml(item.stroke ?? ink)}" stroke-width="${num(strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"${transform}`;
  if (item.kind === "rectangle") {
    return `<rect x="${num(left)}" y="${num(top)}" width="${num(halfWidth * 2)}" height="${num(halfHeight * 2)}" rx="${num(annotationRadius(item) * layout.scale)}" ${style}/>`;
  }
  if (item.kind === "ellipse") {
    return `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${num(halfWidth)}" ry="${num(halfHeight)}" ${style}/>`;
  }
  const path = bracketCommands(item, x, y, layout.scale)
    .map(
      ([command, ...coordinates]) =>
        `${command} ${coordinates.map(num).join(" ")}`,
    )
    .join(" ");
  return `<path d="${path}" ${style}/>`;
}

function svgAnnotationText(
  item: SketchAnnotation,
  layout: ExportLayout,
  ink: string,
): string[] {
  return annotationTexts(item).flatMap((text) => {
    const { label, align, lines, step } = text;
    const { x, y } = toScreen(text.x, text.y, layout);
    const anchor =
      align === "center" ? "middle" : align === "right" ? "end" : "start";
    return lines.map((line, index) => {
      const baseline =
        y + (index - (lines.length - 1) / 2) * step * layout.scale;
      return `<text x="${num(x)}" y="${num(baseline)}" fill="${escapeXml(label.color ?? ink)}" font-family="${label.family ?? "sans-serif"}" font-size="${num(label.size * layout.scale)}" font-weight="${label.bold ? "bold" : "normal"}" font-style="${label.italic ? "italic" : "normal"}" text-anchor="${anchor}" dominant-baseline="central" xml:space="preserve">${escapeXml(line)}</text>`;
    });
  });
}

function svgMarks(marks: readonly BondMark[], color: string): string[] {
  const stroke = escapeXml(color);
  return marks.map((mark) => {
    if (mark.kind === "polygon") {
      const points = mark.points
        .map((point) => `${num(point.x)},${num(point.y)}`)
        .join(" ");
      return `<polygon points="${points}" fill="${stroke}"/>`;
    }
    return `<line x1="${num(mark.from.x)}" y1="${num(mark.from.y)}" x2="${num(mark.to.x)}" y2="${num(mark.to.y)}" stroke="${stroke}" stroke-width="${num(mark.width)}" stroke-linecap="round"/>`;
  });
}

/** Port marker in SVG — same geometry as `SketchRenderer.paintPort`. */
function svgPort(
  p: Point,
  direction: Point,
  descriptor: string,
  ringRadius: number,
  ink: DepictionInk,
  color: string,
): string[] {
  const stroke = escapeXml(color);
  const stubEnd = ringRadius + ink.portStubPx;
  const textAt = stubEnd + ink.portTextGapPx;
  const dash = `${num(ink.portDashPx[0])} ${num(ink.portDashPx[1])}`;
  return [
    `<g class="msk-port" data-port="${escapeXml(descriptor)}">`,
    `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(ringRadius)}" fill="none" stroke="${stroke}" stroke-width="${num(ink.portLineWidthPx)}" stroke-dasharray="${dash}"/>`,
    `<line x1="${num(p.x + direction.x * ringRadius)}" y1="${num(p.y + direction.y * ringRadius)}" x2="${num(p.x + direction.x * stubEnd)}" y2="${num(p.y + direction.y * stubEnd)}" stroke="${stroke}" stroke-width="${num(ink.portLineWidthPx)}" stroke-linecap="round"/>`,
    `<text x="${num(p.x + direction.x * textAt)}" y="${num(p.y + direction.y * textAt)}" fill="${stroke}" font-family="${escapeXml(ink.fontFamily)}" font-size="${num(ink.portFontPx)}" font-weight="${ink.labelWeight}" text-anchor="middle" dominant-baseline="central">${escapeXml(descriptor)}</text>`,
    "</g>",
  ];
}

function integerOption(
  name: string,
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  if (
    !Number.isFinite(resolved) ||
    resolved <= 0 ||
    resolved > maximum ||
    !Number.isInteger(resolved)
  ) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return resolved;
}

function finiteOption(
  name: string,
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be in [${minimum}, ${maximum}]`);
  }
  return resolved;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function num(value: number): string {
  return Number(value.toFixed(3)).toString();
}
