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
import { Pane } from "tweakpane";

enum ModeType {
  View = "view",
  Select = "select",
  Edit = "edit",
  Measure = "measure",
  Manupulate = "manupulate",
}

class BaseModeMenu {
  private container: HTMLDivElement | null = null;
  private pane: Pane | null = null;
  private containerId: string;
  private isBuilt: boolean;

  constructor(private mode: BaseMode, containerId: string, private app: Molvis, private addCustomMenu?: (pane: any) => void) {
    this.containerId = containerId;
    this.isBuilt = false;
  }

  private build() {
    // Check if container already exists
    const existingContainer = document.getElementById(this.containerId) as HTMLDivElement;

    if (existingContainer) {
      // Reuse existing container
      this.container = existingContainer;
      // Clean up existing Pane
      if (this.pane) {
        this.pane.dispose();
      }
    } else {
      // Create new menu container
      this.container = document.createElement("div");
      this.container.id = this.containerId;
      this.container.className = "MolvisModeMenu";
      this.container.style.position = "absolute"; // Absolute within UI overlay
      this.container.style.pointerEvents = "auto";
      this.container.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
      this.container.style.borderRadius = "8px";
      this.container.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
      this.container.style.zIndex = "10000";

      // Mount to UI overlay container instead of body
      // This ensures the menu works with the pointer-events setup
      this.app.uiContainer.appendChild(this.container);
    }

    this.pane = new Pane({
      container: this.container,
      title: "Mode Menu",
      expanded: true
    });
    (this.pane as any).hidden = true;

    // Build menu content
    this.buildMenuContent();
    this.isBuilt = true;
  }

  private buildMenuContent() {
    if (!this.pane) return;

    // Clear existing menu items
    const paneAny = this.pane as any;
    if (paneAny.children) {
      for (const c of paneAny.children) {
        paneAny.remove(c);
      }
    }

    // Common actions
    (this.pane as any).addButton({ title: "Snapshot" }).on("click", () => {
      this.mode.takeScreenShot();
    });

    // Add custom menu items
    if (this.addCustomMenu) {
      this.addCustomMenu(this.pane);
    }
  }

  public show(x: number, y: number) {
    if (!this.isBuilt) {
      this.build();
    }
    if (this.container && this.pane) {
      this.container.style.left = `${x}px`;
      this.container.style.top = `${y}px`;
      this.container.style.display = 'block';
      (this.pane as any).hidden = false;
    }
  }

  public hide() {
    if (this.container) {
      this.container.style.display = 'none'; // Hide container
    }
    if (this.pane) {
      (this.pane as any).hidden = true;
    }
  }

  public dispose() {
    if (this.pane) {
      this.pane.dispose();
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

abstract class BaseMode {
  name: ModeType;

  private _app: Molvis;
  private _pointer_observer: Observer<PointerInfo>;
  private _kb_observer: Observer<KeyboardInfo>;
  protected _pointer_down_xy: Vector2 = new Vector2();
  protected _pointer_up_xy: Vector2 = new Vector2();
  private _contextMenuOpen = false;
  protected contextMenu!: BaseModeMenu;

  constructor(name: ModeType, app: Molvis) {
    this._app = app;
    this.name = name;
    this._pointer_observer = this.register_pointer_events();
    this._kb_observer = this.register_keyboard_events();
    this.init_context_menu();
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

  protected init_context_menu() {
    this.contextMenu = new BaseModeMenu(this, "molvis-base-menu", this._app, this.getCustomMenuBuilder());
  }

  protected getCustomMenuBuilder(): ((pane: any) => void) | undefined {
    return undefined;
  }

  public takeScreenShot(): void {
    this.world?.takeScreenShot();
  }

  public finish() {
    this.unregister_pointer_events();
    this.unregister_keyboard_events();
  }

  private unregister_pointer_events = () => {
    const is_successful = this.scene.onPointerObservable.remove(
      this._pointer_observer,
    );
    if (!is_successful) {
    }
  };

  private unregister_keyboard_events = () => {
    const is_successful = this.scene.onKeyboardObservable.remove(
      this._kb_observer,
    );
    if (!is_successful) {
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
          if ((kbInfo.event.key === "Escape" || kbInfo.event.key === "Enter") && this._contextMenuOpen) {
            this.hideContextMenu();
            this._contextMenuOpen = false;
          } else {
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
          }
          break;
      }
    });
  };

  protected showContextMenu(x: number, y: number): void {
    this.contextMenu.show(x, y);
    this._contextMenuOpen = true;
  }

  protected hideContextMenu(): void {
    this.contextMenu.hide();
    this._contextMenuOpen = false;
  }
  protected isContextMenuOpen(): boolean { return this._contextMenuOpen; }

  protected setContextMenuState(open: boolean): void {
    this._contextMenuOpen = open;
  }

  _on_pointer_down(pointerInfo: PointerInfo): void {
    this._pointer_down_xy = this.get_pointer_xy();

    // Auto-switch active camera on click
    const x = pointerInfo.event.clientX;
    const y = pointerInfo.event.clientY;
    const camIndex = this.world.viewManager.pickCamera(x, y);
    if (camIndex !== -1) {
      this.world.viewManager.setActiveCamera(camIndex);
    }

    if (pointerInfo.event.button === 0) {
      this._on_left_down(pointerInfo);
    } else if (pointerInfo.event.button === 2) {
      this._on_right_down(pointerInfo);
    }

    if (this._contextMenuOpen && pointerInfo.event.button === 0) {
      this.hideContextMenu();
      this._contextMenuOpen = false;
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
  }

  protected _on_left_up(_pointerInfo: PointerInfo): void {
    if (this._contextMenuOpen) {
      this.hideContextMenu();
      this._contextMenuOpen = false;
    }
  }

  protected _on_right_down(_pointerInfo: PointerInfo): void {
  }

  protected _on_right_up(pointerInfo: PointerInfo): void {
    if (!this._is_dragging) {
      // Prevent default context menu
      pointerInfo.event.preventDefault();

      if (this._contextMenuOpen) {
        this.hideContextMenu();
        this._contextMenuOpen = false;
      } else {
        const { x, y } = pointerInfo.event;
        this.showContextMenu(x, y);
        this._contextMenuOpen = true;
      }
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
        const i = bondData.i[pickResult.thinInstanceIndex!];
        const j = bondData.j[pickResult.thinInstanceIndex!];
        const infoText = `Bond: ${i} - ${j}`;
        this.gui.updateInfoText(infoText);
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