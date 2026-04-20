/**
 * MarkAtomOverlay — a composite overlay that marks an atom.
 *
 * One mark = one atom (or one world point) + an optional shape + an optional
 * text label, managed as a single unit with a single id. Intended for
 * annotating pSMILES / bigSMILES endpoints, reactive sites, or atoms flagged
 * by external analyses.
 *
 * The shape component is a pure 3D world-space mesh (translucent sphere halo).
 * The label component uses BabylonJS GUI and projects to screen each render
 * frame, so updateScreenPositions() is implemented only when a label is active.
 *
 * Atom anchoring is routed through the shared AtomAnchored protocol — the
 * per-frame sync dispatch in MolvisApp handles all anchored overlays uniformly.
 */

import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";
import {
  type AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import type {
  AtomAnchored,
  MarkAtomProps,
  MarkLabel,
  MarkShape,
  Overlay,
  Vec3,
} from "./types";

const DEFAULT_SHAPE_COLOR = "#ffd54a";
const DEFAULT_SHAPE_OPACITY = 0.35;
const DEFAULT_SHAPE_RADIUS = 0.6;
const DEFAULT_SHAPE_SEGMENTS = 24;

const DEFAULT_LABEL_COLOR = "white";
const DEFAULT_LABEL_FONT_SIZE = 14;

let _counter = 0;
function nextId(): string {
  return `mark_atom_${++_counter}`;
}

function hexToColor3(hex: string): Color3 {
  const h = hex.replace(/^#/, "");
  const r = Number.parseInt(h.substring(0, 2), 16) / 255;
  const g = Number.parseInt(h.substring(2, 4), 16) / 255;
  const b = Number.parseInt(h.substring(4, 6), 16) / 255;
  return new Color3(r, g, b);
}

type ResolvedShape = Required<MarkShape>;
type ResolvedLabel = Required<MarkLabel>;

interface ResolvedProps {
  position: Vec3;
  anchorAtomId: number;
  shape: ResolvedShape | null;
  label: ResolvedLabel | null;
  name: string;
}

export class MarkAtomOverlay implements Overlay, AtomAnchored {
  readonly id: string;
  readonly type = "mark_atom" as const;

  private _props: ResolvedProps;
  private _scene: Scene;
  private _uiTexture: AdvancedDynamicTexture;

  private _root: TransformNode;
  private _shapeMesh: Mesh | null = null;
  private _shapeMaterial: StandardMaterial | null = null;
  private _labelBillboard: _LabelBillboard | null = null;

  /** Current world-space center of the mark (atom pos when anchored). */
  private _worldCenter: Vector3;

  private constructor(
    id: string,
    props: ResolvedProps,
    scene: Scene,
    uiTexture: AdvancedDynamicTexture,
  ) {
    this.id = id;
    this._props = props;
    this._scene = scene;
    this._uiTexture = uiTexture;
    this._root = new TransformNode(`${id}_root`, scene);
    this._worldCenter = this._initialCenter();
    this._root.position.copyFrom(this._worldCenter);

    if (props.shape) this._createShape(props.shape);
    if (props.label) this._createLabel(props.label);
  }

  static create(
    scene: Scene,
    props: MarkAtomProps,
    uiTexture: AdvancedDynamicTexture,
  ): MarkAtomOverlay {
    return new MarkAtomOverlay(
      nextId(),
      resolveDefaults(props),
      scene,
      uiTexture,
    );
  }

  get props(): Readonly<ResolvedProps> {
    return this._props;
  }

  get visible(): boolean {
    return this._root.isEnabled();
  }

  set visible(v: boolean) {
    this._root.setEnabled(v);
    this._labelBillboard?.setVisible(v);
  }

  update(patch: Partial<MarkAtomProps>): this {
    const prev = this._props;

    // Shape / label nested props: undefined = keep, null = remove,
    // object = shallow-merge onto previous so callers can patch a single field.
    let shape: MarkShape | null;
    if (patch.shape === undefined) shape = prev.shape;
    else if (patch.shape === null) shape = null;
    else shape = { ...(prev.shape ?? {}), ...patch.shape };

    let label: MarkLabel | null;
    if (patch.label === undefined) label = prev.label;
    else if (patch.label === null) label = null;
    else label = { ...(prev.label ?? { text: "" }), ...patch.label };

    const next = resolveDefaults({
      position: patch.position ?? prev.position,
      anchorAtomId: patch.anchorAtomId ?? prev.anchorAtomId,
      shape,
      label,
      name: patch.name ?? prev.name,
    });
    this._props = next;

    // Anchor or position change → reseat world center.
    const posChanged =
      next.position[0] !== prev.position[0] ||
      next.position[1] !== prev.position[1] ||
      next.position[2] !== prev.position[2];
    if (next.anchorAtomId !== prev.anchorAtomId || posChanged) {
      this._worldCenter = this._initialCenter();
      this._root.position.copyFrom(this._worldCenter);
    }

    this._applyShape(next.shape);
    this._applyLabel(next.label);
    return this;
  }

  dispose(): void {
    this._disposeShape();
    this._labelBillboard?.dispose();
    this._labelBillboard = null;
    this._root.dispose();
  }

  // ── AtomAnchored ─────────────────────────────────────────────────────────

  getAnchorAtomId(): number {
    return this._props.anchorAtomId;
  }

  syncToAtomPosition(x: number, y: number, z: number): void {
    this._worldCenter.set(x, y, z);
    this._root.position.copyFrom(this._worldCenter);
  }

  // ── Per-frame label projection ───────────────────────────────────────────

  updateScreenPositions(): void {
    // Only the label needs per-frame projection; the shape lives in world space.
    this._labelBillboard?.project(this._scene, this._worldCenter);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _initialCenter(): Vector3 {
    const { position, anchorAtomId } = this._props;
    // When anchored, sync loop fills this in on the next frame-rendered event.
    // Seed at origin so we do not flash at the wrong spot if the anchor is valid.
    if (anchorAtomId >= 0) return new Vector3(0, 0, 0);
    return new Vector3(position[0], position[1], position[2]);
  }

  private _createShape(shape: ResolvedShape): void {
    const mat = new StandardMaterial(`${this.id}_mat`, this._scene);
    const color = hexToColor3(shape.color);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.4);
    mat.alpha = shape.opacity;
    mat.backFaceCulling = false;
    mat.separateCullingPass = true;

    const sphere = MeshBuilder.CreateSphere(
      `${this.id}_sphere`,
      {
        diameter: shape.radius * 2,
        segments: shape.segments,
      },
      this._scene,
    );
    sphere.material = mat;
    sphere.isPickable = false;
    sphere.parent = this._root;

    this._shapeMaterial = mat;
    this._shapeMesh = sphere;
  }

  private _disposeShape(): void {
    if (this._shapeMesh) {
      this._shapeMesh.dispose();
      this._shapeMesh = null;
    }
    if (this._shapeMaterial) {
      this._shapeMaterial.dispose();
      this._shapeMaterial = null;
    }
  }

  private _applyShape(next: ResolvedShape | null): void {
    if (!next) {
      this._disposeShape();
      return;
    }
    // Rebuild on shape change — sphere geometry is cheap and this keeps the
    // code paths single-flow (no partial update matrix).
    this._disposeShape();
    this._createShape(next);
  }

  private _createLabel(label: ResolvedLabel): void {
    this._labelBillboard = new _LabelBillboard(
      `${this.id}_label`,
      label,
      this._uiTexture,
    );
  }

  private _applyLabel(next: ResolvedLabel | null): void {
    if (!next) {
      this._labelBillboard?.dispose();
      this._labelBillboard = null;
      return;
    }
    if (!this._labelBillboard) {
      this._createLabel(next);
      return;
    }
    this._labelBillboard.update(next);
  }
}

// ── Private: label billboard (GUI-projected text) ───────────────────────────

/**
 * Tiny helper that owns the BabylonJS GUI controls for a single atom mark's
 * text label. Internal to this module — do not export.
 *
 * Mirrors the projection logic of TextLabelOverlay but is scoped to a
 * caller-supplied world anchor, so MarkAtomOverlay can drive position
 * from its own atom-anchor sync.
 */
class _LabelBillboard {
  private _uiTexture: AdvancedDynamicTexture;
  private _props: ResolvedLabel;
  private _id: string;

  private _container: Rectangle | null = null;
  private _textBlock: TextBlock | null = null;
  private _visible = true;

  constructor(
    id: string,
    props: ResolvedLabel,
    uiTexture: AdvancedDynamicTexture,
  ) {
    this._id = id;
    this._props = props;
    this._uiTexture = uiTexture;
    this._build();
  }

  update(next: ResolvedLabel): void {
    const textChanged = next.text !== this._props.text;
    const styleChanged =
      next.color !== this._props.color ||
      next.fontSize !== this._props.fontSize ||
      next.background !== this._props.background;
    this._props = next;

    if (styleChanged) {
      // Wholesale rebuild is simpler than reconciling a mixed Rectangle/TextBlock tree.
      this._dispose();
      this._build();
      if (!this._visible) this.setVisible(false);
    } else if (textChanged && this._textBlock) {
      this._textBlock.text = next.text;
    }
  }

  setVisible(v: boolean): void {
    this._visible = v;
    if (this._container) this._container.isVisible = v;
    if (this._textBlock) this._textBlock.isVisible = v;
  }

  project(scene: Scene, center: Vector3): void {
    if (!this._visible) return;
    if (!this._container && !this._textBlock) return;

    const camera = scene.activeCamera;
    if (!camera) return;

    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewportMatrix = camera.viewport.toGlobal(width, height);
    const transformMatrix = scene.getTransformMatrix();

    const { offset } = this._props;
    const anchored = new Vector3(
      center.x + offset[0],
      center.y + offset[1],
      center.z + offset[2],
    );

    const projected = Vector3.Project(
      anchored,
      transformMatrix,
      transformMatrix,
      viewportMatrix,
    );

    const control = this._container ?? this._textBlock;
    if (control) {
      control.left = `${projected.x - width / 2}px`;
      control.top = `${projected.y - height / 2}px`;
    }
  }

  dispose(): void {
    this._dispose();
  }

  private _build(): void {
    const { text, color, fontSize, background } = this._props;

    const tb = new TextBlock(`${this._id}_tb`, text);
    tb.color = color;
    tb.fontSize = fontSize;
    tb.outlineWidth = 2;
    tb.outlineColor = "#000000";
    tb.isHitTestVisible = false;
    tb.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
    tb.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;

    if (background) {
      const rect = new Rectangle(`${this._id}_bg`);
      rect.background = background;
      rect.cornerRadius = 4;
      rect.thickness = 0;
      rect.paddingLeft = "4px";
      rect.paddingRight = "4px";
      rect.paddingTop = "2px";
      rect.paddingBottom = "2px";
      rect.adaptHeightToChildren = true;
      rect.adaptWidthToChildren = true;
      rect.isHitTestVisible = false;
      rect.addControl(tb);
      this._uiTexture.addControl(rect);
      this._container = rect;
      this._textBlock = tb;
    } else {
      this._uiTexture.addControl(tb);
      this._textBlock = tb;
      this._container = null;
    }
  }

  private _dispose(): void {
    if (this._container) {
      this._uiTexture.removeControl(this._container);
      this._container.dispose();
      this._container = null;
    } else if (this._textBlock) {
      this._uiTexture.removeControl(this._textBlock);
    }
    if (this._textBlock) {
      this._textBlock.dispose();
      this._textBlock = null;
    }
  }
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SHAPE: ResolvedShape = {
  kind: "sphere",
  color: DEFAULT_SHAPE_COLOR,
  opacity: DEFAULT_SHAPE_OPACITY,
  radius: DEFAULT_SHAPE_RADIUS,
  segments: DEFAULT_SHAPE_SEGMENTS,
};

function resolveShape(
  shape: MarkShape | null | undefined,
): ResolvedShape | null {
  if (shape === null) return null;
  if (shape === undefined) return { ...DEFAULT_SHAPE };
  return {
    kind: shape.kind ?? DEFAULT_SHAPE.kind,
    color: shape.color ?? DEFAULT_SHAPE.color,
    opacity: shape.opacity ?? DEFAULT_SHAPE.opacity,
    radius: shape.radius ?? DEFAULT_SHAPE.radius,
    segments: shape.segments ?? DEFAULT_SHAPE.segments,
  };
}

function resolveLabel(
  label: MarkLabel | null | undefined,
): ResolvedLabel | null {
  if (label == null) return null;
  return {
    text: label.text,
    color: label.color ?? DEFAULT_LABEL_COLOR,
    fontSize: label.fontSize ?? DEFAULT_LABEL_FONT_SIZE,
    background: label.background ?? null,
    offset: label.offset ?? [0, 0, 0],
  };
}

function resolveDefaults(p: MarkAtomProps): ResolvedProps {
  return {
    position: p.position ?? [0, 0, 0],
    anchorAtomId: p.anchorAtomId ?? -1,
    shape: resolveShape(p.shape),
    label: resolveLabel(p.label),
    name: p.name ?? "",
  };
}

export type { MarkAtomProps };
