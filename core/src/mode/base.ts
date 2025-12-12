import {
  PointerEventTypes,
  KeyboardEventTypes,
  Vector2,
} from "@babylonjs/core";
import type {
  PointerInfo,
  KeyboardInfo,
  AbstractMesh,
  Observer,
  Vector3,
} from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import { getPositionFromMatrix } from "./utils";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult } from "./types";

enum ModeType {
  View = "view",
  Select = "select",
  Edit = "edit",
  Measure = "measure",
  Manipulate = "manipulate",
}

/**
 * Base class for all interaction modes.
 * 
 * Event Flow Architecture:
 * ========================
 * Right-click events follow a layered approach:
 * 1. Event arrives at _on_right_up()
 * 2. Mode picks the hit result (atom/bond/empty)
 * 3. Context menu controller decides whether to show menu
 * 4. If menu is shown, event is consumed
 * 5. If not consumed, mode handles it via onRightClickNotConsumed()
 * 
 * Each mode must implement:
 * - createContextMenuController(): Create mode-specific menu controller
 * - onRightClickNotConsumed(): Handle right-click when menu doesn't consume it
 */
abstract class BaseMode {
  name: ModeType;

  private _app: Molvis;
  private _pointer_observer: Observer<PointerInfo>;
  private _kb_observer: Observer<KeyboardInfo>;
  protected _pointer_down_xy: Vector2 = new Vector2();
  protected _pointer_up_xy: Vector2 = new Vector2();

  // Context menu controller (mode-specific)
  protected contextMenuController!: ContextMenuController;

  constructor(name: ModeType, app: Molvis) {
    this._app = app;
    this.name = name;
    this._pointer_observer = this.register_pointer_events();
    this._kb_observer = this.register_keyboard_events();
    this.initContextMenu();
  }

  protected get scene() {
    return this._app.world.scene;
  }

  protected get app() {
    return this._app;
  }

  protected get gui() {
    return this._app.gui;
  }

  protected get world() {
    return this._app.world;
  }

  protected get _is_dragging() {
    return this._pointer_up_xy.subtract(this._pointer_down_xy).length() > 0.2;
  }

  /**
   * Initialize the context menu controller.
   * Calls the abstract createContextMenuController() method.
   */
  private initContextMenu() {
    this.contextMenuController = this.createContextMenuController();
  }

  /**
   * Create mode-specific context menu controller.
   * Must be implemented by each mode.
   */
  protected abstract createContextMenuController(): ContextMenuController;

  /**
   * Handle right-click when context menu doesn't consume the event.
   * Override in subclasses for mode-specific right-click behavior.
   */
  protected onRightClickNotConsumed(_pointerInfo: PointerInfo, _hit: HitResult | null): void {
    // Default: do nothing
  }

  public takeScreenShot(): void {
    this.world?.takeScreenShot();
  }

  public finish() {
    this.unregister_pointer_events();
    this.unregister_keyboard_events();
    if (this.contextMenuController) {
      this.contextMenuController.dispose();
    }
  }

  private unregister_pointer_events = () => {
    const is_successful = this.scene.onPointerObservable.remove(
      this._pointer_observer,
    );
    if (!is_successful) {
      // Observer removal failed
    }
  };

  private unregister_keyboard_events = () => {
    const is_successful = this.scene.onKeyboardObservable.remove(
      this._kb_observer,
    );
    if (!is_successful) {
      // Observer removal failed
    }
  };

  private register_pointer_events() {
    return this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          this._on_pointer_down(pointerInfo);
          break;
        case PointerEventTypes.POINTERUP:
          this._on_pointer_up(pointerInfo);
          break;
        case PointerEventTypes.POINTERMOVE:
          this._on_pointer_move(pointerInfo);
          break;
        case PointerEventTypes.POINTERWHEEL:
          this._on_pointer_wheel(pointerInfo);
          break;
        case PointerEventTypes.POINTERPICK:
          this._on_pointer_pick(pointerInfo);
          break;
        case PointerEventTypes.POINTERTAP:
          this._on_pointer_tap(pointerInfo);
          break;
        case PointerEventTypes.POINTERDOUBLETAP:
          this._on_pointer_double_tap(pointerInfo);
          break;
      }
    });
  }

  private register_keyboard_events = () => {
    return this.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          // Handle Ctrl key combinations
          if (kbInfo.event.ctrlKey) {
            switch (kbInfo.event.key.toLowerCase()) {
              case "s":
                this._on_press_ctrl_s();
                break;
              case "z":
                this._on_press_ctrl_z();
                break;
              case "y":
                this._on_press_ctrl_y();
                break;
            }
          } else {
            switch (kbInfo.event.key) {
              case "e":
                this._on_press_e();
                break;
              case "q":
                this._on_press_q();
                break;
              case "Escape":
                this._on_press_escape();
                break;
            }
          }
          break;
      }
    });
  };

  /**
   * Pick and create a HitResult from the current pointer position.
   * Returns hit information about what's under the cursor.
   */
  protected pickHit(): HitResult | null {
    const scene = this.world.scene;
    const pickResult = scene.pick(
      scene.pointerX,
      scene.pointerY,
      undefined,
      false,
      this.world.camera
    );

    if (!pickResult.hit || !pickResult.pickedMesh) {
      return { type: "empty" };
    }

    const mesh = pickResult.pickedMesh;
    const metadata = mesh.metadata;

    if (metadata?.meshType === "atom") {
      return {
        type: "atom",
        mesh,
        metadata,
        thinInstanceIndex: pickResult.thinInstanceIndex ?? -1,
      };
    } else if (metadata?.meshType === "bond") {
      return {
        type: "bond",
        mesh,
        metadata,
        thinInstanceIndex: pickResult.thinInstanceIndex ?? -1,
      };
    }

    return { type: "empty" };
  }

  _on_pointer_down(pointerInfo: PointerInfo): void {
    this._pointer_down_xy = this.get_pointer_xy();

    if (pointerInfo.event.button === 0) {
      this._on_left_down(pointerInfo);
    } else if (pointerInfo.event.button === 2) {
      this._on_right_down(pointerInfo);
    }
  }

  _on_pointer_up(pointerInfo: PointerInfo): void {
    this._pointer_up_xy = this.get_pointer_xy();

    if (pointerInfo.event.button === 0) {
      this._on_left_up(pointerInfo);
    } else if (pointerInfo.event.button === 2) {
      this._on_right_up(pointerInfo);
    }
  }

  protected _on_left_down(_pointerInfo: PointerInfo): void {
    // Override in subclasses
  }

  protected _on_left_up(_pointerInfo: PointerInfo): void {
    // Override in subclasses
  }

  protected _on_right_down(_pointerInfo: PointerInfo): void {
    // Override in subclasses
  }

  /**
   * Right-click handler with layered event flow.
   * 
   * Flow:
   * 1. Pick what's under the cursor
   * 2. Let context menu controller decide if it wants to handle this
   * 3. If menu consumes event (shows menu), we're done
   * 4. Otherwise, delegate to mode-specific logic via onRightClickNotConsumed()
   */
  protected _on_right_up(pointerInfo: PointerInfo): void {
    // Pick what's under the cursor
    const hit = this.pickHit();

    // Let context menu controller handle it first
    const consumed = this.contextMenuController.handleRightClick(
      pointerInfo.event,
      hit,
      this._is_dragging
    );

    // If not consumed by menu, let mode handle it
    if (!consumed) {
      this.onRightClickNotConsumed(pointerInfo, hit);
    }
  }

  _on_pointer_move(_pointerInfo: PointerInfo): void {
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, undefined, false, this.world.camera);
    const mesh = pickResult.hit ? pickResult.pickedMesh : null;
    if (mesh?.metadata) {
      const meshType = mesh.metadata.meshType;

      if (meshType === 'atom') {
        const atomData = mesh.metadata;
        const atomThinIndex = pickResult.thinInstanceIndex!;
        let atomInfo = new Map<string, string>();
        let pos: Vector3;
        if (atomThinIndex != -1) {  // thin instances
          const m = atomData.matrices as Float32Array;
          pos = getPositionFromMatrix(m, atomThinIndex);
        } else {
          pos = mesh.position;
        }
        atomInfo.set("xyz", `${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)}`);

        let infoText = `[Atom] `;
        atomInfo.forEach((value, key) => {
          infoText += `${key}: ${value} | `;
        });
        this.gui.updateInfoText(infoText);
      } else if (meshType === 'bond') {
        const bondData = mesh.metadata;
        const bondThinIndex = pickResult.thinInstanceIndex!;
        if (bondThinIndex !== -1 && bondData.i && bondData.j) {
          // Thin instance bond (instanced rendering)
          const i = bondData.i[bondThinIndex];
          const j = bondData.j[bondThinIndex];
          const infoText = `Bond: ${i} - ${j}`;
          this.gui.updateInfoText(infoText);
        } else {
          // Regular bond mesh (dynamic rendering)
          const infoText = bondData.order ? `Bond (order: ${bondData.order})` : 'Bond';
          this.gui.updateInfoText(infoText);
        }
      } else {
        this.gui.updateInfoText(mesh.name);
      }
    } else {
      this.gui.updateInfoText("");
    }
  }

  _on_pointer_wheel(_pointerInfo: PointerInfo): void { }
  _on_pointer_pick(_pointerInfo: PointerInfo): void { }
  _on_pointer_tap(_pointerInfo: PointerInfo): void { }
  _on_pointer_double_tap(_pointerInfo: PointerInfo): void { }
  _on_press_e(): void { }

  _on_press_q(): void { }

  protected _on_press_escape(): void {
    // Override in subclasses for custom escape behavior
  }

  protected _on_press_ctrl_s(): void { }
  protected _on_press_ctrl_z(): void { }
  protected _on_press_ctrl_y(): void { }

  protected get_pointer_xy(): Vector2 {
    return new Vector2(this.scene.pointerX, this.scene.pointerY);
  }

  protected pick_mesh(type: "atom" | "bond"): AbstractMesh | null {
    const scene = this.world.scene;

    const pickResult = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (mesh: AbstractMesh) => {
        const md: any = (mesh as any).metadata;
        const meshType = md?.meshType;
        if (meshType === type) {
          return true;
        }
        return false;
      },
      false,
      this.world.camera
    );
    return pickResult.hit ? pickResult.pickedMesh : null;
  }
}

export { ModeType };
export { BaseMode };