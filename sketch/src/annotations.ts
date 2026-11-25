import { type Point, rotate } from "./geometry/plane";
import { normalizeSketchColor } from "./style/custom_color";
import type { MoleculeData } from "./types";

export interface AnnotationLabel {
  text: string;
  /** Font size in document units. Each line is centred vertically as a block. */
  size: number;
  color?: string;
  family?: "sans-serif" | "serif" | "monospace";
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
}

interface AnnotationOrigin {
  x: number;
  y: number;
}

interface AnnotationShape extends AnnotationOrigin {
  width: number;
  height: number;
  /** Clockwise degrees around the shape centre. Default zero. */
  rotation?: number;
  stroke?: string;
  /** Stroke width in document units. Zero hides the stroke. */
  strokeWidth?: number;
  label?: AnnotationLabel;
}

export const ANNOTATION_CORNERS = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
] as const;
export type AnnotationCorner = (typeof ANNOTATION_CORNERS)[number];

export const BRACKET_VARIANTS = ["square", "round", "curly", "none"] as const;
export type BracketVariant = (typeof BRACKET_VARIANTS)[number];

export interface BracketAnnotation extends AnnotationShape {
  kind: "bracket";
  variant: BracketVariant;
  /** Legacy `label` is used for bottomRight when that corner is omitted. */
  cornerLabels?: Partial<Record<AnnotationCorner, AnnotationLabel>>;
}

/** Free artwork in document coordinates. Shapes are centred on (x, y). */
export type SketchAnnotation =
  | (AnnotationOrigin & { kind: "text"; label: AnnotationLabel })
  | (AnnotationShape & { kind: "rectangle"; fill?: string; radius?: number })
  | (AnnotationShape & { kind: "ellipse"; fill?: string })
  | BracketAnnotation;

export type ResizableAnnotation = Exclude<SketchAnnotation, { kind: "text" }>;

export function annotationRotationRadians(item: ResizableAnnotation): number {
  return ((item.rotation ?? 0) * Math.PI) / 180;
}

export function annotationPoint(
  item: ResizableAnnotation,
  point: Point,
  space: "world" | "local" = "world",
): Point {
  const angle = annotationRotationRadians(item);
  if (!angle) return point;
  // Document coordinates have an upward y-axis.
  return rotate(point, item, space === "world" ? -angle : angle);
}

export function annotationCorners(item: ResizableAnnotation): Point[] {
  const { x, y, width, height } = item;
  const left = x - width / 2;
  const right = x + width / 2;
  const top = y + height / 2;
  const bottom = y - height / 2;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ].map((point) => annotationPoint(item, point));
}

export const ANNOTATION_ROTATION_HANDLE_PX = 22;

export function annotationRotationHandle(
  item: ResizableAnnotation,
  distance: number,
): Point {
  return annotationPoint(item, {
    x: item.x,
    y: item.y + item.height / 2 + distance,
  });
}

export const DEFAULT_TEXT_ANNOTATION = {
  kind: "text",
  x: 0,
  y: 0,
  label: { text: "Text", size: 0.65 },
} as const satisfies SketchAnnotation;

export const DEFAULT_BRACKET_LABEL = {
  size: 0.53,
  family: "serif",
  italic: true,
} as const;

export interface SketchDocument extends MoleculeData {
  annotations: SketchAnnotation[];
}

export interface AnnotationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function normalizeAnnotation(item: SketchAnnotation): SketchAnnotation {
  if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)) {
    throw new Error("Annotation coordinates must be finite");
  }
  const { x, y, kind } = item;
  const label =
    item.label === undefined ? undefined : normalizeLabel(item.label);
  if (kind === "text") {
    if (!label?.text.trim()) throw new Error("Text cannot be empty");
    return { kind, x, y, label };
  }
  if (kind !== "rectangle" && kind !== "ellipse" && kind !== "bracket") {
    throw new Error("Unknown annotation type");
  }
  const { width, height, rotation, stroke, strokeWidth } = item;
  if (
    !(
      width > 0 &&
      Number.isFinite(width) &&
      height > 0 &&
      Number.isFinite(height)
    )
  ) {
    throw new Error(
      "Annotation width and height must be positive finite numbers",
    );
  }
  if (rotation !== undefined && !Number.isFinite(rotation))
    throw new Error("Annotation rotation must be finite");
  const shape = {
    x,
    y,
    width,
    height,
    rotation:
      rotation === undefined
        ? undefined
        : ((rotation % 360) + 360) % 360 || undefined,
    stroke: stroke === undefined ? undefined : normalizeSketchColor(stroke),
    strokeWidth:
      strokeWidth === undefined
        ? undefined
        : nonnegative(strokeWidth, "Stroke width"),
    label,
  };
  if (kind === "bracket") {
    if (!BRACKET_VARIANTS.includes(item.variant)) {
      throw new Error("Unknown repeat bracket style");
    }
    const cornerLabels = item.cornerLabels;
    if (
      cornerLabels !== undefined &&
      (!cornerLabels ||
        typeof cornerLabels !== "object" ||
        Array.isArray(cornerLabels))
    ) {
      throw new Error("Bracket labels must be keyed by corner");
    }
    const normalized: BracketAnnotation["cornerLabels"] = {};
    for (const corner of ANNOTATION_CORNERS) {
      const entry = cornerLabels?.[corner];
      if (entry !== undefined) normalized[corner] = normalizeLabel(entry);
    }
    return {
      ...shape,
      kind,
      variant: item.variant,
      cornerLabels: Object.keys(normalized).length ? normalized : undefined,
    };
  }
  const fill =
    item.fill === undefined ? undefined : normalizeSketchColor(item.fill);
  return kind === "ellipse"
    ? { ...shape, kind, fill }
    : {
        ...shape,
        kind,
        fill,
        radius:
          item.radius === undefined
            ? undefined
            : nonnegative(item.radius, "Corner radius"),
      };
}

function normalizeLabel(label: AnnotationLabel): AnnotationLabel {
  if (
    !label ||
    typeof label.text !== "string" ||
    !(label.size > 0 && Number.isFinite(label.size))
  ) {
    throw new Error(
      "Annotation labels need text and a positive finite font size",
    );
  }
  const { family, align, bold, italic } = label;
  if (
    family !== undefined &&
    family !== "sans-serif" &&
    family !== "serif" &&
    family !== "monospace"
  ) {
    throw new Error("Unknown annotation font family");
  }
  if (
    align !== undefined &&
    align !== "left" &&
    align !== "center" &&
    align !== "right"
  ) {
    throw new Error("Unknown annotation text alignment");
  }
  if (
    (bold !== undefined && typeof bold !== "boolean") ||
    (italic !== undefined && typeof italic !== "boolean")
  ) {
    throw new Error("Annotation font styles must be boolean");
  }
  return {
    text: label.text.replace(/\r\n?/g, "\n"),
    size: label.size,
    color:
      label.color === undefined ? undefined : normalizeSketchColor(label.color),
    family,
    align,
    bold,
    italic,
  };
}

function nonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
  return value;
}

export const DEFAULT_ANNOTATION_STROKE = 0.06;

export function annotationRadius(
  item: Extract<SketchAnnotation, { kind: "rectangle" }>,
): number {
  return Math.min(item.radius ?? 0.25, item.width / 2, item.height / 2);
}

export function annotationFont(label: AnnotationLabel, scale: number): string {
  return `${label.italic ? "italic " : ""}${label.bold ? "bold " : ""}${label.size * scale}px ${label.family ?? "sans-serif"}`;
}

export function annotationLabel(
  item: SketchAnnotation,
  corner: AnnotationCorner,
): AnnotationLabel | undefined {
  if (item.kind !== "bracket") return item.label;
  return (
    item.cornerLabels?.[corner] ??
    (corner === "bottomRight" ? item.label : undefined)
  );
}

export function withAnnotationLabel(
  item: SketchAnnotation,
  label: AnnotationLabel,
  corner: AnnotationCorner,
): SketchAnnotation {
  if (item.kind === "text") return { ...item, label };
  const content = label.text.trim() ? label : undefined;
  if (item.kind !== "bracket") return { ...item, label: content };
  const cornerLabels = { ...item.cornerLabels };
  if (content) cornerLabels[corner] = content;
  else delete cornerLabels[corner];
  return {
    ...item,
    label: corner === "bottomRight" ? undefined : item.label,
    cornerLabels,
  };
}

export function annotationText(
  item: SketchAnnotation,
  corner: AnnotationCorner,
  label = annotationLabel(item, corner),
) {
  if (!label?.text) return undefined;
  const lines = label.text.split("\n");
  const step = label.size * 1.2;
  const inset = label.size * 0.16;
  if (item.kind === "bracket") {
    const left = corner === "topLeft" || corner === "bottomLeft";
    const top = corner === "topLeft" || corner === "topRight";
    const anchor = annotationPoint(item, {
      x: item.x + (left ? -1 : 1) * (item.width / 2 + inset),
      y: item.y + ((top ? 1 : -1) * item.height) / 2,
    });
    const align = anchor.x < item.x ? "right" : "left";
    return { label, align, ...anchor, lines, step } as const;
  }
  const align = label.align ?? "center";
  let anchor = { x: item.x, y: item.y };
  if (item.kind !== "text" && align !== "center") {
    const edge = Math.max(0, item.width / 2 - inset);
    anchor = annotationPoint(item, {
      x: item.x + (align === "left" ? -edge : edge),
      y: item.y,
    });
  }
  return { label, align, ...anchor, lines, step };
}

type AnnotationText = NonNullable<ReturnType<typeof annotationText>>;

export function annotationTexts(item: SketchAnnotation): AnnotationText[] {
  const corners =
    item.kind === "bracket" ? ANNOTATION_CORNERS : (["bottomRight"] as const);
  return corners.flatMap((corner) => {
    const text = annotationText(item, corner);
    return text?.label.text.trim() ? [text] : [];
  });
}

function annotationLabelBounds(
  text: AnnotationText,
  measuredWidth?: number,
): AnnotationBounds {
  // SVG export also runs without a canvas. Allow room for wide glyphs and CJK.
  let textWidth = measuredWidth ?? 0;
  if (measuredWidth === undefined) {
    for (const line of text.lines) {
      let lineWidth = 0;
      for (const character of line) {
        lineWidth += /\p{Script=Han}|\p{Extended_Pictographic}/u.test(character)
          ? 1
          : 0.68;
      }
      textWidth = Math.max(textWidth, lineWidth);
    }
    textWidth *= text.label.size;
  }
  const textHeight = text.lines.length * text.step;
  const textLeft =
    text.x -
    (text.align === "left"
      ? 0
      : text.align === "right"
        ? textWidth
        : textWidth / 2);
  return {
    minX: textLeft,
    maxX: textLeft + textWidth,
    minY: text.y - textHeight / 2,
    maxY: text.y + textHeight / 2,
  };
}

export function measureAnnotationText(
  context: CanvasRenderingContext2D,
  text: AnnotationText,
  scale: number,
): { font: string; width: number } {
  const font = annotationFont(text.label, scale);
  context.save();
  context.font = font;
  let width = 0;
  for (const line of text.lines)
    width = Math.max(width, context.measureText(line).width);
  context.restore();
  return { font, width };
}

/** Find the visible label near the pointer and approach it from outside. */
export function snapToAnnotationText(
  items: readonly SketchAnnotation[],
  from: Point,
  pointer: Point,
  tolerance: number,
  gap: number,
  measureWidth?: (text: AnnotationText) => number,
): Point | undefined {
  for (let index = items.length - 1; index >= 0; index--) {
    for (const text of annotationTexts(items[index])) {
      const bounds = annotationLabelBounds(text, measureWidth?.(text));
      if (!contains(bounds, pointer.x, pointer.y, tolerance)) continue;
      const x = (bounds.minX + bounds.maxX) / 2;
      const y = (bounds.minY + bounds.maxY) / 2;
      const dx = from.x - x;
      const dy = from.y - y;
      const ratio = Math.max(
        Math.abs(dx) / ((bounds.maxX - bounds.minX) / 2 + gap),
        Math.abs(dy) / ((bounds.maxY - bounds.minY) / 2 + gap),
      );
      if (ratio > 1) return { x: x + dx / ratio, y: y + dy / ratio };
    }
  }
  return undefined;
}

export function annotationBounds(item: SketchAnnotation): AnnotationBounds {
  const stroke =
    item.kind === "text" || (item.kind === "bracket" && item.variant === "none")
      ? 0
      : (item.strokeWidth ?? DEFAULT_ANNOTATION_STROKE) / 2;
  const angle = item.kind === "text" ? 0 : annotationRotationRadians(item);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const w = item.kind === "text" ? 0 : item.width / 2;
  const h = item.kind === "text" ? 0 : item.height / 2;
  const extent =
    item.kind === "ellipse" ? Math.hypot : (a: number, b: number) => a + b;
  const halfWidth = extent(w * cos, h * sin) + stroke;
  const halfHeight = extent(w * sin, h * cos) + stroke;
  const bounds = {
    minX: item.x - halfWidth,
    maxX: item.x + halfWidth,
    minY: item.y - halfHeight,
    maxY: item.y + halfHeight,
  };
  for (const text of annotationTexts(item)) {
    const label = annotationLabelBounds(text);
    bounds.minX = Math.min(bounds.minX, label.minX);
    bounds.maxX = Math.max(bounds.maxX, label.maxX);
    bounds.minY = Math.min(bounds.minY, label.minY);
    bounds.maxY = Math.max(bounds.maxY, label.maxY);
  }
  return bounds;
}

/** Signed distance to the edge of a rounded rectangle. */
function rectangleDistance(
  item: Extract<SketchAnnotation, { kind: "rectangle" }>,
  x: number,
  y: number,
): number {
  const radius = annotationRadius(item);
  const dx = Math.abs(x - item.x) - item.width / 2 + radius;
  const dy = Math.abs(y - item.y) - item.height / 2 + radius;
  return (
    Math.hypot(Math.max(0, dx), Math.max(0, dy)) +
    Math.min(0, Math.max(dx, dy)) -
    radius
  );
}

/** Panels grab at their border, leaving the interior available for marquee. */
export function hitAnnotation(
  item: SketchAnnotation,
  x: number,
  y: number,
  tolerance: number,
): boolean {
  if (
    annotationTexts(item).some((text) =>
      contains(annotationLabelBounds(text), x, y, tolerance),
    )
  )
    return true;
  if (item.kind === "text") return false;
  const point = annotationPoint(item, { x, y }, "local");
  const strokeTolerance =
    tolerance + (item.strokeWidth ?? DEFAULT_ANNOTATION_STROKE) / 2;
  if (item.kind === "rectangle")
    return (
      Math.abs(rectangleDistance(item, point.x, point.y)) <= strokeTolerance
    );
  if (item.kind === "bracket") {
    const dx = Math.abs(point.x - item.x);
    return (
      Math.abs(point.y - item.y) <= item.height / 2 + strokeTolerance &&
      Math.abs(dx - item.width / 2) <= bracketHook(item) + strokeTolerance
    );
  }
  return (
    Math.hypot(
      (point.x - item.x) / (item.width / 2 + strokeTolerance),
      (point.y - item.y) / (item.height / 2 + strokeTolerance),
    ) <= 1
  );
}

function contains(
  bounds: AnnotationBounds,
  x: number,
  y: number,
  tolerance: number,
): boolean {
  return (
    x >= bounds.minX - tolerance &&
    x <= bounds.maxX + tolerance &&
    y >= bounds.minY - tolerance &&
    y <= bounds.maxY + tolerance
  );
}

function bracketHook(
  item: Extract<SketchAnnotation, { kind: "bracket" }>,
): number {
  return Math.min(item.width * 0.23, item.height * 0.19);
}

type BracketCommand =
  | [command: "M" | "L", x: number, y: number]
  | [command: "Q", controlX: number, controlY: number, x: number, y: number]
  | [
      command: "C",
      firstX: number,
      firstY: number,
      secondX: number,
      secondY: number,
      x: number,
      y: number,
    ];

/** The same screen-space stroke commands feed Canvas and SVG. */
export function bracketCommands(
  item: Extract<SketchAnnotation, { kind: "bracket" }>,
  x: number,
  y: number,
  scale: number,
): BracketCommand[] {
  if (item.variant === "none") return [];
  const halfWidth = (item.width * scale) / 2;
  const halfHeight = (item.height * scale) / 2;
  const top = y - halfHeight;
  const bottom = y + halfHeight;
  const hook = bracketHook(item) * scale;
  const commands: BracketCommand[] = [];
  for (const side of [-1, 1]) {
    const edge = x + side * halfWidth;
    const tip = edge - side * hook;
    commands.push(["M", tip, top]);
    if (item.variant === "square") {
      commands.push(["L", edge, top], ["L", edge, bottom], ["L", tip, bottom]);
    } else if (item.variant === "round") {
      commands.push(["Q", edge + side * hook, y, tip, bottom]);
    } else {
      const spine = edge - side * hook * 0.55;
      const shoulder = halfHeight / 2;
      commands.push(
        ["C", spine, top, spine, top + shoulder * 0.25, spine, y - shoulder],
        ["C", spine, y - shoulder * 0.35, spine, y, edge, y],
        ["C", spine, y, spine, y + shoulder * 0.35, spine, y + shoulder],
        ["C", spine, bottom - shoulder * 0.25, spine, bottom, tip, bottom],
      );
    }
  }
  return commands;
}
