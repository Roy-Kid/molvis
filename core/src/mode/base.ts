import {
  PointerInfo,
  PointerEventTypes,
  KeyboardInfo,
  KeyboardEventTypes,
  Observer,
  Vector2,
  AbstractMesh
} from "@babylonjs/core";

import { System, World, GuiManager } from "@molvis/core";

enum ModeType {
  Edit = "edit",
  View = "view",
  Select = "select",
  Manupulate = "manupulate",
}

abstract class BaseMode {
  name: ModeType;

  protected world: World;
  protected system: System;
  protected gui: GuiManager;
  private _pointer_observer: Observer<PointerInfo>;
  private _kb_observer: Observer<KeyboardInfo>;
  private _pointer_down_xy: Vector2 = new Vector2();
  private _pointer_up_xy: Vector2 = new Vector2();

  constructor(name: ModeType, system: System, world: World, gui: GuiManager) {
    this.name = name;
    this.system = system;
    this.gui = gui;
    this.world = world;
    this._pointer_observer = this.register_pointer_events();
    this._kb_observer = this.register_keyboard_events();
    this.init_context_menu();
  }

  private get scene() {
    return this.world.scene;
  }

  private get _is_dragging() {
    // if on and up close enough
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
          switch (kbInfo.event.key) {
            case "e":
              this._on_press_e();
              break;
            case "q":
              this._on_press_q();
              break;
          }
          break;
      }
    });
  };

  _on_pointer_down(pointerInfo: PointerInfo): void {
    this._pointer_down_xy = this.get_pointer_xy();
    // if (this._is_dragging) {
    // } else {
    //   if (this.context_menu.isOpen() && pointerInfo.event.button === 0) {
    //     this.context_menu.hide();
    //   }
    // }
  }

  _on_pointer_up(pointerInfo: PointerInfo): void {
    this._pointer_up_xy = this.get_pointer_xy();
    // if (this._is_dragging) {
    // } else {
    //   if (pointerInfo.event.button === 2) {
    //     this.context_menu.show(this._pointer_up_xy);
    //   }
    // }
  }

  _on_pointer_move(pointerInfo: PointerInfo): void {}
  _on_pointer_wheel(pointerInfo: PointerInfo): void {}
  _on_pointer_pick(pointerInfo: PointerInfo): void {}
  _on_pointer_tap(pointerInfo: PointerInfo): void {}
  _on_pointer_double_tap(pointerInfo: PointerInfo): void {}
  _on_press_e(): void {}
  _on_press_q(): void {}

  protected get_pointer_xy(): Vector2 {
    return new Vector2(this.scene.pointerX, this.scene.pointerY);
  }

  protected pick_mesh(): AbstractMesh | null {
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    if (pickResult.hit) {
      return pickResult.pickedMesh
    }
    return null;
  }
}

export { ModeType };
export { BaseMode };