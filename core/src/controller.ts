import { World } from "./world";
import { System } from "./system";
import { Logger } from "tslog";
import { Atom, Bond } from "./system";

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: object;
  id: number | null;
}

const logger = new Logger({ name: "molvis-core" });

export class Controller {
  private _world: World;
  private _system: System;

  constructor(world: World, system: System) {
    this._world = world;
    this._system = system;
  }

  public draw_atom = (
    id: number,
    x: number,
    y: number,
    z: number,
    props: object
  ) => {
    logger.info(`Draw atom ${id} at (${x}, ${y}, ${z}) with ${props}`);
    const atom = this._system.current_frame.add_atom(id, x, y, z, props);
    this._world.artist.draw_atom(atom);
    return atom;
  };

  public draw_bond = (itom: Atom, jtom: Atom, props: object = {}) => {
    const bond = this._system.current_frame.add_bond(itom, jtom, props);
    this._world.artist.draw_bond(bond);
    return bond;
  };

  public draw_frame = (
    atoms: {
      id: number[];
      xyz: number[][];
      props: object;
    },
    bonds: {
      i: number[];
      j: number[];
    }
  ) => {
    for (let i = 0; i < atoms.id.length; i++) {
      const id = atoms.id[i];
      const x = atoms.xyz[i][0];
      const y = atoms.xyz[i][1];
      const z = atoms.xyz[i][2];
      const prop = {};
      for (const [key, values] of Object.entries(atoms.props)) {
        prop[key] = values[i];
      this.draw_atom(id, x, y, z, prop);
      }
    }
    const registed_atoms = this._system.current_frame.atoms;
    for (let i = 0; i < bonds.i.length; i++) {
      const itom = registed_atoms[bonds.i[i]];
      const jtom = registed_atoms[bonds.j[i]];
      this.draw_bond(itom, jtom);
    }
    return this._system.current_frame;
  };

  public select_frame = (idx: number) => {
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
      const parts = method.split(".");
      const methodName = parts.pop();
      if (!methodName) {
        throw new Error("Invalid method format");
      }

      const context = parts.reduce((acc, part) => acc && acc[part], this);
      if (!context || typeof context[methodName] !== "function") {
        throw new Error(`Method ${method} not found or is not a function`);
      }

      const func = context[methodName].bind(context);
      const kwargs = params || {};
      const result = func(...Object.values(kwargs));

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
}
