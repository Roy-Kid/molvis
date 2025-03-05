import { Logger } from "tslog";
import { Frame, System } from "./system";
import { World } from "./world";
import { Atom } from "./system";
import { Vector3 } from "@babylonjs/core";
import { Mode, ViewMode, SelectMode, EditMode } from "./mode";
import { KeyboardEventTypes } from "@babylonjs/core";

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
  private _canvas: HTMLCanvasElement;
  private _mode: Mode;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._world = new World(canvas);
    this._system = new System();
    this._mode = this.init_mode(this._world, this._system);
  }

  private init_mode = (world: World, system: System) => {
    world.scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "1":
              logger.info("view mode");
              this.switch_mode("view");
              break;
            case "2":
              logger.info("select mode");
              this.switch_mode("select");
              break;
              case "e":
              logger.info("edit mode");
              this.switch_mode("edit");
              break;
            // case "4":
            //   this._mode = this.switch_mode("manupulate");
          }
          break;
      }
    });
    return new ViewMode(this);
  };

  public switch_mode = (mode_key: string) => {
    this._mode.finish();
    switch (mode_key) {
      case "edit":
        this._mode = new EditMode(this);
        break;
      case "view":
        this._mode = new ViewMode(this);
        break;
      case "select":
        this._mode = new SelectMode(this);
        break;
      // case "manupulate":
      //   _mode = new ManupulateMode(this);
      //   break;
      default:
        throw new Error("Invalid mode");
    }
  };

  get world(): World {
    return this._world;
  }

  get system(): System {
    return this._system;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  public render = () => {
    this._world.render();
  };

  public stop = () => {
    this._world.stop();
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
    {x, y, z, name, element, bond_i, bond_j}: {x: Float64Array, y: Float64Array, z: Float64Array, name: Array<string>, element: Array<string>, bond_i: Array<number>, bond_j: Array<number>}
  ) => {
    logger.info(`bond_i: ${bond_i}`);
    logger.info(`bond_j: ${bond_j}`);
    const n_atoms = x.length;
    // const n_bonds = bonds.i.length;
    const atom_list = [];
    for (let i = 0; i < n_atoms; i++) {
      const atom = new Map();
      atom.set("name", name[i]);
      atom.set("element", element[i]);
      atom.set("x", x[i]);
      atom.set("y", y[i]);
      atom.set("z", z[i]);
      atom_list.push(this.draw_atom(atom));
    }
    if (bond_i && bond_j) {
      const n_bonds = bond_i.length;
      for (let i = 0; i < n_bonds; i++) {
        const itom = atom_list[bond_i[i]];
        const jtom = atom_list[bond_j[i]];
        this.draw_bond(itom, jtom);
      }
    }
    const ramdom_atom = this._system.current_frame.atoms[0];
    const { _x, _y, _z } = ramdom_atom.xyz;
    this.cameraLookAt(_x, _y, _z);
    return this._system.current_frame;
  };

  public select_frame = (idx: number) => {
    this._system.current_frame_index = idx;
    const frame = this._system.current_frame;
    this._world.artist.draw_frame(frame);
  };

  public append_frame = (frame: Frame) => {
    this._system.append_frame(frame);
    this._world.artist.draw_frame(frame);
    this._world.update_frame_indicator(this._system.current_frame_index, this._system.n_frames);
  }

  public cameraLookAt = (x: number, y: number, z: number) => {
    this._world.camera.target = new Vector3(x, y, z);
  };

  public label_atom = (labels: string | string[] | undefined = undefined) => {

    let _labels: Map<string, string>;

    if (labels === undefined) {
      _labels = this._system.current_frame.atoms.reduce<Map<string, string>>((acc, atom) => {
        acc.set(atom.name, atom.name);
        return acc;
      }, new Map());
    } else if (typeof labels === "string") {
      _labels = this._system.current_frame.atoms.reduce<Map<string, string>>((acc, atom) => {
        acc.set(atom.name, atom.get(labels) as string);
        return acc;
      }, new Map());
    } else if (Array.isArray(labels)) {
      _labels = this._system.current_frame.atoms.reduce((acc, atom, idx) => {
        acc.set(atom.name, labels[idx]);
        return acc;
      }, new Map());
    } else {
      throw new Error("Invalid labels");
    }
    this._world.artist.label_atom(_labels);
  };

 
}

export { Molvis };
