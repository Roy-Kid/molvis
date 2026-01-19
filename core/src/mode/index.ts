import { KeyboardEventTypes, type KeyboardInfo } from "@babylonjs/core";

import type { BaseMode } from "./base";
import { ModeType } from "./base";
import { ViewMode } from "./view";

import { SelectMode } from "./select";
import { MeasureMode } from "./measure";
import { EditMode } from "./edit";
import { ManipulateMode } from "./manipulate";

class ModeManager {
  private _app: any;
  private _mode: BaseMode | null = null;

  constructor(app: any) {
    this._app = app;
    this.switch_mode(ModeType.View);
    this._register_keyboard_events();
  }

  private get _scene() {
    return this._app.world.scene;
  }

  private _register_keyboard_events = () => {
    this._scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "1":
              this.switch_mode(ModeType.View);
              break;
            case "2":
              this.switch_mode(ModeType.Select);
              break;

            case "3":
              this.switch_mode(ModeType.Edit);
              break;

            case "4":
              this.switch_mode(ModeType.Measure);
              break;
            case "5":
              this.switch_mode(ModeType.Manipulate);
              break;
          }
          break;
      }
    });
    // return new ViewMode(this);
  };

  public switch_mode = (mode: ModeType) => {
    if (this._mode) this._mode.finish();
    switch (mode) {

      case ModeType.View:
        this._mode = new ViewMode(this._app);
        break;
      case ModeType.Select:
        this._mode = new SelectMode(this._app);
        break;
      case ModeType.Edit:
        this._mode = new EditMode(this._app);
        break;
      case ModeType.Measure:
        this._mode = new MeasureMode(this._app);
        break;
      case ModeType.Manipulate:
        this._mode = new ManipulateMode(this._app);
        break;

      default:
        throw new Error(`unknown mode: ${mode}`);
    }

    // Call start() on the new mode
    if (this._mode) {
      this._mode.start();
    }

    // Emit mode change event
    if (this._app.events) {
      this._app.events.emit('mode-change', mode);
    }
  };

  public get currentMode(): BaseMode | null {
    return this._mode;
  }

  public get currentModeName(): string {
    return this._mode?.name || ModeType.View;
  }
}

export { ModeManager, ModeType };
