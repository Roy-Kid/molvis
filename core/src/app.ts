import { Vector3 } from "@babylonjs/core";
import { KeyboardEventTypes } from "@babylonjs/core";
import { Engine, Scene } from "@babylonjs/core";
import { Logger } from "tslog";
import { GuiManager } from "./gui";
import { EditMode, type Mode, SelectMode, ViewMode } from "./mode";
import type { Frame } from "./system";
import { System } from "./system";
import type { Atom, ItemProp } from "./system";
import { World } from "./world";

const logger = new Logger({ name: "molvis-core" });

class Molvis {
  private _scene: Scene;
  private _engine: Engine;
  private _world: World;
  private _system: System;
  private _canvas: HTMLCanvasElement;
  private _mode: Mode;
  private _guiManager: GuiManager;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._system = new System();
    this._engine = new Engine(canvas, true);
    this._scene = this._initScene(this._engine);

    this._world = new World(this._engine, this._scene);
    this._guiManager = new GuiManager(this._world, this._system, {
      useFrameIndicator: true,
    });
    this._mode = this.init_mode(this._world);
  }

  private _initScene = (engine: Engine) => {
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    return scene;
  };

  private init_mode = (world: World) => {
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
            case "3":
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

  get mode(): Mode {
    return this._mode;
  }

  get guiManager(): GuiManager {
    return this._guiManager;
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

  public draw_atom = (data: Map<string, ItemProp>) => {
    const atom = this._system.current_frame.add_atom(data);
    this._world.artist.draw_atom(atom);
    return atom;
  };

  public draw_bond = (
    itom: Atom,
    jtom: Atom,
    props: Map<string, ItemProp> = new Map(),
  ) => {
    const bond = this._system.current_frame.add_bond(itom, jtom, props);
    this._world.artist.draw_bond(bond);
    return bond;
  };

  public draw_frame = ({
    x,
    y,
    z,
    name,
    element,
    bond_i,
    bond_j,
  }: {
    x: Float64Array;
    y: Float64Array;
    z: Float64Array;
    name?: Array<string>;
    element?: Array<string>;
    bond_i?: Array<number>;
    bond_j?: Array<number>;
  }): Frame => {
    const n_atoms = x.length;
    // const n_bonds = bonds.i.length;
    const atom_list = [];
    for (let i = 0; i < n_atoms; i++) {
      const atom = new Map();
      atom.set("x", x[i]);
      atom.set("y", y[i]);
      atom.set("z", z[i]);
      atom_list.push(atom);
    }
    if (name) {
      for (let i = 0; i < n_atoms; i++) {
        atom_list[i].set("name", name[i]);
      }
    }
    if (element) {
      for (let i = 0; i < n_atoms; i++) {
        atom_list[i].set("element", element[i]);
      }
    }
    const atom_obj_list = atom_list.map((atom) => {
      return this.draw_atom(atom);
    });
    if (bond_i && bond_j) {
      const n_bonds = bond_i.length;
      for (let i = 0; i < n_bonds; i++) {
        console.log(bond_i[i], bond_j[i]);
        const itom = atom_obj_list[bond_i[i]];
        const jtom = atom_obj_list[bond_j[i]];
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
    this._guiManager.updateFrameIndicator(
      this._system.current_frame_index,
      this._system.n_frames,
    );
  };

  public cameraLookAt = (x: number, y: number, z: number) => {
    this._world.camera.target = new Vector3(x, y, z);
  };

  public label_atom = (labels: string | string[] | undefined = undefined) => {
    let _labels: Map<string, string>;
    if (labels === undefined) {
      _labels = this._system.current_frame.atoms.reduce<Map<string, string>>(
        (acc, atom) => {
          acc.set(atom.name, atom.name);
          return acc;
        },
        new Map(),
      );
    } else if (typeof labels === "string") {
      _labels = this._system.current_frame.atoms.reduce<Map<string, string>>(
        (acc, atom) => {
          acc.set(atom.name, atom.get(labels) as string);
          return acc;
        },
        new Map(),
      );
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
