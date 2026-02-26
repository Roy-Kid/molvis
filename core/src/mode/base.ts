import {
  KeyboardEventTypes,
  PointerEventTypes,
  Vector2,
  Vector3,
} from "@babylonjs/core";
import type {
  AbstractMesh,
  KeyboardInfo,
  Observer,
  PointerInfo,
} from "@babylonjs/core";
import type { MolvisApp as Molvis } from "../core/app";
import type { ContextMenuController } from "../ui/menus/controller";
import { isCtrlOrMeta } from "../utils/platform";
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

  /**
   * Flag to enable/disable hover highlighting.
   * Defaults to false. Subclasses can enable it.
   */
  protected enableHoverHighlight = false;

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

  protected get world() {
    return this._app.world;
  }

  get type(): ModeType {
    return this.name;
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
  protected onRightClickNotConsumed(
    _pointerInfo: PointerInfo,
    _hit: HitResult | null,
  ): void {
    // Default: do nothing
  }

  public takeScreenShot(): void {
    this.world?.takeScreenShot();
  }

  /**
   * Start the mode - called when mode is activated.
   * Override in subclasses to initialize mode-specific features.
   */
  public start(): void {
    // Default implementation - subclasses can override
  }

  public finish() {
    this.unregister_pointer_events();
    this.unregister_keyboard_events();
    if (this.contextMenuController) {
      this.contextMenuController.dispose();
    }
  }

  private unregister_pointer_events = () => {
    this.scene.onPointerObservable.remove(this._pointer_observer);
  };

  private unregister_keyboard_events = () => {
    this.scene.onKeyboardObservable.remove(this._kb_observer);
  };

  private register_pointer_events() {
    const swallow = (p: Promise<void>) => {
      p.catch((err) => console.error("[Molvis] pointer handler error:", err));
    };

    return this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          swallow(this._on_pointer_down(pointerInfo));
          break;
        case PointerEventTypes.POINTERUP:
          swallow(this._on_pointer_up(pointerInfo));
          break;
        case PointerEventTypes.POINTERMOVE:
          swallow(this._on_pointer_move(pointerInfo));
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
          if (isCtrlOrMeta(kbInfo.event)) {
            // Ctrl/Cmd shortcuts handled by UI layer
          } else {
            switch (kbInfo.event.key) {
              case "e":
                this._on_press_e();
                break;
              case "q":
                this._on_press_q();
                break;
              case "i":
                this._on_press_i();
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
  protected async pickHit(): Promise<HitResult | null> {
    return this.world.picker.pick(this.scene.pointerX, this.scene.pointerY);
  }

  async _on_pointer_down(pointerInfo: PointerInfo): Promise<void> {
    this._pointer_down_xy = this.get_pointer_xy();

    if (pointerInfo.event.button === 0) {
      await this._on_left_down(pointerInfo);
    } else if (pointerInfo.event.button === 2) {
      await this._on_right_down(pointerInfo);
    }
  }

  async _on_pointer_up(pointerInfo: PointerInfo): Promise<void> {
    this._pointer_up_xy = this.get_pointer_xy();

    if (pointerInfo.event.button === 0) {
      await this._on_left_up(pointerInfo);
    } else if (pointerInfo.event.button === 2) {
      await this._on_right_up(pointerInfo);
    }
  }

  protected async _on_left_down(_pointerInfo: PointerInfo): Promise<void> {
    // Override in subclasses
  }

  protected async _on_left_up(_pointerInfo: PointerInfo): Promise<void> {
    // Override in subclasses
  }

  protected async _on_right_down(_pointerInfo: PointerInfo): Promise<void> {
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
  protected async _on_right_up(pointerInfo: PointerInfo): Promise<void> {
    // Pick what's under the cursor
    const hit = await this.pickHit();

    // Let context menu controller handle it first
    const consumed = this.contextMenuController.handleRightClick(
      pointerInfo.event,
      hit,
      this._is_dragging,
    );

    // If not consumed by menu, let mode handle it
    if (!consumed) {
      this.onRightClickNotConsumed(pointerInfo, hit);
    }
  }

  async _on_pointer_move(_pointerInfo: PointerInfo): Promise<void> {
    const hit = await this.pickHit();
    this.app.events.emit("info-text-change", this.formatHitInfo(hit));
  }

  protected formatHitInfo(hit: HitResult | null): string {
    if (!hit || (hit.type !== "atom" && hit.type !== "bond")) {
      return "";
    }
    if (hit.type === "atom") {
      const { element, position } = hit.metadata;
      return `[Atom] element: ${element} | xyz: ${position.x.toFixed(4)}, ${position.y.toFixed(4)}, ${position.z.toFixed(4)} | `;
    }
    const { start, end, atomId1, atomId2, order } = hit.metadata;
    const length = Vector3.Distance(
      new Vector3(start.x, start.y, start.z),
      new Vector3(end.x, end.y, end.z),
    );
    return `[Bond] ${atomId1}-${atomId2} | length: ${length.toFixed(2)}${order ? ` | order: ${order}` : ""}`;
  }

  _on_pointer_wheel(_pointerInfo: PointerInfo): void {}
  _on_pointer_pick(_pointerInfo: PointerInfo): void {}
  _on_pointer_tap(_pointerInfo: PointerInfo): void {}
  _on_pointer_double_tap(_pointerInfo: PointerInfo): void {}
  _on_press_e(): void {}

  _on_press_q(): void {}

  protected _on_press_i(): void {
    this.world.toggleInspector();
  }

  protected _on_press_escape(): void {
    // Override in subclasses for custom escape behavior
  }

  protected _on_press_ctrl_s(): void {}
  protected _on_press_ctrl_z(): void {}
  protected _on_press_ctrl_y(): void {}
  protected _on_press_ctrl_c(): void {}
  protected _on_press_ctrl_v(): void {}

  protected get_pointer_xy(): Vector2 {
    return new Vector2(this.scene.pointerX, this.scene.pointerY);
  }

  protected async pick_mesh(
    type: "atom" | "bond",
  ): Promise<AbstractMesh | null> {
    const hit = await this.pickHit();
    if (hit && hit.type === type && hit.mesh) {
      return hit.mesh;
    }
    return null;
  }
}

export { ModeType };
export { BaseMode };
