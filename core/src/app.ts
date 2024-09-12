import { World } from "./world";
import { Frame, System, Atom, Bond } from "./system";
import {
  EditMode,
  Mode,
  ModeType,
  ViewMode,
  SelectMode,
  ManupulateMode,
} from "./mode";
import { KeyboardEventTypes } from "@babylonjs/core";
import { Logger } from "tslog";

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: object;
  id: number | null;
}

const logger = new Logger({ name: "molvis-core" });

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
        break;
      default:
        throw new Error("Invalid mode");
    }
    this._mode.finish();
    return _mode;
  };

  public add_atom = (
    id: number,
    x: number,
    y: number,
    z: number,
    props: object = { type: 0 }
  ) => {
    const atom = this._system.current_frame.add_atom(id, x, y, z, props);
    logger.debug(this._system.current_frame.n_atoms);
    return atom;
  };

  public add_bond = (itom: Atom|number, jtom: Atom|number, props: object = {}) => {
    if (typeof itom === 'number') {
      itom = this._system.current_frame.get_atom((atom: Atom) => atom.id === itom)!;
    }
    if (typeof jtom === 'number') {
      jtom = this._system.current_frame.get_atom((atom: Atom) => atom.id === jtom)!;
    }
    if (itom === undefined || jtom === undefined) {
      throw new Error('Atom not found');
    }
    const bond = this._system.current_frame.add_bond(itom, jtom, props);
    this._world.artist.draw_bond(bond);
    return bond;
  };

  public draw_frame = (idx: number) => {
    this._system.current_frame_index = idx;
    const frame = this._system.current_frame;
    this._world.artist.draw_frame(frame);
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

    try {
      const parts = method.split('.');
      const methodName = parts.pop();
      if (!methodName) {
        throw new Error('Invalid method format');
      }
  
      const context = parts.reduce((acc, part) => acc && acc[part], this);
      if (!context || typeof context[methodName] !== 'function') {
        throw new Error('Method not found or is not a function');
      }
  
      const func = context[methodName].bind(context);
      const kwargs = params || {};
      const result = func(kwargs);
  
      // 返回 JSON-RPC 响应
      return {
        jsonrpc: "2.0",
        result,
        id: id || null,
      };
  
    } catch (error: any) {
      // 错误处理
      return {
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message, data: error.stack },
        id: id || null,
      };
    }
  }
  
  public render = () => {
    this._world.render();
  };

  public finalize = () => {
    
  };
}

export { Molvis };
