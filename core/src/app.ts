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
        this._mode = this.switch_mode('edit');
    }

    get world(): World {
        return this._world;
    }

    get system(): System {
        return this._system;
    }

    public switch_mode(mode: string): Mode {
        switch (mode) {
            case 'edit':
                this._mode = new EditMode(this);
                break;
            case 'view':
                this._mode = new ViewMode(this);
                break;
            default:
                throw new Error("Invalid mode");
        }
        return this._mode;
    }

    public add_atom(x: number, y: number, z: number, props: Map<string, any>) {
        const atom = this._system.current_frame.add_atom(x, y, z, props);
        this._world.artist.draw_atom(atom);
    }   

    public start() {
        this._world.render();
    }

}

export { Molvis };