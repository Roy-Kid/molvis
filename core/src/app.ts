import { KeyboardEventTypes } from "@babylonjs/core";
import { Logger } from "tslog";
import { EditMode, ManupulateMode, Mode, SelectMode, ViewMode } from "./mode";
import { System } from "./system";
import { World } from "./world";
import { Atom } from "./system";
import { Vector3 } from "@babylonjs/core";

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: object;
  id: number | null;
}

interface FrameLikeObject {
  atoms: {name: string[], x: number[], y: number[], z: number[]};
  bonds: {i: number[], j: number[]};
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

  public render = () => {
    this._world.render();
  };

  public resize = () => {
    this._world.resize();
  };

  public finalize = () => {};

  public draw_atom = (
    data: Map<string, any>
  ) => {
    const atom = this._system.current_frame.add_atom(data);
    this._world.artist.draw_atom(atom);
    return atom;
  };

  public draw_bond = (
    itom: Atom,
    jtom: Atom,
    props: Map<string, any> = new Map()
  ) => {
    const bond = this._system.current_frame.add_bond(itom, jtom, props);
    this._world.artist.draw_bond(bond);
    return bond;
  };

  public draw_frame = (
    frame: FrameLikeObject
  ) => {

    const atoms = frame.atoms;
    const bonds = frame.bonds;
    
    const n_atoms = atoms.x.length;
    const n_bonds = bonds.i.length;
    logger.info(`draw_frame: ${n_atoms} atoms, ${n_bonds} bonds`);
    const atom_list = [];
    for (let i = 0; i < n_atoms; i++) {
      const atom = new Map();
      for (const [key, values] of Object.entries(atoms)) {
        atom.set(key, values[i]);
      }
      atom_list.push(this.draw_atom(atom));
    }
    for (let i = 0; i < n_bonds; i++) {
      const itom = atom_list[bonds.i[i]];
      const jtom = atom_list[bonds.j[i]];
      this.draw_bond(itom, jtom);
    }
    const ramdom_atom = this._system.current_frame.atoms[0];
    const { x, y, z } = ramdom_atom.xyz;
    this.cameraLookAt(x, y, z);
    return this._system.current_frame;
  };

  public select_frame = (idx: number) => {
    this._system.current_frame_index = idx;
    const frame = this._system.current_frame;
    this._world.artist.draw_frame(frame);
  };

  public cameraLookAt = (x: number, y: number, z: number) => {
    this._world.camera.target = new Vector3(x, y, z);
  };

  public label_atom = (labels: string | string[] | undefined) => {

    let _labels: Record<string, string>;

    if (labels === undefined) {
      _labels = this._system.current_frame.atoms.reduce((acc: Record<string, string>, atom) => {
        acc[atom.name] = atom.name;
        return acc;
      }, {});
    } else if (typeof labels === "string") {
      _labels = this._system.current_frame.atoms.reduce((acc: Record<string, string>, atom) => {
        acc[atom.name] = atom.get(labels) as string;
        return acc;
      }, {});
    } else if (Array.isArray(labels)) {
      _labels = this._system.current_frame.atoms.reduce((acc: Record<string, string>, atom, idx) => {
        acc[atom.name] = labels[idx];
        return acc;
      }, {});
    } else {
      throw new Error("Invalid labels");
    }

    this._world.artist.label_atom(_labels);
  };

  public exec_cmd = (request: JsonRpcRequest, buffers: DataView[]) => {

    const { jsonrpc, method, params, id } = request;
    logger.info(`exec_cmd: ${method}`);

    if (jsonrpc !== "2.0") {
      return this.createErrorResponse(id, -32600, "Invalid JSON-RPC version");
    }

    try {
      const { context, methodName } = this.parseMethod(method);
      const func = this.getMethodFunction(context, methodName);
      const result = func(...Object.values(params || {}));
      return this.createSuccessResponse(id, result);
    } catch (error: any) {
      logger.error(`error: ${error.message} from ${method}`);
      return this.createErrorResponse(id, -32603, error.message, error.stack);
    }
  };

  // Helper function to parse and retrieve context and method name
  private parseMethod(method: string) {
    const parts = method.split(".");
    const methodName = parts.pop();
    if (!methodName) throw new Error("Invalid method format");

    const context = parts.reduce(
      (acc, part) => acc && (acc as any)?.[part],
      this
    );
    return { context, methodName };
  }

  // Helper function to retrieve the method function from the context
  private getMethodFunction(context: any, methodName: string) {
    if (!context || typeof context[methodName] !== "function") {
      throw new Error(`Method ${methodName} not found or is not a function`);
    }
    return context[methodName].bind(context);
  }

  // Helper function to create success response
  private createSuccessResponse(id: any, result: any) {
    return {
      jsonrpc: "2.0",
      result,
      id: id || null,
    };
  }

  // Helper function to create error response
  private createErrorResponse(
    id: any,
    code: number,
    message: string,
    data?: any
  ) {
    return {
      jsonrpc: "2.0",
      error: { code, message, data },
      id: id || null,
    };
  }
}

export { Molvis };
