import { Logger } from "tslog";
import { Mode } from "./mode";
import { System, Atom } from "./system";
import { World } from "./world";
import { Executor } from "./command";
import { GuiManager } from "./gui";
import { MeshBuilder } from "@babylonjs/core";
// import { ArtistGuild } from "./artist";
const logger = new Logger({ name: "molvis-core" });

class Molvis {

  private _world: World;
  private _system: System;
  private _mode: Mode;
  private _executor: Executor;
  private _gui: GuiManager;
  // private _artist: ArtistGuild;

  constructor(canvas: HTMLCanvasElement) {
    this._system = new System();
    this._world = new World(canvas);
    this._gui = new GuiManager(this);
    this._mode = new Mode(this);
    // this._artist = new ArtistGuild(this);
    this._executor = new Executor(this);
    logger.info("Molvis initialized");
  }

  get world(): World {
    return this._world;
  }

  get system(): System {
    return this._system;
  }

  get scene() {
    return this._world.scene;
  }

  // get artist(): ArtistGuild {
  //   return this._artist;
  // }

  get mode(): Mode {
    return this._mode;
  }

  get executor(): Executor {
    return this._executor;
  }

  get gui(): GuiManager {
    return this._gui;
  }

  public execute(cmd: string, args: {}) {
    const [meshes, entities] = this._executor.execute(cmd, args);
    this._world.pipeline.modify(
      this,
      meshes,
      entities
    )
  }

  public modify(name: string, args: {}) {
    this._world.append_modifier(name, args);
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

  public finalize = () => { };
  public draw_atom(data: Map<string, any>) {
    const x = Number(data.get("x"));
    const y = Number(data.get("y"));
    const z = Number(data.get("z"));
    const name = data.get("name") as string;
    const props = Object.fromEntries(data);
    const [, entities] = this._executor.execute("draw_atom", { x, y, z, name, ...props });
    return entities[0] as Atom;
  }

  public draw_bond(itom: Atom, jtom: Atom) {
    const bond = this._system.add_bond(itom, jtom);
    const path = [itom.xyz, jtom.xyz];
    MeshBuilder.CreateTube(`bond:${bond.name}`, { path, radius: 0.1 }, this.scene);
    return bond;
  }

  public remove_atom(atom: Atom) {
    this._system.remove_atom(atom);
    const mesh = this.scene.getMeshByName(`atom:${atom.name}`);
    if (mesh) mesh.dispose();
    const bonds = this.scene.meshes.filter(m => m.name.startsWith("bond:") && m.name.includes(atom.name));
    for (const b of bonds) {
      b.dispose();
    }
  }

}

export { Molvis };

