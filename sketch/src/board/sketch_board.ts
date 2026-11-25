import { CommandManager } from "@molcrafts/molvis-core/command";
import type { AppEventMap } from "@molcrafts/molvis-core/events";
import { EventEmitter } from "@molcrafts/molvis-core/events";
import type { Frame } from "@molcrafts/molvis-core/molrs";
import { isCtrlOrMeta } from "@molcrafts/molvis-core/platform";
import {
  ANNOTATION_ROTATION_HANDLE_PX,
  annotationBounds,
  annotationCorners,
  annotationPoint,
  annotationRotationHandle,
  DEFAULT_TEXT_ANNOTATION,
  hitAnnotation,
  measureAnnotationText,
  normalizeAnnotation,
  type ResizableAnnotation,
  type SketchAnnotation,
  type SketchDocument,
  snapToAnnotationText,
} from "../annotations";
import { ReplaceAnnotationsCommand } from "../commands/annotation_commands";
import {
  SetAtomColorCommand,
  SetAtomLabelCommand,
  SetBondColorCommand,
} from "../commands/appearance_commands";
import { CompositeCommand } from "../commands/composite_command";
import { DeleteSelectionCommand } from "../commands/delete_selection_command";
import {
  AddAtomCommand,
  AddBondCommand,
  RemoveAtomCommand,
  RemoveBondCommand,
  ReplaceMoleculeCommand,
} from "../commands/edit_commands";
import {
  AdjustAtomChargeCommand,
  ClearDocumentCommand,
  CycleBondOrderCommand,
  MoveSelectionCommand,
  PlaceRingCommand,
  SetAtomElementCommand,
  SetBondOrderCommand,
  SetBondStereoCommand,
} from "../commands/ops_commands";
import { PlaceBondFromPointCommand } from "../commands/place_bond_from_point_command";
import {
  PlaceChainCommand,
  PlaceChainFromPointCommand,
} from "../commands/place_chain_command";
import { PlaceFragmentCommand } from "../commands/place_fragment_command";
import { PlaceTerminalBondCommand } from "../commands/place_terminal_bond_command";
import {
  type SketchExportOptions,
  SketchImageExporter,
} from "../export/sketch_image_exporter";
import { buildChainPoints } from "../geometry/chain_builder";
import {
  DEFAULT_FRAGMENT_ID,
  type FragmentTemplate,
  getFragmentTemplate,
} from "../geometry/fragment_templates";
import { buildRingTemplate, type RingKind } from "../geometry/ring_template";
import {
  type BondTarget,
  CONNECT_SNAP_RADIUS,
  DEFAULT_BOND_LENGTH,
  findAtom,
  resolveBondTarget,
  SNAP_RADIUS,
} from "../geometry/snap";
import { MoleculeGraph } from "../molecule_graph";
import type { SketchCommand } from "../sketch_command";
import { atomLabelWidth } from "../style/atom_label";
import {
  DEFAULT_CUSTOM_COLOR,
  normalizeSketchColor,
} from "../style/custom_color";
import { DEPICTION_TOKENS, depictionInk } from "../style/depiction-tokens";
import type { Atom2D, Bond2D, MoleculeData } from "../types";
import { type BondSnapSelection, snapMovedBond } from "./bond_snap";
import { DEFAULT_BOND_SCREEN_PX, ViewportCoords } from "./coords";
import { type BoardHit, HitTester } from "./hit_test";
import { resolveKeymap } from "./keymap";
import {
  SketchRenderer,
  type SketchRenderState,
  type SketchRenderTheme,
} from "./sketch_renderer";
import { ViewportController } from "./viewport";

/** Active drawing tool. */
export type SketchTool =
  | "atom"
  | "bond"
  | "select"
  | "pan"
  | "erase"
  | "ring"
  | "chain"
  | "charge"
  | "stereo"
  | "fragment"
  | "annotation";

export interface SketchBoardOptions {
  /** Atom hit radius at the default zoom. Default SNAP_RADIUS (0.42). */
  atomRadiusDoc?: number;
  /** Omit letter "C" on carbon atoms. Default true. */
  omitCarbonLabel?: boolean;
  /** Chain bond length in document units. Default 1.0. */
  bondChainStep?: number;
  /** CSS pixels per drawing unit allowed for zoom gestures in a host view. */
  zoomRange?: readonly [min: number, max: number];
  /** Let an editor collect the text before a placement enters history. */
  onPlaceText?: (item: Extract<SketchAnnotation, { kind: "text" }>) => void;
  /** Refresh host overlays after the canvas and viewport have been painted. */
  onPaint?: () => void;
}

/** Observable editor state for host toolbars and status surfaces. */
export interface SketchBoardState {
  tool: SketchTool;
  element: string;
  bondOrder: 1 | 2 | 3;
  ringSize: number;
  ringKind: RingKind;
  /** Active fragment template id when using the fragment tool. */
  fragmentId: string;
  stereoMode: "none" | "up" | "down";
  chargeDelta: 1 | -1;
  customColor: string;
  colorOverrideEnabled: boolean;
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  atomCount: number;
  bondCount: number;
  selectedAtomCount: number;
  selectedBondCount: number;
  annotationCount: number;
  figureToolLocked: boolean;
  selectedAnnotationCount: number;
}

type Point = { x: number; y: number };

interface BondGesture {
  startAtom: number | null;
  start: Point;
  current: Point;
}

interface MarqueeGesture {
  start: Point;
  current: Point;
}

interface MoveGesture {
  start: Point;
  current: Point;
  atoms: number[];
  annotations: ReadonlySet<number>;
  selectedBondIndex?: number;
  snapSelection?: BondSnapSelection;
}

type FigureHandle = {
  index: number;
  item: ResizableAnnotation;
} & ({ kind: "resize"; corner: number } | { kind: "rotate" });

type FigureTransformGesture = FigureHandle &
  MarqueeGesture & { constrain: boolean };

/**
 * Canvas-backed 2D molecule sketch board.
 *
 * Coordinates: document units are Å-like; pointer events use CSS pixels.
 * Chain drags place a 120° carbon zig-zag at {@link bondChainStep} spacing as
 * one undo step.
 */
export class SketchBoard {
  readonly graph = new MoleculeGraph();
  /** Announces `history-change`; also what makes this board a `CommandHost`. */
  readonly events = new EventEmitter<AppEventMap>();
  readonly history = new CommandManager(this);
  readonly viewport = new ViewportCoords();
  readonly renderer = new SketchRenderer();
  readonly viewportCtrl: ViewportController;

  private readonly atomRadiusDoc: number;
  private readonly omitCarbonLabel: boolean;
  private readonly bondChainStep: number;

  private canvas: HTMLCanvasElement | null = null;
  private tool: SketchTool = "atom";
  private element = "C";
  private bondOrder: 1 | 2 | 3 = 1;
  private ringSize = 6;
  private ringKind: RingKind = "benzene";
  private fragmentId = DEFAULT_FRAGMENT_ID;
  private stereoMode: "none" | "up" | "down" = "up";
  private chargeDelta: 1 | -1 = 1;
  private customColor: string = DEFAULT_CUSTOM_COLOR;
  private colorOverrideEnabled = false;
  private disabled = false;
  /** Preview: pan and zoom only. Header actions still call the board directly. */
  private readonlyMode = false;
  private selectedAtoms = new Set<number>();
  private selectedBonds = new Set<number>();
  private annotations: readonly SketchAnnotation[] = [];
  private readonly selectedAnnotations = new Set<number>();
  private annotationTemplate: SketchAnnotation = DEFAULT_TEXT_ANNOTATION;
  private constrainAnnotation = false;
  private annotationDraft: { index?: number; item: SketchAnnotation } | null =
    null;
  private atomLabelDraft: { index: number; text: string } | null = null;
  private figureToolLocked = false;
  private readonly onPlaceText: SketchBoardOptions["onPlaceText"];
  private readonly onPaint: SketchBoardOptions["onPaint"];
  private annotationGesture: (MarqueeGesture & { constrain: boolean }) | null =
    null;
  private dirty = false;
  private raf = 0;
  private readonly stateListeners = new Set<
    (state: SketchBoardState) => void
  >();

  private activePointerId: number | null = null;
  private pointerDoc: Point | null = null;
  private hover: BoardHit = { kind: "none" };
  private bondGesture: BondGesture | null = null;
  private spacePan = false;
  private panning = false;
  private lastPan: { x: number; y: number } | null = null;
  private marqueeGesture: MarqueeGesture | null = null;
  private moveGesture: MoveGesture | null = null;
  private figureTransform: FigureTransformGesture | null = null;
  private elementPrefix: { key: "b" | "c" | "s"; at: number } | null = null;
  private readonly onPointerDown = (e: PointerEvent) =>
    this.handlePointerDown(e);
  private readonly onPointerMove = (e: PointerEvent) =>
    this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly onPointerCancel = (e: PointerEvent) =>
    this.handlePointerCancel(e);
  private readonly onPointerLeave = () => {
    if (this.activePointerId !== null) return;
    const changed = this.pointerDoc !== null || this.hover.kind !== "none";
    this.pointerDoc = null;
    this.hover = { kind: "none" };
    if (changed) this.markDirty();
  };
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
  private readonly onWindowKeyUp = (e: KeyboardEvent) => {
    if (e.key !== " ") return;
    this.spacePan = false;
    this.updateCursor();
  };
  private readonly onWindowBlur = () => {
    this.spacePan = false;
    this.cancelTransientGesture();
    this.updateCursor();
    this.markDirty();
  };
  private readonly onWheel = (e: WheelEvent) => {
    if (!this.canvas || this.disabled) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const deltaCss =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? e.deltaY * 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? e.deltaY * rect.height
          : e.deltaY;
    const factor = Math.exp(-deltaCss * 0.0015);
    this.viewportCtrl.zoomAtScreen(
      e.clientX - rect.left,
      e.clientY - rect.top,
      factor,
      this.annotations.length > 0 ? 0.1 : undefined,
    );
    this.markDirty();
  };

  constructor(options: SketchBoardOptions = {}) {
    this.viewportCtrl = new ViewportController(
      this.viewport,
      options.zoomRange,
    );
    if (
      options.atomRadiusDoc !== undefined &&
      (!Number.isFinite(options.atomRadiusDoc) || options.atomRadiusDoc <= 0)
    ) {
      throw new Error("atomRadiusDoc must be a positive finite number");
    }
    if (
      options.bondChainStep !== undefined &&
      (!Number.isFinite(options.bondChainStep) || options.bondChainStep <= 0)
    ) {
      throw new Error("bondChainStep must be a positive finite number");
    }
    // Hit disk ≥ SNAP so pointer "magnetism" matches geometry snap.
    this.atomRadiusDoc = options.atomRadiusDoc ?? SNAP_RADIUS;
    this.omitCarbonLabel = options.omitCarbonLabel ?? true;
    this.bondChainStep = options.bondChainStep ?? DEFAULT_BOND_LENGTH;
    this.onPlaceText = options.onPlaceText;
    this.onPaint = options.onPaint;
  }

  mount(canvas: HTMLCanvasElement): void {
    if (this.canvas) this.unmount();
    this.canvas = canvas;
    canvas.tabIndex = this.disabled ? -1 : 0;
    canvas.setAttribute("aria-disabled", String(this.disabled));
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keyup", this.onWindowKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    const rect = canvas.getBoundingClientRect();
    this.resize(rect.width || 300, rect.height || 200);
    this.updateCursor();
    this.markDirty();
  }

  unmount(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keyup", this.onWindowKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    this.cancelTransientGesture();
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.canvas = null;
    this.dirty = false;
  }

  resize(cssWidth: number, cssHeight: number): void {
    const dpr =
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1;
    this.viewport.resize(cssWidth, cssHeight, dpr);
    if (this.canvas) {
      const { width, height } = this.viewport.getBackingStoreSize();
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      const styleWidth = `${cssWidth}px`;
      const styleHeight = `${cssHeight}px`;
      if (this.canvas.style.width !== styleWidth) {
        this.canvas.style.width = styleWidth;
      }
      if (this.canvas.style.height !== styleHeight) {
        this.canvas.style.height = styleHeight;
      }
    }
    this.markDirty();
  }

  setTool(tool: SketchTool): void {
    const resetChainOrder = tool === "chain" && this.bondOrder !== 1;
    if (resetChainOrder) this.bondOrder = 1;
    if (this.tool === tool) {
      this.cancelTransientGesture();
      this.updateCursor();
      if (resetChainOrder) this.emitState();
      this.markDirty();
      return;
    }
    this.tool = tool;
    this.cancelTransientGesture();
    this.updateCursor();
    this.emitState();
    this.markDirty();
  }

  getTool(): SketchTool {
    return this.tool;
  }

  setElement(symbol: string): void {
    const next = symbol.trim() || "C";
    if (this.element === next) return;
    this.element = next;
    this.emitState();
  }

  getElement(): string {
    return this.element;
  }

  setBondOrder(order: 1 | 2 | 3): void {
    const next = this.tool === "chain" ? 1 : order;
    if (this.bondOrder === next) return;
    this.bondOrder = next;
    this.emitState();
  }

  getBondOrder(): 1 | 2 | 3 {
    return this.bondOrder;
  }

  setTheme(theme: Partial<SketchRenderTheme>): void {
    this.renderer.setTheme(theme);
    this.markDirty();
  }

  clear(): void {
    if (this.disabled || !this.hasContent()) return;
    const commands: SketchCommand[] = [];
    if (this.graph.atomCount() > 0)
      commands.push(new ClearDocumentCommand(this.graph));
    if (this.annotations.length > 0)
      commands.push(this.replaceAnnotationsCommand([]));
    this.clearSelection();
    this.cancelTransientGesture();
    this.executeCommands(commands);
  }

  hasContent(): boolean {
    return this.graph.atomCount() > 0 || this.annotations.length > 0;
  }

  getSketchDocument(): SketchDocument {
    return {
      ...this.graph.getMoleculeData(),
      annotations: structuredClone([...this.annotations]),
    };
  }

  /** Replace the entire drawing and start a new undo history. */
  loadSketchDocument(data: SketchDocument): void {
    const annotations = this.documentAnnotations(data);
    this.graph.loadMoleculeData(data);
    this.annotations = annotations;
    this.history.clearHistory();
    this.resetAfterDocumentChange();
  }

  /** Replace the drawing as one reversible edit, including its artwork. */
  updateSketchDocument(data: SketchDocument): void {
    if (this.disabled || this.readonlyMode) return;
    const annotations = this.documentAnnotations(data);
    this.history.execute(
      new CompositeCommand([
        new ReplaceMoleculeCommand(this.graph, data),
        this.replaceAnnotationsCommand(annotations),
      ]),
    );
    this.resetAfterDocumentChange();
  }

  private documentAnnotations(data: SketchDocument): SketchAnnotation[] {
    if (
      !data ||
      !Array.isArray(data.atoms) ||
      !Array.isArray(data.bonds) ||
      !Array.isArray(data.annotations)
    ) {
      throw new Error(
        "A Sketch document needs atoms, bonds, and annotations arrays",
      );
    }
    return data.annotations.map(normalizeAnnotation);
  }

  setAnnotationTemplate(item: SketchAnnotation, constrainAspect = false): void {
    this.annotationTemplate = normalizeAnnotation(item);
    this.constrainAnnotation = constrainAspect;
  }

  /** Insert one piece of artwork as an undoable edit. */
  drawAnnotation(item: SketchAnnotation): number {
    if (this.disabled || this.readonlyMode) return -1;
    const index = this.annotations.length;
    this.executeCommand(
      this.replaceAnnotationsCommand([
        ...this.annotations,
        normalizeAnnotation(item),
      ]),
    );
    return index;
  }

  updateAnnotation(index: number, item: SketchAnnotation): void {
    if (this.disabled || this.readonlyMode || !this.annotations[index]) return;
    const next = [...this.annotations];
    next[index] = normalizeAnnotation(item);
    this.executeCommand(this.replaceAnnotationsCommand(next));
  }

  removeAnnotation(index: number): void {
    if (this.disabled || this.readonlyMode || !this.annotations[index]) return;
    this.clearSelection();
    this.executeCommand(
      this.replaceAnnotationsCommand(
        this.annotations.filter((_, candidate) => index !== candidate),
      ),
    );
  }

  /** Place a figure using the editor’s tool-lock and selection behavior. */
  placeAnnotation(item: SketchAnnotation): number {
    if (this.disabled || this.readonlyMode) return -1;
    const placed = normalizeAnnotation(item);
    const index = this.annotations.length;
    this.clearSelection();
    if (!(this.figureToolLocked && this.tool === "annotation")) {
      this.tool = "select";
      this.selectedAnnotations.add(index);
      this.updateCursor();
    }
    this.executeCommand(
      this.replaceAnnotationsCommand([...this.annotations, placed]),
    );
    return index;
  }

  setFigureToolLocked(locked: boolean): void {
    if (this.disabled || this.readonlyMode || this.figureToolLocked === locked)
      return;
    this.figureToolLocked = locked;
    if (!locked && this.tool === "annotation") this.setTool("select");
    else this.emitState();
  }

  /** Draw a transient figure draft without changing the document or export. */
  setAnnotationDraft(
    draft: { index?: number; item: SketchAnnotation } | null,
  ): void {
    if (draft && (this.disabled || this.readonlyMode)) return;
    this.annotationDraft = draft;
    this.markDirty();
  }

  /** Paint typed text with the atom's usual style without recording an edit. */
  setAtomLabelDraft(draft: { index: number; text: string } | null): void {
    if (draft && (this.disabled || this.readonlyMode)) return;
    this.atomLabelDraft = draft;
    this.markDirty();
  }

  /** Set display text, or clear it to show the element symbol again. */
  updateAtomLabel(index: number, text: string): void {
    if (this.disabled || this.readonlyMode) return;
    const atom = this.graph.getAtom(index);
    const value = text.replace(/[\r\n]+/g, " ").trim();
    const label = value && value !== atom.element ? value : undefined;
    if (label !== atom.label)
      this.executeCommand(new SetAtomLabelCommand(this.graph, index, label));
  }

  getSelectedAnnotation():
    | { index: number; item: SketchAnnotation }
    | undefined {
    if (this.selectedAnnotations.size !== 1) return undefined;
    const [index] = this.selectedAnnotations;
    return { index, item: structuredClone(this.annotations[index]) };
  }

  duplicateSelectedAnnotations(): void {
    if (
      this.disabled ||
      this.readonlyMode ||
      this.selectedAnnotations.size === 0
    )
      return;
    const copies = this.annotations
      .filter((_, index) => this.selectedAnnotations.has(index))
      .map((item) => ({ ...item, x: item.x + 0.55, y: item.y - 0.55 }));
    this.clearSelection();
    for (let index = 0; index < copies.length; index++) {
      this.selectedAnnotations.add(this.annotations.length + index);
    }
    this.executeCommand(
      this.replaceAnnotationsCommand([...this.annotations, ...copies]),
    );
  }

  sendSelectedAnnotationsToBack(): void {
    if (
      this.disabled ||
      this.readonlyMode ||
      this.selectedAnnotations.size === 0
    )
      return;
    const selected = this.annotations.filter((_, index) =>
      this.selectedAnnotations.has(index),
    );
    const rest = this.annotations.filter(
      (_, index) => !this.selectedAnnotations.has(index),
    );
    const next = [...selected, ...rest];
    if (next.every((item, index) => item === this.annotations[index])) return;
    this.selectedAnnotations.clear();
    for (let index = 0; index < selected.length; index++)
      this.selectedAnnotations.add(index);
    this.executeCommand(this.replaceAnnotationsCommand(next));
  }

  /** Draw one atom. One undo step. Returns the new atom index, or -1 if disabled. */
  drawAtom(atom: Atom2D): number {
    const command = new AddAtomCommand(this.graph, atom);
    this.executeCommand(command);
    return command.getAtomIndex();
  }

  /** Draw one bond. One undo step. Returns the new bond index, or -1 if disabled. */
  drawBond(bond: Bond2D): number {
    const command = new AddBondCommand(this.graph, bond);
    this.executeCommand(command);
    return command.getBondIndex();
  }

  /**
   * Draw a carbon chain at `bondChainStep`, bond order 1, color unset.
   * `x0` and `y0` are ignored when `start` is an atom index.
   */
  drawChain(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    start?: number,
  ): void {
    const step = this.bondChainStep;
    const order = 1;
    const color = undefined;
    if (start === undefined) {
      this.executeCommand(
        new PlaceChainFromPointCommand(
          this.graph,
          x0,
          y0,
          x1,
          y1,
          step,
          order,
          color,
        ),
      );
      return;
    }
    this.executeCommand(
      new PlaceChainCommand(this.graph, start, x1, y1, step, order, color),
    );
  }

  /** Delete selected chemistry and annotations as one undo step. */
  deleteSelection(): void {
    if (this.disabled || this.readonlyMode) return;
    const commands: SketchCommand[] = [];
    if (this.selectedAtoms.size || this.selectedBonds.size) {
      commands.push(
        new DeleteSelectionCommand(
          this.graph,
          [...this.selectedAtoms],
          [...this.selectedBonds],
        ),
      );
    }
    if (this.selectedAnnotations.size) {
      commands.push(
        this.replaceAnnotationsCommand(
          this.annotations.filter(
            (_, index) => !this.selectedAnnotations.has(index),
          ),
        ),
      );
    }
    this.clearSelection();
    this.executeCommands(commands);
  }

  setRingTemplate(size: number, kind: RingKind = "aliphatic"): void {
    if (size < 3 || size > 8) {
      throw new Error(`ring size must be 3..8, got ${size}`);
    }
    if (this.ringSize === size && this.ringKind === kind) return;
    this.ringSize = size;
    this.ringKind = kind;
    this.emitState();
  }

  /**
   * Select the active fragment template for the fragment tool.
   * Unknown ids are rejected.
   */
  setFragmentTemplate(id: string): void {
    const template = getFragmentTemplate(id);
    if (!template) {
      throw new Error(`unknown fragment template: ${id}`);
    }
    if (this.fragmentId === template.id) return;
    this.fragmentId = template.id;
    this.emitState();
  }

  getFragmentTemplate(): FragmentTemplate {
    const template = getFragmentTemplate(this.fragmentId);
    if (template) return template;
    const fallback = getFragmentTemplate(DEFAULT_FRAGMENT_ID);
    if (!fallback) {
      throw new Error(
        `default fragment template missing: ${DEFAULT_FRAGMENT_ID}`,
      );
    }
    return fallback;
  }

  setStereoMode(mode: "none" | "up" | "down"): void {
    if (this.stereoMode === mode) return;
    this.stereoMode = mode;
    this.emitState();
  }

  setChargeDelta(delta: number): void {
    const next = delta >= 0 ? 1 : -1;
    if (this.chargeDelta === next) return;
    this.chargeDelta = next;
    this.emitState();
  }

  setCustomColor(color: string): void {
    const next = normalizeSketchColor(color);
    if (this.customColor === next) return;
    this.customColor = next;
    this.emitState();
    this.markDirty();
  }

  setColorOverrideEnabled(enabled: boolean): void {
    if (this.colorOverrideEnabled === enabled) return;
    this.colorOverrideEnabled = enabled;
    this.emitState();
    this.markDirty();
  }

  /** Apply or clear color overrides on the current selection as one undo step. */
  applyColorToSelection(
    color: string | null = this.colorOverrideEnabled ? this.customColor : null,
  ): boolean {
    if (this.disabled) return false;
    const next = color === null ? undefined : normalizeSketchColor(color);
    const commands = this.colorCommands(
      [...this.selectedAtoms],
      [...this.selectedBonds],
      next,
    );
    return this.executeCommands(commands);
  }

  /**
   * Read-only preview. Pointer drags pan and the wheel zooms. Drawing tools
   * and keyboard edits do nothing. Fit, export, and the other header actions
   * stay on the composer and call the board themselves.
   */
  setReadonly(readonly: boolean): void {
    if (this.readonlyMode === readonly) return;
    this.readonlyMode = readonly;
    if (readonly) this.cancelTransientGesture();
    this.updateCursor();
  }

  /**
   * Disable all canvas mutation and navigation, including shortcuts that were
   * focused before a host operation entered its busy state.
   */
  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    if (this.canvas) {
      this.canvas.tabIndex = disabled ? -1 : 0;
      this.canvas.setAttribute("aria-disabled", String(disabled));
      if (disabled && document.activeElement === this.canvas) {
        this.canvas.blur();
      }
    }
    if (disabled) this.cancelTransientGesture();
    this.updateCursor();
    this.emitState();
    this.markDirty();
  }

  /** Snapshot the state needed by a host toolbar. */
  getState(): SketchBoardState {
    return {
      tool: this.tool,
      element: this.element,
      bondOrder: this.bondOrder,
      ringSize: this.ringSize,
      ringKind: this.ringKind,
      fragmentId: this.fragmentId,
      stereoMode: this.stereoMode,
      chargeDelta: this.chargeDelta,
      customColor: this.customColor,
      colorOverrideEnabled: this.colorOverrideEnabled,
      disabled: this.disabled,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      atomCount: this.graph.atomCount(),
      bondCount: this.graph.bondCount(),
      selectedAtomCount: this.selectedAtoms.size,
      selectedBondCount: this.selectedBonds.size,
      annotationCount: this.annotations.length,
      figureToolLocked: this.figureToolLocked,
      selectedAnnotationCount: this.selectedAnnotations.size,
    };
  }

  /**
   * Observe editor state. The current snapshot is delivered immediately.
   * Returns an unsubscribe callback.
   */
  subscribe(listener: (state: SketchBoardState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Place the current ring template at document center (cx, cy).
   * Size is always derived from DEFAULT_BOND_LENGTH (RDKit-style), not a free radius.
   */
  placeRingAt(cx: number, cy: number): void {
    this.executeCommand(
      new PlaceRingCommand(
        this.graph,
        this.ringSize,
        cx,
        cy,
        DEFAULT_BOND_LENGTH,
        this.ringKind,
        -Math.PI / 2,
        false,
        this.activeColor(),
      ),
    );
  }

  /**
   * Place the active fragment at (cx, cy). When `targetAtom` is set, attach
   * with the template's attach mode (merge root or bond-from-target).
   */
  placeFragmentAt(
    cx: number,
    cy: number,
    targetAtom?: number,
    bondDir?: { x: number; y: number },
  ): void {
    const template = this.getFragmentTemplate();
    this.executeCommand(
      new PlaceFragmentCommand(this.graph, template, {
        x: cx,
        y: cy,
        targetAtom,
        bondDir,
        color: this.activeColor(),
      }),
    );
  }

  fitToView(): void {
    const data = this.graph.getMoleculeData();
    const fitPoints: Point[] = [...data.atoms];
    for (const atom of data.atoms) {
      if (!atom.label) continue;
      const reach =
        atomLabelWidth(atom.label, DEPICTION_TOKENS.fontSizeRatio) / 2;
      fitPoints.push(
        { x: atom.x - reach, y: atom.y },
        { x: atom.x + reach, y: atom.y },
      );
    }
    for (const item of this.annotations) {
      const bounds = annotationBounds(item);
      fitPoints.push(
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
      );
    }
    this.viewportCtrl.fitToAtoms(fitPoints, 48, this.annotations.length > 0);
    this.markDirty();
  }

  undo(): void {
    if (this.disabled) return;
    // Synchronous: core's history stays sync for synchronous commands.
    if (this.history.undo()) this.resetAfterDocumentChange();
  }

  redo(): void {
    if (this.disabled) return;
    // Synchronous: core's history stays sync for synchronous commands.
    if (this.history.redo()) this.resetAfterDocumentChange();
  }

  /** Zoom about the canvas centre; `factor` > 1 zooms in. View state only. */
  zoomBy(factor: number): void {
    if (!this.canvas || !(factor > 0)) return;
    const rect = this.canvas.getBoundingClientRect();
    this.viewportCtrl.zoomAtScreen(
      rect.width / 2,
      rect.height / 2,
      factor,
      this.annotations.length > 0 ? 0.1 : undefined,
    );
    this.markDirty();
  }

  getMoleculeData(): MoleculeData {
    return this.graph.getMoleculeData();
  }

  loadMoleculeData(data: MoleculeData): void {
    this.loadSketchDocument({ ...data, annotations: [] });
  }

  /** Apply an external edit as one undoable document change. */
  updateMoleculeData(data: MoleculeData): void {
    if (this.readonlyMode || this.disabled) return;
    this.executeCommand(new ReplaceMoleculeCommand(this.graph, data));
    this.clearSelection();
    this.cancelTransientGesture();
  }

  /** Sorted atom indices in the current selection. */
  selectedAtomIndices(): number[] {
    return [...this.selectedAtoms].sort((a, b) => a - b);
  }

  /** Replace the atom selection. Out-of-range indices are ignored. */
  replaceSelectedAtoms(indices: readonly number[]): void {
    this.clearSelection();
    const n = this.graph.atomCount();
    for (const i of indices) {
      if (Number.isInteger(i) && i >= 0 && i < n) this.selectedAtoms.add(i);
    }
    this.emitState();
    this.markDirty();
  }

  toFrame(): Frame {
    return this.graph.toFrame();
  }

  /** Serialize a fitted, selection-free vector image of the current sketch. */
  toSvg(options: SketchExportOptions = {}): string {
    return this.imageExporter().toSvg(options);
  }

  /** Encode a fitted, selection-free PNG image of the current sketch. */
  toPng(options: SketchExportOptions = {}): Promise<Blob> {
    return this.imageExporter().toPng(options);
  }

  /** The framing the image exporter will use for these options. */
  getExportView(options: SketchExportOptions = {}) {
    return this.imageExporter().getView(options);
  }

  private imageExporter(): SketchImageExporter {
    return new SketchImageExporter(
      this.graph,
      this.renderer.getTheme(),
      this.omitCarbonLabel,
      this.annotations,
    );
  }

  /** Force a paint (tests). */
  paintNow(): void {
    this.dirty = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.paint();
  }

  /** Whether a paint is scheduled (tests). */
  isPaintScheduled(): boolean {
    return this.raf !== 0;
  }

  markDirty(): void {
    this.dirty = true;
    if (this.raf || !this.canvas) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.dirty) return;
      this.dirty = false;
      this.paint();
      this.onPaint?.();
    });
  }

  private paint(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const gesturePreview = this.gesturePreview();
    const move = this.moveGesture;
    const snappedMolecule = move
      ? this.snappedBondMove(move, move.current)
      : undefined;
    const draft = this.annotationGesture;
    const editing = this.annotationDraft;
    let annotations = this.annotations;
    if (editing) {
      annotations =
        editing.index === undefined
          ? [...annotations, editing.item]
          : annotations.map((item, index) =>
              index === editing.index ? editing.item : item,
            );
    } else if (this.figureTransform) {
      const gesture = this.figureTransform;
      const next = this.transformedAnnotation(
        gesture,
        gesture.current,
        gesture.constrain,
      );
      annotations = annotations.map((item, index) =>
        index === gesture.index ? next : item,
      );
    } else if (move?.annotations.size) {
      annotations = annotations.map((item, index) =>
        move.annotations.has(index)
          ? {
              ...item,
              x: item.x + move.current.x - move.start.x,
              y: item.y + move.current.y - move.start.y,
            }
          : item,
      );
    }
    this.renderer.paint(ctx, this.graph, this.viewport, {
      annotations,
      moleculePreview: snappedMolecule,
      atomLabelDraft: this.atomLabelDraft ?? undefined,
      resizeAnnotation:
        !editing && !move ? this.resizableSelection()?.index : undefined,
      selectedAnnotations: editing ? undefined : this.selectedAnnotations,
      hoveredAnnotation:
        !editing && this.hover.kind === "annotation"
          ? this.hover.index
          : undefined,
      annotationPreview: draft
        ? this.annotationFromGesture(
            draft.start,
            draft.current,
            draft.constrain,
          )
        : undefined,
      selectedAtoms: snappedMolecule ? new Set() : this.selectedAtoms,
      selectedBonds: this.selectedBonds,
      ...(this.hover.kind === "atom" ? { hoveredAtom: this.hover.index } : {}),
      ...(this.hover.kind === "bond" ? { hoveredBond: this.hover.index } : {}),
      omitCarbonLabel: this.omitCarbonLabel,
      atomRadiusDoc: this.atomRadiusDoc,
      ...(this.moveGesture && !snappedMolecule
        ? {
            movePreview: {
              atomIndices: new Set(this.moveGesture.atoms),
              dx: this.moveGesture.current.x - this.moveGesture.start.x,
              dy: this.moveGesture.current.y - this.moveGesture.start.y,
            },
          }
        : {}),
      ...(this.marqueeGesture
        ? {
            marquee: {
              x0: this.marqueeGesture.start.x,
              y0: this.marqueeGesture.start.y,
              x1: this.marqueeGesture.current.x,
              y1: this.marqueeGesture.current.y,
            },
          }
        : {}),
      gesturePreview,
    });
  }

  private eventDoc(e: PointerEvent): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return this.viewport.screenToDoc(sx, sy);
  }

  /** Resolve the current tool’s pick at a document-coordinate point. */
  hitAt(doc: Point): BoardHit {
    // Keep hit areas roughly constant in CSS pixels while zooming.
    const scale = this.viewport.getScale();
    const zoomRatio = DEFAULT_BOND_SCREEN_PX / scale;
    const ink = depictionInk(scale);
    const hit = new HitTester(
      this.atomRadiusDoc * zoomRatio,
      this.atomRadiusDoc * 0.55 * zoomRatio,
      this.tool === "select" || this.tool === "bond" ? ink.fontPx / scale : 0,
      (ink.doubleSpacingPx + ink.selectedWidth / 2) / scale,
    ).hit(this.graph, doc.x, doc.y);
    if (
      hit.kind !== "none" ||
      (this.tool !== "select" && this.tool !== "erase")
    )
      return hit;
    const tolerance = 5 / this.viewport.getScale();
    for (let index = this.annotations.length - 1; index >= 0; index--) {
      if (hitAnnotation(this.annotations[index], doc.x, doc.y, tolerance))
        return { kind: "annotation", index };
    }
    return hit;
  }

  private annotationFromGesture(
    start: Point,
    end: Point,
    constrain: boolean,
  ): SketchAnnotation {
    const item = this.annotationTemplate;
    if (item.kind === "text") return { ...item, ...start };
    if (
      Math.hypot(end.x - start.x, end.y - start.y) <
      3 / this.viewport.getScale()
    ) {
      return {
        ...item,
        ...start,
        height: this.constrainAnnotation ? item.width : item.height,
      };
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const square = Math.max(Math.abs(dx), Math.abs(dy));
    const useSquare = constrain || this.constrainAnnotation;
    const width = Math.max(0.08, useSquare ? square : Math.abs(dx));
    const height = Math.max(0.08, useSquare ? square : Math.abs(dy));
    return {
      ...item,
      x: start.x + (dx < 0 ? -width : width) / 2,
      y: start.y + (dy < 0 ? -height : height) / 2,
      width,
      height,
    };
  }

  private resizableSelection():
    | { index: number; item: ResizableAnnotation }
    | undefined {
    if (
      this.disabled ||
      this.readonlyMode ||
      this.tool !== "select" ||
      this.selectedAnnotations.size !== 1 ||
      this.selectedAtoms.size ||
      this.selectedBonds.size
    )
      return undefined;
    const [index] = this.selectedAnnotations;
    const item = this.annotations[index];
    return item && item.kind !== "text" ? { index, item } : undefined;
  }

  private figureHandleAt(doc: Point): FigureHandle | undefined {
    const selection = this.resizableSelection();
    if (!selection) return undefined;
    const scale = this.viewport.getScale();
    const radius = 6 / scale;
    const rotation = annotationRotationHandle(
      selection.item,
      ANNOTATION_ROTATION_HANDLE_PX / scale,
    );
    if (
      Math.hypot(rotation.x - doc.x, rotation.y - doc.y) <=
      radius + 2 / scale
    )
      return { ...selection, kind: "rotate" };
    const corner = annotationCorners(selection.item).findIndex(
      (point) =>
        Math.abs(doc.x - point.x) <= radius &&
        Math.abs(doc.y - point.y) <= radius,
    );
    return corner === -1 ? undefined : { ...selection, kind: "resize", corner };
  }

  private transformedAnnotation(
    gesture: FigureTransformGesture,
    end: Point,
    constrain: boolean,
  ): ResizableAnnotation {
    const { item, start } = gesture;
    if (gesture.kind === "rotate") {
      if (end.x === item.x && end.y === item.y) return item;
      const before = Math.atan2(start.y - item.y, start.x - item.x);
      const after = Math.atan2(end.y - item.y, end.x - item.x);
      const rotation =
        (item.rotation ?? 0) + ((before - after) * 180) / Math.PI;
      return {
        ...item,
        rotation: constrain ? Math.round(rotation / 15) * 15 : rotation,
      };
    }
    const { corner } = gesture;
    const signX = corner === 0 || corner === 3 ? -1 : 1;
    const signY = corner < 2 ? 1 : -1;
    const localStart = annotationPoint(item, start, "local");
    const localEnd = annotationPoint(item, end, "local");
    let width = Math.max(
      0.08,
      item.width + signX * (localEnd.x - localStart.x),
    );
    let height = Math.max(
      0.08,
      item.height + signY * (localEnd.y - localStart.y),
    );
    if (constrain) {
      const scale = Math.max(width / item.width, height / item.height);
      width = scale * item.width;
      height = scale * item.height;
    }
    return {
      ...item,
      ...annotationPoint(item, {
        x: item.x + (signX * (width - item.width)) / 2,
        y: item.y + (signY * (height - item.height)) / 2,
      }),
      width,
      height,
    };
  }

  private handlePointerDown(e: PointerEvent): void {
    if (!this.canvas || this.disabled) return;
    if (this.readonlyMode) {
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      this.capturePointer(e);
      this.panning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.updateCursor();
      return;
    }
    if (this.activePointerId !== null || e.button === 2) return;
    this.canvas.focus();
    if (
      e.button === 1 ||
      this.spacePan ||
      (this.tool === "pan" && e.button === 0)
    ) {
      e.preventDefault();
      this.capturePointer(e);
      this.panning = true;
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.updateCursor();
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    const doc = this.eventDoc(e);
    this.pointerDoc = doc;
    const handle = this.figureHandleAt(doc);
    if (handle) {
      this.capturePointer(e);
      this.figureTransform = {
        ...handle,
        start: doc,
        current: doc,
        constrain: e.shiftKey,
      };
      this.updateCursor(handle);
      this.markDirty();
      return;
    }
    const hit = this.hitAt(doc);

    if (this.tool === "annotation") {
      this.capturePointer(e);
      this.annotationGesture = {
        start: doc,
        current: doc,
        constrain: e.shiftKey,
      };
      this.markDirty();
      return;
    }

    if (this.tool === "ring") {
      this.placeRingForHit(hit, doc);
      return;
    }

    if (this.tool === "fragment") {
      this.placeFragmentForHit(hit, doc);
      return;
    }

    if (this.tool === "charge" && hit.kind === "atom") {
      const commands: SketchCommand[] = [
        new AdjustAtomChargeCommand(this.graph, hit.index, this.chargeDelta),
      ];
      const color = this.activeColor();
      if (color) commands.push(...this.colorCommands([hit.index], [], color));
      this.executeCommands(commands);
      return;
    }

    if (this.tool === "stereo" && hit.kind === "bond") {
      const bond = this.graph.getBond(hit.index);
      if (bond.order === 1) {
        const commands: SketchCommand[] = [];
        if (bond.stereo !== this.stereoMode || this.stereoMode !== "none") {
          commands.push(
            new SetBondStereoCommand(this.graph, hit.index, this.stereoMode),
          );
        }
        const color = this.activeColor();
        if (color) {
          commands.push(...this.colorCommands([], [hit.index], color));
        }
        this.executeCommands(commands);
      }
      return;
    }

    if (
      (this.tool === "bond" && hit.kind !== "bond") ||
      this.tool === "chain"
    ) {
      this.capturePointer(e);
      this.bondGesture = {
        startAtom:
          hit.kind === "atom"
            ? hit.index
            : this.tool === "bond"
              ? findAtom(this.graph, doc.x, doc.y)
              : null,
        start: doc,
        current: doc,
      };
      this.markDirty();
      return;
    }

    if (this.tool === "atom") {
      if (hit.kind === "atom") {
        const atom = this.graph.getAtom(hit.index);
        const commands: SketchCommand[] = [];
        if (atom.element !== this.element) {
          commands.push(
            new SetAtomElementCommand(this.graph, hit.index, this.element),
          );
        }
        const color = this.activeColor();
        if (color) {
          commands.push(...this.colorCommands([hit.index], [], color));
        }
        this.executeCommands(commands);
        return;
      }
      // Do not create a disconnected atom over the middle of an existing bond.
      if (hit.kind === "bond") return;
      if (findAtom(this.graph, doc.x, doc.y, SNAP_RADIUS) !== null) return;
      {
        const color = this.activeColor();
        this.executeCommand(
          new AddAtomCommand(this.graph, {
            element: this.element,
            x: doc.x,
            y: doc.y,
            ...(color ? { color } : {}),
          }),
        );
      }
      return;
    }

    if (this.tool === "erase") {
      if (hit.kind === "atom") {
        this.executeCommand(new RemoveAtomCommand(this.graph, hit.index));
        this.clearSelection();
        this.emitState();
      } else if (hit.kind === "bond") {
        this.executeCommand(new RemoveBondCommand(this.graph, hit.index));
        this.selectedBonds.clear();
        this.emitState();
      } else if (hit.kind === "annotation") {
        this.removeAnnotation(hit.index);
      }
      return;
    }

    if (
      this.tool === "select" ||
      (this.tool === "bond" && hit.kind === "bond")
    ) {
      if (hit.kind === "none") {
        this.capturePointer(e);
        this.marqueeGesture = { start: doc, current: doc };
        if (!e.shiftKey) this.clearSelection();
      } else {
        const selection =
          hit.kind === "atom"
            ? this.selectedAtoms
            : hit.kind === "bond"
              ? this.selectedBonds
              : this.selectedAnnotations;
        if (e.shiftKey) {
          if (!selection.delete(hit.index)) selection.add(hit.index);
        } else {
          const wasSelected = selection.has(hit.index);
          if (!wasSelected) {
            this.clearSelection();
            selection.add(hit.index);
          }
          this.capturePointer(e);
          this.moveGesture = {
            start: doc,
            current: doc,
            atoms: this.atomsForSelectionMove(),
            annotations: new Set(this.selectedAnnotations),
            selectedBondIndex:
              wasSelected && hit.kind === "bond" ? hit.index : undefined,
            snapSelection:
              (hit.kind === "atom" || hit.kind === "bond") &&
              this.selectedAtoms.size + this.selectedBonds.size === 1 &&
              this.selectedAnnotations.size === 0
                ? hit
                : undefined,
          };
        }
      }
      this.emitState();
      this.markDirty();
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.disabled) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }
    const doc = this.eventDoc(e);
    this.pointerDoc = doc;
    if (this.panning && this.lastPan) {
      e.preventDefault();
      this.viewportCtrl.panByScreen(
        e.clientX - this.lastPan.x,
        e.clientY - this.lastPan.y,
      );
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.markDirty();
      return;
    }
    if (this.activePointerId === null) {
      if (this.tool === "pan" || this.readonlyMode) return;
      if (this.tool === "select") this.updateCursor(this.figureHandleAt(doc));
      const nextHover = this.hitAt(doc);
      if (!sameHit(this.hover, nextHover)) {
        this.hover = nextHover;
        this.markDirty();
      }
      return;
    }
    if (this.annotationGesture) {
      this.annotationGesture.current = doc;
      this.annotationGesture.constrain = e.shiftKey;
      this.markDirty();
    } else if (this.figureTransform) {
      this.figureTransform.current = doc;
      this.figureTransform.constrain = e.shiftKey;
      this.markDirty();
    } else if (this.moveGesture) {
      this.moveGesture.current = doc;
      this.markDirty();
    } else if (this.marqueeGesture) {
      this.marqueeGesture.current = doc;
      this.markDirty();
    } else if (this.bondGesture) {
      this.bondGesture.current = doc;
      this.markDirty();
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.canvas || this.disabled) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }
    e.preventDefault();
    const doc = this.eventDoc(e);
    this.releasePointer(e);

    if (this.panning) {
      this.panning = false;
      this.lastPan = null;
      this.updateCursor();
      return;
    }

    if (this.annotationGesture) {
      const { start } = this.annotationGesture;
      this.annotationGesture = null;
      const item = this.annotationFromGesture(start, doc, e.shiftKey);
      if (item.kind === "text" && this.onPlaceText) {
        this.onPlaceText(item);
        this.markDirty();
      } else {
        this.placeAnnotation(item);
      }
      return;
    }

    if (this.figureTransform) {
      const gesture = this.figureTransform;
      this.figureTransform = null;
      if (
        Math.hypot(doc.x - gesture.start.x, doc.y - gesture.start.y) >
        2 / this.viewport.getScale()
      ) {
        this.updateAnnotation(
          gesture.index,
          this.transformedAnnotation(gesture, doc, e.shiftKey),
        );
      }
      this.updateCursor(this.figureHandleAt(doc));
      this.markDirty();
      return;
    }

    if (this.moveGesture) {
      const gesture = this.moveGesture;
      this.moveGesture = null;
      const dx = doc.x - gesture.start.x;
      const dy = doc.y - gesture.start.y;
      const dragThreshold = 2 / this.viewport.getScale();
      if (Math.hypot(dx, dy) > dragThreshold) {
        const snapped = this.snappedBondMove(gesture, doc);
        if (snapped) {
          this.clearSelection();
          this.executeCommand(new ReplaceMoleculeCommand(this.graph, snapped));
          return;
        }
        const commands: SketchCommand[] = [];
        if (gesture.atoms.length)
          commands.push(
            new MoveSelectionCommand(this.graph, gesture.atoms, dx, dy),
          );
        if (gesture.annotations.size) {
          commands.push(
            this.replaceAnnotationsCommand(
              this.annotations.map((item, index) =>
                gesture.annotations.has(index)
                  ? { ...item, x: item.x + dx, y: item.y + dy }
                  : item,
              ),
            ),
          );
        }
        this.executeCommands(commands);
      } else if (gesture.selectedBondIndex !== undefined) {
        const index = gesture.selectedBondIndex;
        const commands: SketchCommand[] = [
          new CycleBondOrderCommand(this.graph, index),
        ];
        const color = this.tool === "bond" ? this.activeColor() : undefined;
        if (color) commands.push(...this.colorCommands([], [index], color));
        this.executeCommands(commands);
      }
      this.markDirty();
      return;
    }

    if (this.marqueeGesture) {
      const gesture = this.marqueeGesture;
      this.marqueeGesture = null;
      const x0 = Math.min(gesture.start.x, doc.x);
      const x1 = Math.max(gesture.start.x, doc.x);
      const y0 = Math.min(gesture.start.y, doc.y);
      const y1 = Math.max(gesture.start.y, doc.y);
      const data = this.graph.getMoleculeData();
      const enclosedAtoms = new Set<number>();
      for (let i = 0; i < data.atoms.length; i++) {
        const a = data.atoms[i];
        if (a.x >= x0 && a.x <= x1 && a.y >= y0 && a.y <= y1) {
          enclosedAtoms.add(i);
          this.selectedAtoms.add(i);
        }
      }
      for (let index = 0; index < data.bonds.length; index++) {
        const bond = data.bonds[index];
        if (enclosedAtoms.has(bond.i) && enclosedAtoms.has(bond.j)) {
          this.selectedBonds.add(index);
        }
      }
      for (const [index, item] of this.annotations.entries()) {
        const bounds = annotationBounds(item);
        if (
          bounds.minX >= x0 &&
          bounds.maxX <= x1 &&
          bounds.minY >= y0 &&
          bounds.maxY <= y1
        )
          this.selectedAnnotations.add(index);
      }
      this.emitState();
      this.markDirty();
      return;
    }

    if (this.tool !== "bond" && this.tool !== "chain") return;
    const gesture = this.bondGesture;
    this.bondGesture = null;
    if (!gesture) return;

    if (this.tool === "chain") {
      const points = this.chainGesturePoints(gesture, doc);
      if (points.length < 3) {
        this.markDirty();
        return;
      }
      const start = gesture.startAtom;
      this.executeCommand(
        start === null
          ? new PlaceChainFromPointCommand(
              this.graph,
              gesture.start.x,
              gesture.start.y,
              doc.x,
              doc.y,
              this.bondChainStep,
              1,
              this.activeColor(),
            )
          : new PlaceChainCommand(
              this.graph,
              start,
              doc.x,
              doc.y,
              this.bondChainStep,
              1,
              this.activeColor(),
            ),
      );
      return;
    }

    const target = this.bondDragTarget(gesture, doc);
    const snapped = target.existingIndex;
    const start = gesture.startAtom;

    if (start === null) {
      this.executeCommand(
        new PlaceBondFromPointCommand(
          this.graph,
          gesture.start.x,
          gesture.start.y,
          doc.x,
          doc.y,
          this.bondOrder,
          "C",
          DEFAULT_BOND_LENGTH,
          this.activeColor(),
          target,
        ),
      );
      return;
    }

    if (snapped !== null && snapped !== start) {
      const existingBond = this.graph.findBondIndex(start, snapped);
      if (existingBond === null) {
        {
          const color = this.activeColor();
          this.executeCommand(
            new AddBondCommand(this.graph, {
              i: start,
              j: snapped,
              order: this.bondOrder,
              ...(color ? { color } : {}),
            }),
          );
        }
      } else {
        const bond = this.graph.getBond(existingBond);
        const commands: SketchCommand[] = [];
        if (bond.order !== this.bondOrder) {
          commands.push(
            new SetBondOrderCommand(this.graph, existingBond, this.bondOrder),
          );
        }
        const color = this.activeColor();
        if (color) {
          commands.push(...this.colorCommands([], [existingBond], color));
        }
        if (!this.executeCommands(commands)) this.markDirty();
      }
      return;
    }

    // The terminal carbon goes at the text edge or the default angle and length.
    this.executeCommand(
      new PlaceTerminalBondCommand(
        this.graph,
        start,
        doc.x,
        doc.y,
        this.bondOrder,
        DEFAULT_BOND_LENGTH,
        this.activeColor(),
        target,
      ),
    );
  }

  private handlePointerCancel(e: PointerEvent): void {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }
    this.releasePointer(e);
    this.cancelTransientGesture();
    this.updateCursor();
    this.markDirty();
  }

  private capturePointer(e: PointerEvent): void {
    this.activePointerId = e.pointerId;
    if (!this.canvas?.setPointerCapture) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic PointerEvents used by hosts/tests may not be capturable.
    }
  }

  private releasePointer(e: PointerEvent): void {
    if (
      this.canvas?.releasePointerCapture &&
      this.canvas.hasPointerCapture?.(e.pointerId)
    ) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    this.activePointerId = null;
  }

  private cancelTransientGesture(): void {
    if (
      this.canvas?.releasePointerCapture &&
      this.activePointerId !== null &&
      this.canvas.hasPointerCapture?.(this.activePointerId)
    ) {
      this.canvas.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.bondGesture = null;
    this.marqueeGesture = null;
    this.annotationGesture = null;
    this.moveGesture = null;
    this.figureTransform = null;
    this.annotationDraft = null;
    this.atomLabelDraft = null;
    this.panning = false;
    this.lastPan = null;
    this.hover = { kind: "none" };
    this.pointerDoc = null;
  }

  private atomsForSelectionMove(): number[] {
    const atoms = new Set(this.selectedAtoms);
    for (const bondIndex of this.selectedBonds) {
      const bond = this.graph.getBond(bondIndex);
      atoms.add(bond.i);
      atoms.add(bond.j);
    }
    return [...atoms].sort((a, b) => a - b);
  }

  private clearSelection(): void {
    this.selectedAtoms.clear();
    this.selectedBonds.clear();
    this.selectedAnnotations.clear();
  }

  private resetAfterDocumentChange(): void {
    this.clearSelection();
    this.cancelTransientGesture();
    this.emitState();
    this.markDirty();
  }

  private replaceAnnotationsCommand(
    after: readonly SketchAnnotation[],
  ): SketchCommand {
    return new ReplaceAnnotationsCommand(
      (items) => {
        this.annotations = items;
      },
      this.annotations,
      after,
    );
  }

  private activeColor(): string | undefined {
    return this.colorOverrideEnabled ? this.customColor : undefined;
  }

  private colorCommands(
    atomIndices: number[],
    bondIndices: number[],
    color: string | undefined,
  ): SketchCommand[] {
    const commands: SketchCommand[] = [];
    for (const index of [...new Set(atomIndices)].sort((a, b) => a - b)) {
      if (this.graph.getAtom(index).color !== color) {
        commands.push(new SetAtomColorCommand(this.graph, index, color));
      }
    }
    for (const index of [...new Set(bondIndices)].sort((a, b) => a - b)) {
      if (this.graph.getBond(index).color !== color) {
        commands.push(new SetBondColorCommand(this.graph, index, color));
      }
    }
    return commands;
  }

  private executeCommands(commands: SketchCommand[]): boolean {
    if (commands.length === 0) return false;
    const command =
      commands.length === 1 ? commands[0] : new CompositeCommand(commands);
    this.executeCommand(command);
    return true;
  }

  private executeCommand(command: SketchCommand): void {
    if (this.disabled) return;
    this.history.execute(command);
    this.hover = { kind: "none" };
    this.emitState();
    this.markDirty();
  }

  private emitState(): void {
    if (this.stateListeners.size === 0) return;
    const state = this.getState();
    for (const listener of [...this.stateListeners]) listener(state);
  }

  private updateCursor(handle?: FigureHandle): void {
    if (!this.canvas) return;
    if (this.disabled) {
      this.canvas.style.cursor = "not-allowed";
      return;
    }
    if (this.readonlyMode) {
      this.canvas.style.cursor = this.panning ? "grabbing" : "grab";
      return;
    }
    if (this.panning) {
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (this.spacePan || this.tool === "pan") {
      this.canvas.style.cursor = "grab";
      return;
    }
    if (handle?.kind === "rotate") {
      this.canvas.style.cursor = this.figureTransform ? "grabbing" : "grab";
      return;
    }
    if (handle?.kind === "resize") {
      const angle =
        (handle.item.rotation ?? 0) + (handle.corner % 2 === 0 ? 45 : 135);
      const cursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];
      this.canvas.style.cursor =
        cursors[Math.round(angle / 45) % cursors.length];
      return;
    }
    this.canvas.style.cursor =
      this.tool === "select"
        ? "default"
        : this.tool === "erase"
          ? "cell"
          : "crosshair";
  }

  private gesturePreview(): SketchRenderState["gesturePreview"] {
    const gesture = this.bondGesture;
    if (!gesture) return undefined;
    if (this.tool === "chain")
      return { points: this.chainGesturePoints(gesture, gesture.current) };
    if (this.tool !== "bond") return undefined;

    const start =
      gesture.startAtom === null
        ? gesture.start
        : this.graph.getAtom(gesture.startAtom);
    const target = this.bondDragTarget(gesture, gesture.current);
    return {
      points: [start, target],
      startAtom: gesture.startAtom ?? undefined,
      endAtom: target.existingIndex ?? undefined,
    };
  }

  private snappedBondMove(
    gesture: MoveGesture,
    pointer: Point,
  ): MoleculeData | undefined {
    if (!gesture.snapSelection) return undefined;
    const dx = pointer.x - gesture.start.x;
    const dy = pointer.y - gesture.start.y;
    const scale = this.viewport.getScale();
    if (Math.hypot(dx, dy) <= 2 / scale) return undefined;
    return snapMovedBond(
      this.graph.getMoleculeData(),
      gesture.snapSelection,
      dx,
      dy,
      pointer,
      depictionInk(scale).fontPx / scale,
      8 / scale,
    );
  }

  private bondDragTarget(gesture: BondGesture, pointer: Point): BondTarget {
    const hit = this.hitAt(pointer);
    const index = hit.kind === "atom" ? hit.index : null;
    if (index !== null && index !== gesture.startAtom) {
      const { x, y } = this.graph.getAtom(index);
      return { x, y, existingIndex: index };
    }

    const start =
      gesture.startAtom === null
        ? gesture.start
        : this.graph.getAtom(gesture.startAtom);
    const scale = this.viewport.getScale();
    const context = this.canvas?.getContext("2d");
    const text = snapToAnnotationText(
      this.annotations,
      start,
      pointer,
      8 / scale,
      2 / scale,
      context
        ? (label) => measureAnnotationText(context, label, scale).width / scale
        : undefined,
    );
    if (text) return { ...text, existingIndex: null };

    const nearby = findAtom(
      this.graph,
      pointer.x,
      pointer.y,
      CONNECT_SNAP_RADIUS,
    );
    if (nearby !== null && nearby !== gesture.startAtom) {
      const { x, y } = this.graph.getAtom(nearby);
      return { x, y, existingIndex: nearby };
    }
    const target = resolveBondTarget(
      this.graph,
      gesture.startAtom ?? start,
      pointer.x,
      pointer.y,
    );
    if (target.existingIndex === null) return target;
    const { x, y } = this.graph.getAtom(target.existingIndex);
    return { ...target, x, y };
  }

  private chainGesturePoints(gesture: BondGesture, end: Point): Point[] {
    const start =
      gesture.startAtom === null
        ? gesture.start
        : this.graph.getAtom(gesture.startAtom);
    return [
      { x: start.x, y: start.y },
      ...buildChainPoints(start.x, start.y, end.x, end.y, this.bondChainStep)
        .points,
    ];
  }

  private awayDirectionFromAtom(atomIndex: number): Point {
    const data = this.graph.getMoleculeData();
    const anchor = data.atoms[atomIndex];
    let neighborX = 0;
    let neighborY = 0;
    for (const bond of data.bonds) {
      const neighborIndex =
        bond.i === atomIndex ? bond.j : bond.j === atomIndex ? bond.i : null;
      if (neighborIndex === null) continue;
      const neighbor = data.atoms[neighborIndex];
      const dx = neighbor.x - anchor.x;
      const dy = neighbor.y - anchor.y;
      const length = Math.hypot(dx, dy) || 1;
      neighborX += dx / length;
      neighborY += dy / length;
    }
    const awayX = -neighborX;
    const awayY = -neighborY;
    const awayLength = Math.hypot(awayX, awayY);
    if (awayLength < 1e-6) {
      return { x: 1, y: 0 };
    }
    return { x: awayX / awayLength, y: awayY / awayLength };
  }

  private placeFragmentForHit(hit: BoardHit, doc: Point): void {
    if (hit.kind === "atom") {
      const away = this.awayDirectionFromAtom(hit.index);
      this.placeFragmentAt(doc.x, doc.y, hit.index, away);
      return;
    }
    this.placeFragmentAt(doc.x, doc.y);
  }

  private placeRingForHit(hit: BoardHit, doc: Point): void {
    if (hit.kind === "atom") {
      const data = this.graph.getMoleculeData();
      const anchor = data.atoms[hit.index];
      const away = this.awayDirectionFromAtom(hit.index);
      const radius =
        DEFAULT_BOND_LENGTH / (2 * Math.sin(Math.PI / this.ringSize));
      const cx = anchor.x + away.x * radius;
      const cy = anchor.y + away.y * radius;
      const anchorAngle = Math.atan2(anchor.y - cy, anchor.x - cx);
      this.executeCommand(
        new PlaceRingCommand(
          this.graph,
          this.ringSize,
          cx,
          cy,
          DEFAULT_BOND_LENGTH,
          this.ringKind,
          anchorAngle,
          false,
          this.activeColor(),
        ),
      );
      return;
    }

    if (hit.kind === "bond") {
      const data = this.graph.getMoleculeData();
      const bond = data.bonds[hit.index];
      const first = data.atoms[bond.i];
      const second = data.atoms[bond.j];
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) return;
      const normalX = -dy / length;
      const normalY = dx / length;
      const apothem = length / (2 * Math.tan(Math.PI / this.ringSize));
      const midpointX = (first.x + second.x) / 2;
      const midpointY = (first.y + second.y) / 2;
      const candidates = [-1, 1].map((side) => {
        const cx = midpointX + normalX * apothem * side;
        const cy = midpointY + normalY * apothem * side;
        const firstAngle = Math.atan2(first.y - cy, first.x - cx);
        const secondAngle = Math.atan2(second.y - cy, second.x - cx);
        const delta = (secondAngle - firstAngle + Math.PI * 2) % (Math.PI * 2);
        const step = (Math.PI * 2) / this.ringSize;
        const clockwise =
          Math.abs(delta - step) > Math.abs(delta - (Math.PI * 2 - step));
        const template = buildRingTemplate(
          this.ringSize,
          cx,
          cy,
          length,
          this.ringKind,
          firstAngle,
          clockwise,
        );
        let clearance = 0;
        for (
          let vertexIndex = 2;
          vertexIndex < template.vertices.length;
          vertexIndex++
        ) {
          const vertex = template.vertices[vertexIndex];
          let nearest = Infinity;
          for (let atomIndex = 0; atomIndex < data.atoms.length; atomIndex++) {
            if (atomIndex === bond.i || atomIndex === bond.j) continue;
            const atom = data.atoms[atomIndex];
            nearest = Math.min(
              nearest,
              Math.hypot(vertex.x - atom.x, vertex.y - atom.y),
            );
          }
          clearance += Math.min(nearest, DEFAULT_BOND_LENGTH * 3);
        }
        return { cx, cy, firstAngle, clockwise, clearance };
      });
      const placement =
        candidates[1].clearance > candidates[0].clearance
          ? candidates[1]
          : candidates[0];
      this.executeCommand(
        new PlaceRingCommand(
          this.graph,
          this.ringSize,
          placement.cx,
          placement.cy,
          length,
          this.ringKind,
          placement.firstAngle,
          placement.clockwise,
          this.activeColor(),
        ),
      );
      return;
    }

    this.placeRingAt(doc.x, doc.y);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.disabled || this.readonlyMode) return;
    const key = e.key.toLowerCase();
    const hasModifier =
      isCtrlOrMeta({ ctrlKey: e.ctrlKey, metaKey: e.metaKey }) || e.altKey;
    const now = performance.now();
    if (
      !hasModifier &&
      this.elementPrefix &&
      now - this.elementPrefix.at <= 800
    ) {
      const pair = `${this.elementPrefix.key}${key}`;
      const symbol =
        pair === "cl"
          ? "Cl"
          : pair === "br"
            ? "Br"
            : pair === "si"
              ? "Si"
              : null;
      if (symbol) {
        e.preventDefault();
        this.elementPrefix = null;
        this.setElement(symbol);
        this.setTool("atom");
        return;
      }
    }
    if (!hasModifier && (key === "b" || key === "c" || key === "s")) {
      this.elementPrefix = { key, at: now };
    } else if (key !== "l" && key !== "r" && key !== "i") {
      this.elementPrefix = null;
    }

    const action = resolveKeymap(e);
    if (!action) return;
    e.preventDefault();
    switch (action.type) {
      case "undo":
        this.undo();
        break;
      case "redo":
        this.redo();
        break;
      case "delete":
        this.deleteSelection();
        break;
      case "cancel":
        this.clearSelection();
        if (
          this.tool === "annotation" ||
          this.tool === "pan" ||
          this.tool === "erase"
        ) {
          this.setTool("select");
        } else {
          this.cancelTransientGesture();
          this.emitState();
          this.markDirty();
        }
        break;
      case "bondOrder":
        this.setBondOrder(action.order);
        break;
      case "element":
        this.setElement(action.symbol);
        this.setTool("atom");
        break;
      case "panHold":
        this.spacePan = true;
        this.updateCursor();
        break;
    }
  }
}

function sameHit(first: BoardHit, second: BoardHit): boolean {
  if (first.kind !== second.kind) return false;
  if (first.kind === "none" || second.kind === "none") return true;
  return first.index === second.index;
}
