import type { IProp } from "./base";

class Frame {
  private xs: number[] = [];
  private ys: number[] = [];
  private zs: number[] = [];
  private bi: number[] = [];
  private bj: number[] = [];
  private bmeta: Record<number, Record<string, IProp>> = {};

  constructor() {}

  get n_atoms(): number { return this.xs.length; }
  get n_bonds(): number { return this.bi.length; }

  // Add an atom position (column arrays)
  add_atom(_name: string, x: number, y: number, z: number, _props: Record<string, IProp> = {}): number {
    this.xs.push(x); this.ys.push(y); this.zs.push(z);
    return this.xs.length - 1; // index
  }

  // Add a bond by atom indices
  add_bond(i: number, j: number, props: Record<string, IProp> = {}): number {
    if (i < 0 || j < 0 || i >= this.n_atoms || j >= this.n_atoms) {
      throw new Error('Bond indices out of range');
    }
    this.bi.push(i); this.bj.push(j);
    const idx = this.bi.length - 1;
    this.bmeta[idx] = { ...props };
    return idx;
  }

  remove_atom(index: number) {
    if (index < 0 || index >= this.n_atoms) return;
    this.xs.splice(index, 1);
    this.ys.splice(index, 1);
    this.zs.splice(index, 1);
    // rebuild bonds excluding any that referenced removed index and reindex > index
    const newBi: number[] = [];
    const newBj: number[] = [];
    const newMeta: Record<number, Record<string, IProp>> = {};
    let k = 0;
    for (let b = 0; b < this.bi.length; b++) {
      const ii = this.bi[b];
      const jj = this.bj[b];
      if (ii === index || jj === index) continue; // drop
      newBi.push(ii > index ? ii - 1 : ii);
      newBj.push(jj > index ? jj - 1 : jj);
      newMeta[k] = this.bmeta[b];
      k++;
    }
    this.bi = newBi; this.bj = newBj; this.bmeta = newMeta;
  }

  clear() {
    this.xs = []; this.ys = []; this.zs = [];
    this.bi = []; this.bj = []; this.bmeta = {};
  }

  // Accessors for rendering/compute
  get X(): ReadonlyArray<number> { return this.xs; }
  get Y(): ReadonlyArray<number> { return this.ys; }
  get Z(): ReadonlyArray<number> { return this.zs; }
  get BI(): ReadonlyArray<number> { return this.bi; }
  get BJ(): ReadonlyArray<number> { return this.bj; }
  getBondProps(index: number): Record<string, IProp> | undefined { return this.bmeta[index]; }
}

export { Frame };
