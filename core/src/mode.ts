import { World } from './world';
import { System } from './system';

enum ModeType {
    Edit = "edit",
    View = "view"
}

interface Mode {

    name: ModeType;

    get type(): ModeType;

}

class EditMode implements Mode {

    name: ModeType = ModeType.Edit;

    private _world: World;
    private _system: System;

    constructor(world: World, system: System) {
        this._world = world;
        this._system = system;
    }

    public add_atom(x:number, y:number, z:number, props: Map<string, any>) {
        const atom = this._system.current_frame.add_atom(x, y, z, props);
        this._world.artist.draw_atom(atom);
    }

    public get type(): ModeType {
        return this.name;
    }

}

class ViewMode implements Mode {

    name: ModeType = ModeType.View;

    private _world: World;
    private _system: System;

    constructor(world: World, system: System) {
        this._world = world;
        this._system = system;
    }

    public get type(): ModeType {
        return this.name;
    }

}

export { EditMode, ViewMode };
export { type Mode }; 