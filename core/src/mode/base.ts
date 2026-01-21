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
  protected onRightClickNotConsumed(_pointerInfo: PointerInfo, _hit: HitResult | null): void {
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
              case "c":
                this._on_press_ctrl_c();
                break;
              case "v":
                this._on_press_ctrl_v();
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
    const thinIndex = pickResult.thinInstanceIndex ?? -1;

    const meta = thinIndex >= 0
      ? this.world.sceneIndex.getMeta(mesh.uniqueId, thinIndex)
      : this.world.sceneIndex.getMeta(mesh.uniqueId);

    if (!meta || (meta.type !== 'atom' && meta.type !== 'bond')) {
      return { type: "empty" };
    }

    return {
      type: meta.type,
      mesh,
      thinInstanceIndex: thinIndex,
    };
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
    if (mesh) {
      const thinIndex = pickResult.thinInstanceIndex ?? -1;
      const meta = thinIndex >= 0
        ? this.world.sceneIndex.getMeta(mesh.uniqueId, thinIndex)
        : this.world.sceneIndex.getMeta(mesh.uniqueId);

      if (!meta || (meta.type !== 'atom' && meta.type !== 'bond')) {
        this.app.events.emit('info-text-change', mesh.name);
        return;
      }

      if (meta.type === 'atom') {
        const infoText = `[Atom] element: ${meta.element} | xyz: ${meta.position.x.toFixed(4)}, ${meta.position.y.toFixed(4)}, ${meta.position.z.toFixed(4)} | `;
        this.app.events.emit('info-text-change', infoText);
      } else {
        const start = meta.start;
        const end = meta.end;
        const length = Vector3.Distance(
          new Vector3(start.x, start.y, start.z),
          new Vector3(end.x, end.y, end.z)
        );
        const infoText = `[Bond] ${meta.atomId1}-${meta.atomId2} | ` +
          `start: (${start.x.toFixed(2)}, ${start.y.toFixed(2)}, ${start.z.toFixed(2)}) | ` +
          `end: (${end.x.toFixed(2)}, ${end.y.toFixed(2)}, ${end.z.toFixed(2)}) | ` +
          `length: ${length.toFixed(2)} Å` +
          (meta.order ? ` | order: ${meta.order}` : '');
        this.app.events.emit('info-text-change', infoText);
      }
    } else {
      this.app.events.emit('info-text-change', "");
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
  protected _on_press_ctrl_c(): void { }
  protected _on_press_ctrl_v(): void { }

  protected get_pointer_xy(): Vector2 {
    return new Vector2(this.scene.pointerX, this.scene.pointerY);
  }

  protected pick_mesh(type: "atom" | "bond"): AbstractMesh | null {
    const scene = this.world.scene;

    const pickResult = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (mesh: AbstractMesh) => {
        const metaType = this.world.sceneIndex.getType(mesh.uniqueId);

        if (type === 'atom') {
          return metaType === 'atom';
        } else if (type === 'bond') {
          return metaType === 'bond';
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
