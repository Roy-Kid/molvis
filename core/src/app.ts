import { World } from "./world";
import { System } from "./system";
import {
  EditMode,
  Mode,
  ViewMode,
  SelectMode,
  ManupulateMode,
} from "./mode";
import { KeyboardEventTypes } from "@babylonjs/core";
import { Logger } from "tslog";
import { Controller } from "./controller";


const logger = new Logger({ name: "molvis-core" });

class Molvis {
  private _world: World;
  private _system: System;
  private _mode: Mode;
  private _controller: Controller;
  private _canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._world = new World(canvas);
    this._system = new System();
    this._mode = this.init_mode();
    this._controller = new Controller(this._world, this._system);
  }

  get world(): World {
    return this._world;
  }

  get system(): System {
    return this._system;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get controller(): Controller {
    return this._controller;
  }

  private init_mode = () => {
    this._world.scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "1":
              this._mode = this.switch_mode("view");
              break;
            case "2":
              this._mode = this.switch_mode("select");
              break;
            case "3":
              this._mode = this.switch_mode("edit");
              break;
            case "4":
              this._mode = this.switch_mode("manupulate");
          }
          break;
      }
    });
    return new ViewMode(this);
  };

  public switch_mode = (mode: string): Mode => {
    let _mode = undefined;
    switch (mode) {
      case "edit":
        _mode = new EditMode(this);
        break;
      case "view":
        _mode = new ViewMode(this);
        break;
      case "select":
        _mode = new SelectMode(this);
        break;
      case "manupulate":
        _mode = new ManupulateMode(this);
        break;
      default:
        throw new Error("Invalid mode");
    }
    this._mode.finish();
    return _mode;
  };

  public render = () => {
    this._world.render();
  };

  public resize = () => {
    this._world.resize();
  }

  public finalize = () => {};
}

export { Molvis };
