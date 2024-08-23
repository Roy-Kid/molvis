
class System{

    private _traj: Frame[];
    private _current_frame_index: number;

    constructor() {
        this._traj = [new Frame()];
        this._current_frame_index = 0;
    }

    public get current_frame(): Frame {
        return this._traj[this._current_frame_index];
    }
}

class Frame{

    private _atoms: Atom[];
    private _bonds: Bond[];

    constructor() {
        this._atoms = [];
        this._bonds = [];
    }

    public add_atom(x: number, y: number, z: number, props: Map<string, any>): Atom {
        const atom = new Atom(x, y, z, props);
        this._atoms.push(atom);
        return atom;
    }
}

class Atom {

    public x: number;
    public y: number;
    public z: number;
    public props: Map<string, any>;

    constructor(x: number, y: number, z: number, props: Map<string, any>) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.props = props;
    }

}

class Bond {

    public itom: Atom;
    public jtom: Atom;
    public props: Map<string, any>;

    constructor(itom: Atom, jtom: Atom, props: Map<string, any>) {
        this.itom = itom;
        this.jtom = jtom;
        this.props = props;
    }
}

export { System, Atom, Bond, Frame };