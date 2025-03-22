import { Vector3 } from "@babylonjs/core";

class Trajectory {
  private _frames: Frame[] = [];
  private _currentIndex = 0;

  addFrame(frame: Frame) {
    this._frames.push(frame);
  }

  get currentFrame(): Frame {
    if (this._frames.length === 0) {
      this.addFrame(new Frame());
    }
    return this._frames[this._currentIndex];
  }

  get frames(): Frame[] {
    return this._frames;
  }

  getFrame(idx: number): Frame {
    return this._frames[idx];
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  set currentIndex(idx: number) {
    this._currentIndex = idx;
  }

  nextFrame() {
    this._currentIndex = Math.min(
      this._currentIndex + 1,
      this._frames.length - 1,
    );
    return this.currentFrame;
  }

  prevFrame() {
    this._currentIndex = Math.max(this._currentIndex - 1, 0);
    return this.currentFrame;
  }
}

class System {
  private _selected: Atom[];
  private _trajectory: Trajectory;

  constructor() {
    this._trajectory = new Trajectory();
    this._selected = [];
  }

  public get trajectory() {
    return this._trajectory;
  }

  public get current_frame() {
    return this._trajectory.currentFrame;
  }

  public set current_frame_index(idx: number) {
    this._trajectory.currentIndex = idx;
  }

  public getFrame(idx: number): Frame | undefined {
    return this._trajectory.getFrame(idx);
  }

  public set_frame(idx: number) {
    this._trajectory.currentIndex = idx;
  }

  public next_frame() {
    return this._trajectory.nextFrame();
  }

  public prev_frame() {
    return this._trajectory.prevFrame();
  }

  static random_atom_id(): string {
    const randomNum = Math.floor(Math.random() * 0x10000);

    const hexID = randomNum.toString(16).padStart(4, "0");

    return hexID;
  }

  public select_atom(atom: Atom) {
    this._selected.push(atom);
  }

  public append_frame(frame: Frame) {
    this._trajectory.addFrame(frame);
  }

  get n_frames(): number {
    return this._trajectory.frames.length;
  }

}

class Frame {
  private _atoms: Atom[];
  private _bonds: Bond[];
  private _props: Map<string, ItemProp>;

  constructor() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }

  public add_atom(name: string, xyz: Vector3, element=""): Atom {
    const atom = new Atom();
    atom.set("name", name);
    atom.set("xyz", xyz);
    atom.set("element", element);
    this._atoms.push(atom);
    return atom;
  }


  // public add_bond = (
  //   itom: Atom,
  //   jtom: Atom,
  //   data: Map<string, ItemProp> = new Map(),
  // ): Bond => {
  //   const bond = new Bond(itom, jtom, data);
  //   this._bonds.push(bond);
  //   return bond;
  // };

  // public get_atom = (fn: (atom: Atom) => boolean): Atom | undefined => {
  //   return this._atoms.find(fn);
  // };

  // public get_bond = (fn: (bond: Bond) => boolean): Bond | undefined => {
  //   return this._bonds.find(fn);
  // };

  // get n_atoms(): number {
  //   return this._atoms.length;
  // }

  // get props(): Map<string, ItemProp> {
  //   return this._props;
  // }

  // get atoms(): Atom[] {
  //   return this._atoms;
  // }

  // get bonds(): Bond[] {
  //   return this._bonds;
  // }

  // set atoms(atoms: Atom[]) {
  //   this._atoms = atoms;
  // }

  // set bonds(bonds: Bond[]) {
  //   this._bonds = bonds;
  // }

  public clear() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }
}

type Prop = number | string | Vector3 | boolean;

class Atom extends Map<string, Prop> {

  get name(): string {
    return this.get("name") as string;
  }

  get element(): string {
    return this.get("element") as string;
  }

  get xyz(): Vector3 {
    return this.get("xyz") as Vector3;
  }
}

class Bond extends Map<string, ItemProp> {
  public itom: Atom;
  public jtom: Atom;

  constructor(itom: Atom, jtom: Atom, props: Map<string, ItemProp> = new Map()) {
    super(props);
    this.itom = itom;
    this.jtom = jtom;
  }

  get name(): string {
    return `${this.itom.name}-${this.jtom.name}`;
  }
}

export { System, Atom, Bond, Frame, Trajectory };
export type { ItemProp };
