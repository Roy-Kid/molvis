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
    props: Map<string, any> = new Map()
  ) => {
    const atom = this._system.current_frame.add_atom(id, x, y, z, props);
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
    atoms: {
      id: number[];
      x: number[];
      y: number[];
      z: number[];
      props: object;
    },
    bonds: {
      i: number[];
      j: number[];
    }
  ) => {
    const n_atoms = atoms.id.length;
    const n_bonds = bonds.i.length;

    for (let i = 0; i < n_atoms; i++) {
      const id = atoms.id[i];
      const x = atoms.x[i];
      const y = atoms.y[i];
      const z = atoms.z[i];
      const prop = new Map<string, any>();
      for (const [key, value] of Object.entries(atoms.props)) {
        prop.set(key, value[i]);
      }
      this.draw_atom(id, x, y, z, prop);
    }
    const id_atom_map = this._system.current_frame.atoms.reduce((acc, atom) => {
      acc.set(atom.id, atom);
      return acc;
    }, new Map<number, Atom>());
    for (let i = 0; i < n_bonds; i++) {
      const itom = id_atom_map.get(bonds.i[i]);
      const jtom = id_atom_map.get(bonds.j[i]);
      this.draw_bond(itom!, jtom!);
    }
    logger.info(`Frame drawn with ${n_atoms} atoms and ${n_bonds} bonds`);
    return this._system.current_frame;
  };

  public select_frame = (idx: number) => {
    this._system.current_frame_index = idx;
    const frame = this._system.current_frame;
    this._world.artist.draw_frame(frame);
  };

  public exec_cmd = (request: JsonRpcRequest, buffers: DataView[]) => {
    const { jsonrpc, method, params, id } = request;
    logger.info(`Received request: ${method}`);
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
