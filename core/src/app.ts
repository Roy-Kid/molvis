import { Logger } from "tslog";
import { Mode } from "./mode";
import { System } from "./system";
import { World } from "./world";
import { Executor } from "./command";
import { GuiManager } from "./gui";

const logger = new Logger({ name: "molvis-core" });

class Molvis {

  private _world: World;
  private _system: System;
  private _mode: Mode;
  public executor: Executor;
  private _gui: GuiManager;

  constructor(canvas: HTMLCanvasElement) {

    this._system = new System();
    this._world = new World(canvas);
    this._gui = new GuiManager(this._system, this._world);
    this._mode = new Mode(this._system, this._world, this._gui);
    this.executor = new Executor(this._system, this._world);
  }

  public execute(cmd: string, args: {}) {
    this.executor.execute(cmd, args);
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

}

export { Molvis };
