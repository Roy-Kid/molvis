import { World } from './world';
import { System } from './system';
import { EditMode, Mode, ViewMode } from './mode';

class Molvis {

    private _world: World;
    private _system: System;
    private _mode: Mode;

    constructor(canvas: HTMLCanvasElement) {
        this._world = new World(canvas);
        this._system = new System();
        this._mode = new EditMode(this._world, this._system);
    }

    get world(): World {
        return this._world;
    }

    get system(): System {
        return this._system;
    }

    get editor(): Mode {
        if (this._mode.type == 'edit') {
            return this._mode;
        } else {
            throw new Error("Editor is not in edit mode");
        }
    }

    get viewer(): Mode {
        if (this._mode.type == 'view') {
            return this._mode;
        } else {
            throw new Error("Editor is not in view mode");
        }
    }

    public start() {
        this._world.render();
    }

}

export { Molvis };