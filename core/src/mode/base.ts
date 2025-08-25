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
} from "@babylonjs/core";
import {
  draw_frame
} from "@molvis/core";
import type { Molvis } from "@molvis/core";

enum ModeType {
  View = "view",
  Select = "select",
  Measure = "measure",
  Manupulate = "manupulate",
}

abstract class BaseMode {
  name: ModeType;

  private _app: Molvis;
  private _pointer_observer: Observer<PointerInfo>;
  private _kb_observer: Observer<KeyboardInfo>;
  protected _pointer_down_xy: Vector2 = new Vector2();
  protected _pointer_up_xy: Vector2 = new Vector2();
  private _contextMenuOpen = false;

  constructor(name: ModeType, app: Molvis) {
    this._app = app;
    this.name = name;
    this._pointer_observer = this.register_pointer_events();
    this._kb_observer = this.register_keyboard_events();
    this.init_context_menu();
  }

  private get scene() {
    return this._app.world.scene;
  }

  protected get app() {
    return this._app;
  }

  protected get gui() {
    return this._app.gui;
  }

  protected get system() {
    return this._app.system;
  }

  protected get world() {
    return this._app.world;
  }

  protected get _is_dragging() {
    return this._pointer_up_xy.subtract(this._pointer_down_xy).length() > 0.2;
  }

  // protected get context_menu() {
  //   return this.gui.contextMenu;
  // }

  protected init_context_menu() { }

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

  protected abstract showContextMenu(x: number, y: number): void;
  protected abstract hideContextMenu(): void;
  protected isContextMenuOpen(): boolean { return this._contextMenuOpen; }
  
  protected setContextMenuState(open: boolean): void {
    this._contextMenuOpen = open;
  }

  _on_pointer_down(pointerInfo: PointerInfo): void {
    this._pointer_down_xy = this.get_pointer_xy();
    
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
    const mesh = this.pick_mesh();
    
    if (mesh?.metadata) {
      const meshType = mesh.name.split(':')[0];
      
      if (meshType === 'atom') {
        const atomData = mesh.metadata;
        const element = atomData.element || 'Unknown';
        const type = atomData.type || 'Unknown';
        const atomName = mesh.name.split(':')[1] || 'Unknown';
        const atomId = atomData.id ?? 'Unknown';
        const x = mesh.position.x.toFixed(2);
        const y = mesh.position.y.toFixed(2);
        const z = mesh.position.z.toFixed(2);
        const infoText = `${atomId} | ${type ?? element} | name: ${atomName} | xyz: ${x}, ${y}, ${z}`;
        this.gui.updateInfoText(infoText);
      } else if (meshType === 'bond') {
        const bondData = mesh.metadata;
        const bondName = mesh.name.split(':')[1] || 'Unknown';
        const itomName = bondData.itom_name || 'Unknown';
        const jtomName = bondData.jtom_name || 'Unknown';
        const order = bondData.order || 1;
        const infoText = `Bond: ${itomName} - ${jtomName} (${bondName}) Order: ${order}`;
        this.gui.updateInfoText(infoText);
      } else {
        this.gui.updateInfoText(mesh.name);
      }
    } else {
      this.gui.updateInfoText("");
    }
  }

  _on_pointer_wheel(_pointerInfo: PointerInfo): void {}
  _on_pointer_pick(_pointerInfo: PointerInfo): void {}
  _on_pointer_tap(_pointerInfo: PointerInfo): void {}
  _on_pointer_double_tap(_pointerInfo: PointerInfo): void {}
  _on_press_e(): void {
    const frame = this.system.next_frame();
    // 切换frame时先清除旧内容
    this.world.clear();
    draw_frame(this.app, frame, { atoms: {}, bonds: {} });
    if (this.gui) {
      this.gui.updateFrameIndicator(
        this.system.current_frame_index,
        this.system.n_frames,
      );
    }
  }
  
  _on_press_q(): void {
    const frame = this.system.prev_frame();
    // 切换frame时先清除旧内容
    this.world.clear();
    draw_frame(this.app, frame, { atoms: {}, bonds: {} });
    if (this.gui) {
      this.gui.updateFrameIndicator(
        this.system.current_frame_index,
        this.system.n_frames,
      );
    }
  }
  
  protected _on_press_escape(): void {
    // Override in subclasses for custom escape behavior
  }

  protected _on_press_ctrl_s(): void {}
  protected _on_press_ctrl_z(): void {}
  protected _on_press_ctrl_y(): void {}

  protected get_pointer_xy(): Vector2 {
    return new Vector2(this.scene.pointerX, this.scene.pointerY);
  }

  protected pick_mesh(type: "atom" | "bond"="atom"): AbstractMesh | null {
    const scene = this.world.scene;
    
    const pickResult = scene.pick(
      scene.pointerX, 
      scene.pointerY,
      (mesh) => {
        return mesh.name.startsWith(`${type}:`) && mesh.isEnabled() && mesh.isVisible;
      },
      false,
      this.world.camera
    );
    
    return pickResult.hit ? pickResult.pickedMesh : null;
  }
}

export { ModeType };
export { BaseMode };