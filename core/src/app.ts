import { World } from "./world";
import { System } from "./system";
import { EditMode, Mode, ModeType, ViewMode, SelectMode, ManupulateMode } from "./mode";
import { KeyboardEventTypes } from "@babylonjs/core";

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: object;
  id?: string | number | null;
}

class Molvis {
  private _world: World;
  private _system: System;
  private _mode: Mode;
  private _canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._world = new World(canvas);
    this._system = new System();
    this._mode = this.init_mode();
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
        break
      default:
        throw new Error("Invalid mode");
    }
    console.log('finish mode', this._mode.name);
    this._mode.finish();
    return _mode;
  };

  public add_atom = (
    name: string,
    x: number,
    y: number,
    z: number,
    props: object = { type: 0 }
  ) => {
    const atom = this._system.current_frame.add_atom(name, x, y, z, props);
    this._world.artist.draw_atom(atom);
    return atom;
  };

  public add_bond = (itom: any, jtom: any, props: object = {}) => {
    const atom1 = itom;
    const atom2 = jtom;

    const bond = this._system.current_frame.add_bond(atom1, atom2, props);
    this._world.artist.draw_bond(bond);
    return bond;
  };

  public exec_cmd = (request: JsonRpcRequest, buffers: DataView[]) => {
    const { jsonrpc, method, params, id } = request;
    if (jsonrpc !== "2.0") {
      return {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid JSON-RPC version" },
        id: id || null,
      };
    }

    const func = (this as any)[method];
    if (!func) {
      return {
        jsonrpc: "2.0",
        error: { code: -32601, message: "Method not found" },
        id: id || null,
      };
    }

    try {
      console.log("start exec", method, " with ", params);
      const result = func(...Object.values(params || {}));
      console.log("exec_cmd result", result);
      return {
        jsonrpc: "2.0",
        result,
        id: id || null,
      };
    } catch (error: any) {
      return {
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message, data: error.stack },
        id: id || null,
      };
    }
  };

  public render = () => {
    this._world.render();
  };
}

export { Molvis };
