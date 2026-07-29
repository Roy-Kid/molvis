import type { Frame } from "@molcrafts/molrs";
import {
  AddAtomCommand,
  AddBondCommand,
  RemoveAtomCommand,
  RemoveBondCommand,
} from "../commands/edit_commands";
import { DeleteSelectionCommand } from "../commands/delete_selection_command";
import { PlaceChainCommand } from "../commands/place_chain_command";
import { MoleculeGraph } from "../molecule_graph";
import { SketchHistory } from "../sketch_history";
import type { MoleculeData } from "../types";
import { ViewportCoords } from "./coords";
import { HitTester } from "./hit_test";
import { SketchRenderer, type SketchRenderTheme } from "./sketch_renderer";

/** Active drawing tool. */
export type SketchTool = "atom" | "bond" | "select" | "erase";

export interface SketchBoardOptions {
  /** Atom hit/draw radius in document units. Default 0.35. */
  atomRadiusDoc?: number;
  /** Omit letter "C" on carbon atoms. Default true. */
  omitCarbonLabel?: boolean;
  /** Bond-chain step length in document units. Default 1.2. */
  bondChainStep?: number;
}

/**
 * Canvas-backed 2D molecule sketch board.
 *
 * Coordinates: document units are Å-like; pointer events use CSS pixels.
 * Bond empty-drop places a carbon chain at {@link bondChainStep} spacing;
 * the whole chain is one undo step.
 */
export class SketchBoard {
  readonly graph = new MoleculeGraph();
  readonly history = new SketchHistory();
  readonly viewport = new ViewportCoords();
  readonly renderer = new SketchRenderer();

  private readonly atomRadiusDoc: number;
  private readonly omitCarbonLabel: boolean;
  private readonly bondChainStep: number;
  private readonly hitTester: HitTester;

  private canvas: HTMLCanvasElement | null = null;
  private tool: SketchTool = "atom";
  private element = "C";
  private bondOrder: 1 | 2 | 3 = 1;
  private selectedAtoms = new Set<number>();
  private selectedBonds = new Set<number>();
  private dirty = false;
  private raf = 0;

  private bondStartAtom: number | null = null;
  private readonly onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private readonly onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);

  constructor(options: SketchBoardOptions = {}) {
    this.atomRadiusDoc = options.atomRadiusDoc ?? 0.35;
    this.omitCarbonLabel = options.omitCarbonLabel ?? true;
    this.bondChainStep = options.bondChainStep ?? 1.2;
    this.hitTester = new HitTester(this.atomRadiusDoc, this.atomRadiusDoc * 0.6);
  }

  mount(canvas: HTMLCanvasElement): void {
    if (this.canvas) this.unmount();
    this.canvas = canvas;
    canvas.tabIndex = 0;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("keydown", this.onKeyDown);
    const rect = canvas.getBoundingClientRect();
    this.resize(rect.width || 300, rect.height || 200);
    this.markDirty();
  }

  unmount(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("keydown", this.onKeyDown);
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
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
    }
    this.markDirty();
  }

  setTool(tool: SketchTool): void {
    this.tool = tool;
    this.bondStartAtom = null;
  }

  getTool(): SketchTool {
    return this.tool;
  }

  setElement(symbol: string): void {
    this.element = symbol || "C";
  }

  getElement(): string {
    return this.element;
  }

  setBondOrder(order: 1 | 2 | 3): void {
    this.bondOrder = order;
  }

  getBondOrder(): 1 | 2 | 3 {
    return this.bondOrder;
  }

  setTheme(theme: Partial<SketchRenderTheme>): void {
    this.renderer.setTheme(theme);
    this.markDirty();
  }

  clear(): void {
    const empty: MoleculeData = { atoms: [], bonds: [] };
    // snapshot via load after capturing undo via composite remove — simple replace:
    this.history.clearHistory();
    this.graph.loadMoleculeData(empty);
    this.selectedAtoms.clear();
    this.selectedBonds.clear();
    this.markDirty();
  }

  undo(): void {
    if (this.history.undo()) {
      this.selectedAtoms.clear();
      this.selectedBonds.clear();
      this.markDirty();
    }
  }

  redo(): void {
    if (this.history.redo()) {
      this.selectedAtoms.clear();
      this.selectedBonds.clear();
      this.markDirty();
    }
  }

  getMoleculeData(): MoleculeData {
    return this.graph.getMoleculeData();
  }

  loadMoleculeData(data: MoleculeData): void {
    this.graph.loadMoleculeData(data);
    this.selectedAtoms.clear();
    this.selectedBonds.clear();
    this.markDirty();
  }

  toFrame(): Frame {
    return this.graph.toFrame();
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
    });
  }

  private paint(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    this.renderer.paint(ctx, this.graph, this.viewport, {
      selectedAtoms: this.selectedAtoms,
      selectedBonds: this.selectedBonds,
      omitCarbonLabel: this.omitCarbonLabel,
      atomRadiusDoc: this.atomRadiusDoc,
    });
  }

  private eventDoc(e: PointerEvent): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return this.viewport.screenToDoc(sx, sy);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (!this.canvas) return;
    this.canvas.focus();
    const doc = this.eventDoc(e);
    const hit = this.hitTester.hit(this.graph, doc.x, doc.y);

    if (this.tool === "bond") {
      if (hit.kind === "atom") this.bondStartAtom = hit.index;
      else this.bondStartAtom = null;
      return;
    }

    if (this.tool === "atom") {
      if (hit.kind === "atom") return;
      this.history.execute(
        new AddAtomCommand(this.graph, {
          element: this.element,
          x: doc.x,
          y: doc.y,
        }),
      );
      this.markDirty();
      return;
    }

    if (this.tool === "erase") {
      if (hit.kind === "atom") {
        this.history.execute(new RemoveAtomCommand(this.graph, hit.index));
        this.selectedAtoms.clear();
        this.selectedBonds.clear();
        this.markDirty();
      } else if (hit.kind === "bond") {
        this.history.execute(new RemoveBondCommand(this.graph, hit.index));
        this.selectedBonds.clear();
        this.markDirty();
      }
      return;
    }

    if (this.tool === "select") {
      if (hit.kind === "atom") {
        if (this.selectedAtoms.has(hit.index)) this.selectedAtoms.delete(hit.index);
        else {
          this.selectedAtoms.clear();
          this.selectedBonds.clear();
          this.selectedAtoms.add(hit.index);
        }
      } else if (hit.kind === "bond") {
        if (this.selectedBonds.has(hit.index)) this.selectedBonds.delete(hit.index);
        else {
          this.selectedAtoms.clear();
          this.selectedBonds.clear();
          this.selectedBonds.add(hit.index);
        }
      } else {
        this.selectedAtoms.clear();
        this.selectedBonds.clear();
      }
      this.markDirty();
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.canvas || this.tool !== "bond") return;
    const start = this.bondStartAtom;
    this.bondStartAtom = null;
    if (start === null) return;

    const doc = this.eventDoc(e);
    const hit = this.hitTester.hit(this.graph, doc.x, doc.y);

    if (hit.kind === "atom") {
      if (hit.index === start) return;
      // existing bond?
      const data = this.graph.getMoleculeData();
      const exists = data.bonds.some(
        (b) =>
          (b.i === start && b.j === hit.index) ||
          (b.j === start && b.i === hit.index),
      );
      if (exists) return;
      this.history.execute(
        new AddBondCommand(this.graph, {
          i: start,
          j: hit.index,
          order: this.bondOrder,
        }),
      );
      this.markDirty();
      return;
    }

    // Carbon chain toward empty point
    this.history.execute(
      new PlaceChainCommand(
        this.graph,
        start,
        doc.x,
        doc.y,
        this.bondChainStep,
        this.bondOrder,
      ),
    );
    this.markDirty();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    e.preventDefault();
    if (this.selectedAtoms.size === 0 && this.selectedBonds.size === 0) return;

    const atomIdxs = [...this.selectedAtoms];
    const bondIdxs = [...this.selectedBonds];
    this.history.execute(
      new DeleteSelectionCommand(this.graph, atomIdxs, bondIdxs),
    );
    this.selectedAtoms.clear();
    this.selectedBonds.clear();
    this.markDirty();
  }
}
