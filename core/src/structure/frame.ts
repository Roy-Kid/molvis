import { Block } from './base';


class AtomBlock extends Block {

  constructor(x: number[], y: number[], z: number[], element?: string[]) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
    if (element !== undefined) this.set('element', { kind: 'utf8', data: element });
  }

  get x(): Float32Array {
    return this.get<Float32Array>('x');
  }

  set x(v: number[] | Float32Array) {
    this.set('x', { kind: 'float32', data: v instanceof Float32Array ? v : new Float32Array(v) });
  }

  get y(): Float32Array {
    return this.get<Float32Array>('y');
  }

  set y(v: number[] | Float32Array) {
    this.set('y', { kind: 'float32', data: v instanceof Float32Array ? v : new Float32Array(v) });
  }

  get z(): Float32Array {
    return this.get<Float32Array>('z');
  }

  set z(v: number[] | Float32Array) {
    this.set('z', { kind: 'float32', data: v instanceof Float32Array ? v : new Float32Array(v) });
  }

  get n_atoms(): number {
    return this.nrows;
  }

}

class BondBlock extends Block {

  constructor(i?: number[] | Uint32Array, j?: number[] | Uint32Array, order?: number[] | Uint8Array) {
    super();
    if (i !== undefined) this.i = i;
    if (j !== undefined) this.j = j;
    if (order !== undefined) this.set('order', { kind: 'uint8', data: order instanceof Uint8Array ? order : new Uint8Array(order) });
  }

  get i(): Uint32Array {
    return this.get<Uint32Array>('i');
  }
  
  set i(v: number[] | Uint32Array) {
    this.set('i', { kind: 'uint32', data: v instanceof Uint32Array ? v : new Uint32Array(v) });
  }
  get j(): Uint32Array {
    return this.get<Uint32Array>('j');
  }
  
  set j(v: number[] | Uint32Array) {
    this.set('j', { kind: 'uint32', data: v instanceof Uint32Array ? v : new Uint32Array(v) });
  }

  get n_bonds(): number {
    return this.nrows;
  }

}

class Frame {

  private atoms: AtomBlock;
  private bonds: BondBlock | undefined;

  constructor(atoms: AtomBlock, bonds?: BondBlock) {
    this.atoms = atoms;
    this.bonds = bonds;
  }

  get atomBlock(): AtomBlock {
    return this.atoms;
  }

  get bondBlock(): BondBlock | undefined {
    return this.bonds;
  }

}

export { Frame, AtomBlock, BondBlock };
