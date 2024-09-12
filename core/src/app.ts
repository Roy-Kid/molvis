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
    name: string,
    x: number,
    y: number,
    z: number,
    props: object = { type: 0 }
  ) => {
    if (this._system.current_frame === undefined) {
      this._system.append_frame(new Frame());
    }
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

  public add_frame = (
    step: number,
    atoms: { names: string[]; xyz: number[][]; props?: Map<string, any[]> },
    bonds: { bond_ids: number[][]; props?: Map<string, any[]> } = {
      bond_ids: [],
      props: new Map<string, any[]>(),
    }
  ) => {
    const frame = new Frame();
    frame.props.set("step", step);
    const _atoms = new Map<string, Atom>();
    for (let i = 0; i < atoms.names.length; i++) {
      _atoms.set(
        atoms.names[i],
        frame.add_atom(
          atoms.names[i],
          atoms.xyz[i][0],
          atoms.xyz[i][1],
          atoms.xyz[i][2],
          new Map(Object.entries(atoms.props ? atoms.props: new Map()).map(([k, v]) => [k, v[i]]))
        )
      );
    }
    for (let i = 0; i < bonds.bond_ids.length; i++) {
      const [atom1_idx, atom2_idx] = bonds.bond_ids[i];
      const atom1 = _atoms.get(atoms.names[atom1_idx]);
      const atom2 = _atoms.get(atoms.names[atom2_idx]);
      if (atom1 === undefined) {
        throw new Error(`Atom ${atoms.names[atom1_idx]} not found`);
      }
      if (atom2 === undefined) {
        throw new Error(`Atom ${atoms.names[atom2_idx]} not found`);
      }
      frame.add_bond(
        atom1,
        atom2,
        new Map(Object.entries(bonds.props ? bonds.props : new Map()).map(([k, v]) => [k, v[i]]))
      );
    }
    this._system.append_frame(frame);
  }

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
      const result = func(...Object.values(kwargs));
  
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
