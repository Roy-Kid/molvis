import { Block, Frame } from "@molcrafts/molvis-core/molrs";
import { normalizeSketchColor } from "./style/custom_color";
import type { Atom2D, Bond2D, MoleculeData } from "./types";

function cloneAtom(a: Atom2D): Atom2D {
  return {
    element: a.element,
    x: a.x,
    y: a.y,
    ...(a.charge !== undefined ? { charge: a.charge } : {}),
    ...(a.color !== undefined ? { color: a.color } : {}),
  };
}

function cloneBond(b: Bond2D): Bond2D {
  return {
    i: b.i,
    j: b.j,
    order: b.order,
    ...(b.stereo !== undefined ? { stereo: b.stereo } : {}),
    ...(b.color !== undefined ? { color: b.color } : {}),
  };
}

type BondBlock = {
  copyColU32: (name: string) => Uint32Array | undefined;
  copyColF: (name: string) => Float32Array | Float64Array | undefined;
};

function readU32Col(block: BondBlock, name: string): number[] | null {
  try {
    const col = block.copyColU32(name);
    return col ? Array.from(col) : null;
  } catch {
    return null;
  }
}

/**
 * Bond order is F for generate3D; accept legacy u32 columns too.
 * Sketch topology only stores integer orders 1–3 (round aromatic 1.5 → 2).
 */
function readBondOrders(block: BondBlock): number[] {
  try {
    const f = block.copyColF("order");
    if (f && f.length > 0) {
      return Array.from(f, (v) => {
        const n = Math.round(Number(v));
        if (n < 1) return 1;
        if (n > 3) return 3;
        return n;
      });
    }
  } catch {
    /* fall through */
  }
  try {
    const u = block.copyColU32("order");
    if (u && u.length > 0) {
      return Array.from(u, (v) => {
        const n = Number(v);
        if (n < 1) return 1;
        if (n > 3) return 3;
        return n;
      });
    }
  } catch {
    /* fall through */
  }
  return [];
}

/**
 * 2D molecular graph: topology + document-Å coordinates.
 *
 * Frame IO for the generate3D path: atoms.element (str);
 * bonds.atomi/atomj (u32), order (**F** — molrs generate3D reads bond order
 * as float; a u32 column is read as 0 and saturates valences to alkanes).
 * Delete-atom policy: remove incident bonds and re-map surviving bond endpoints
 * to the post-deletion index space.
 */
export class MoleculeGraph {
  private atoms: Atom2D[] = [];
  private bonds: Bond2D[] = [];

  loadMoleculeData(data: MoleculeData): void {
    const atoms = data.atoms.map(cloneAtom);
    const bonds = data.bonds.map(cloneBond);
    this.validateData(atoms, bonds);
    // Commit only after the whole candidate validates. A rejected import must
    // never leave a half-loaded graph behind.
    this.atoms = atoms;
    this.bonds = bonds;
  }

  /**
   * Deep copy of current graph data. Mutating the return value does not affect the graph.
   */
  getMoleculeData(): MoleculeData {
    return {
      atoms: this.atoms.map(cloneAtom),
      bonds: this.bonds.map(cloneBond),
    };
  }

  atomCount(): number {
    return this.atoms.length;
  }

  bondCount(): number {
    return this.bonds.length;
  }

  /**
   * Export molrs Frame for generate3D.
   * Columns: atoms.element (str); bonds.atomi, atomj (u32), order (F).
   * Does not write x/y (generate3D embeds coordinates).
   */
  toFrame(): Frame {
    const frame = new Frame();
    const atomBlock = new Block();
    atomBlock.setColStr(
      "element",
      this.atoms.map((a) => a.element),
    );
    frame.insertBlock("atoms", atomBlock);

    if (this.bonds.length > 0) {
      const bondBlock = new Block();
      bondBlock.setColU32("atomi", new Uint32Array(this.bonds.map((b) => b.i)));
      bondBlock.setColU32("atomj", new Uint32Array(this.bonds.map((b) => b.j)));
      // Must be F: u32 order is mis-read as 0 → every carbon gets full H
      // saturation (benzene Kekulé becomes cyclohexane).
      bondBlock.setColF(
        "order",
        new Float64Array(this.bonds.map((b) => b.order)),
      );
      frame.insertBlock("bonds", bondBlock);
    }
    return frame;
  }

  /**
   * Import topology from Frame. Missing 2D coords → linear placement along x
   * at spacing 1.4 (document-Å), y = 0.
   */
  fromFrame(frame: Frame): void {
    const atomBlock = frame.getBlock("atoms");
    if (!atomBlock || atomBlock.nrows() === 0) {
      this.atoms = [];
      this.bonds = [];
      return;
    }
    const elements = atomBlock.copyColStr("element") as string[];
    const n = elements.length;
    const atoms = elements.map((element, idx) => ({
      element: element || "C",
      x: idx * 1.4,
      y: 0,
    }));

    const bonds: Bond2D[] = [];
    const bondBlock = frame.getBlock("bonds");
    if (bondBlock && bondBlock.nrows() > 0) {
      const atomi =
        readU32Col(bondBlock, "atomi") ?? readU32Col(bondBlock, "i") ?? [];
      const atomj =
        readU32Col(bondBlock, "atomj") ?? readU32Col(bondBlock, "j") ?? [];
      const orders = readBondOrders(bondBlock);
      const m = bondBlock.nrows();
      for (let k = 0; k < m; k++) {
        const i = atomi[k] ?? 0;
        const j = atomj[k] ?? 0;
        if (i >= n || j >= n) {
          throw new Error(
            `fromFrame: bond endpoint out of range (${i}, ${j}) for ${n} atoms`,
          );
        }
        bonds.push({
          i,
          j,
          order: orders[k] ?? 1,
        });
      }
    }
    this.loadMoleculeData({ atoms, bonds });
  }

  /** Internal: add atom; returns new index. */
  addAtomInternal(atom: Atom2D): number {
    this.validateAtom(atom, this.atoms.length);
    this.atoms.push(cloneAtom(atom));
    return this.atoms.length - 1;
  }

  /** Internal: remove atom at index; remap bonds. */
  removeAtomInternal(index: number): Atom2D {
    if (index < 0 || index >= this.atoms.length) {
      throw new Error(`removeAtom: index ${index} out of range`);
    }
    const [removed] = this.atoms.splice(index, 1);
    this.bonds = this.bonds
      .filter((b) => b.i !== index && b.j !== index)
      .map((b) => ({
        ...b,
        i: b.i > index ? b.i - 1 : b.i,
        j: b.j > index ? b.j - 1 : b.j,
      }));
    return removed;
  }

  addBondInternal(bond: Bond2D): number {
    this.validateBond(bond, this.atoms.length, this.bonds);
    this.bonds.push(cloneBond(bond));
    return this.bonds.length - 1;
  }

  removeBondInternal(index: number): Bond2D {
    if (index < 0 || index >= this.bonds.length) {
      throw new Error(`removeBond: index ${index} out of range`);
    }
    const [removed] = this.bonds.splice(index, 1);
    return removed;
  }

  getAtom(index: number): Atom2D {
    const a = this.atoms[index];
    if (!a) throw new Error(`getAtom: index ${index} out of range`);
    return cloneAtom(a);
  }

  getBond(index: number): Bond2D {
    const b = this.bonds[index];
    if (!b) throw new Error(`getBond: index ${index} out of range`);
    return cloneBond(b);
  }

  setAtomInternal(index: number, atom: Atom2D): void {
    if (index < 0 || index >= this.atoms.length) {
      throw new Error(`setAtom: index ${index} out of range`);
    }
    this.validateAtom(atom, index);
    this.atoms[index] = cloneAtom(atom);
  }

  setBondInternal(index: number, bond: Bond2D): void {
    if (index < 0 || index >= this.bonds.length) {
      throw new Error(`setBond: index ${index} out of range`);
    }
    this.validateBond(
      bond,
      this.atoms.length,
      this.bonds.filter((_, bondIndex) => bondIndex !== index),
    );
    this.bonds[index] = cloneBond(bond);
  }

  /** Return the index of an undirected bond, or null when no bond exists. */
  findBondIndex(i: number, j: number): number | null {
    this.assertBondEndpoint(i, this.atoms.length);
    this.assertBondEndpoint(j, this.atoms.length);
    const index = this.bonds.findIndex(
      (bond) =>
        (bond.i === i && bond.j === j) || (bond.i === j && bond.j === i),
    );
    return index >= 0 ? index : null;
  }

  /** Replace entire graph (used by clear/snapshot commands). */
  replaceAll(data: MoleculeData): void {
    this.loadMoleculeData(data);
  }

  private validateData(atoms: Atom2D[], bonds: Bond2D[]): void {
    for (let index = 0; index < atoms.length; index++) {
      this.validateAtom(atoms[index], index);
    }

    const accepted: Bond2D[] = [];
    for (const bond of bonds) {
      this.validateBond(bond, atoms.length, accepted);
      accepted.push(bond);
    }
  }

  private validateAtom(atom: Atom2D, index: number): void {
    if (typeof atom.element !== "string" || atom.element.trim().length === 0) {
      throw new Error(`atom ${index}: element must be a non-empty string`);
    }
    if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y)) {
      throw new Error(`atom ${index}: coordinates must be finite`);
    }
    if (atom.charge !== undefined && !Number.isInteger(atom.charge)) {
      throw new Error(`atom ${index}: charge must be an integer`);
    }
    this.validateColor(atom.color, `atom ${index}`);
  }

  private validateBond(
    bond: Bond2D,
    atomCount: number,
    existing: readonly Bond2D[],
  ): void {
    this.assertBondEndpoint(bond.i, atomCount);
    this.assertBondEndpoint(bond.j, atomCount);
    if (bond.i === bond.j) {
      throw new Error("bond endpoints must be distinct");
    }
    if (!Number.isInteger(bond.order) || bond.order < 1 || bond.order > 3) {
      throw new Error(`bond order must be 1, 2, or 3; got ${bond.order}`);
    }
    if (
      bond.stereo !== undefined &&
      bond.stereo !== "none" &&
      bond.stereo !== "up" &&
      bond.stereo !== "down"
    ) {
      throw new Error(`invalid bond stereo: ${String(bond.stereo)}`);
    }
    if (
      bond.order !== 1 &&
      bond.stereo !== undefined &&
      bond.stereo !== "none"
    ) {
      throw new Error("stereo is only valid on single bonds");
    }
    if (
      existing.some(
        (candidate) =>
          (candidate.i === bond.i && candidate.j === bond.j) ||
          (candidate.i === bond.j && candidate.j === bond.i),
      )
    ) {
      throw new Error(`duplicate bond between ${bond.i} and ${bond.j}`);
    }
    this.validateColor(bond.color, `bond ${bond.i}-${bond.j}`);
  }

  private validateColor(color: string | undefined, owner: string): void {
    if (color === undefined) return;
    try {
      normalizeSketchColor(color);
    } catch {
      throw new Error(`${owner}: invalid color ${color}`);
    }
  }

  private assertBondEndpoint(i: number, atomCount: number): void {
    if (!Number.isInteger(i) || i < 0 || i >= atomCount) {
      throw new Error(`bond endpoint ${i} out of range (n=${atomCount})`);
    }
  }
}
