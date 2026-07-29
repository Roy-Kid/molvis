import { Block, Frame } from "@molcrafts/molrs";
import type { Atom2D, Bond2D, MoleculeData } from "./types";

function cloneAtom(a: Atom2D): Atom2D {
  return {
    element: a.element,
    x: a.x,
    y: a.y,
    ...(a.charge !== undefined ? { charge: a.charge } : {}),
  };
}

function cloneBond(b: Bond2D): Bond2D {
  return {
    i: b.i,
    j: b.j,
    order: b.order,
    ...(b.stereo !== undefined ? { stereo: b.stereo } : {}),
  };
}

/**
 * 2D molecular graph: topology + document-Å coordinates.
 *
 * Frame IO matches BuilderTab columns: atoms.element, bonds.atomi/atomj/order.
 * Delete-atom policy: remove incident bonds and re-map surviving bond endpoints
 * to the post-deletion index space.
 */
export class MoleculeGraph {
  private atoms: Atom2D[] = [];
  private bonds: Bond2D[] = [];

  loadMoleculeData(data: MoleculeData): void {
    this.atoms = data.atoms.map(cloneAtom);
    this.bonds = data.bonds.map(cloneBond);
    this.assertBondIndices();
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
   * Export molrs Frame for generate3D path.
   * Columns: atoms.element (str); bonds.atomi, atomj, order (u32).
   * Does not write x/y (matches BuilderTab).
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
      bondBlock.setColU32(
        "atomi",
        new Uint32Array(this.bonds.map((b) => b.i)),
      );
      bondBlock.setColU32(
        "atomj",
        new Uint32Array(this.bonds.map((b) => b.j)),
      );
      bondBlock.setColU32(
        "order",
        new Uint32Array(this.bonds.map((b) => b.order)),
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
    this.atoms = elements.map((element, idx) => ({
      element: element || "C",
      x: idx * 1.4,
      y: 0,
    }));

    this.bonds = [];
    const bondBlock = frame.getBlock("bonds");
    if (bondBlock && bondBlock.nrows() > 0) {
      const atomi = bondBlock.copyColU32("atomi");
      const atomj = bondBlock.copyColU32("atomj");
      const order = bondBlock.copyColU32("order");
      const m = bondBlock.nrows();
      for (let k = 0; k < m; k++) {
        const i = atomi[k] ?? 0;
        const j = atomj[k] ?? 0;
        if (i >= n || j >= n) {
          throw new Error(
            `fromFrame: bond endpoint out of range (${i}, ${j}) for ${n} atoms`,
          );
        }
        this.bonds.push({
          i,
          j,
          order: order[k] ?? 1,
        });
      }
    }
  }

  /** Internal: add atom; returns new index. */
  addAtomInternal(atom: Atom2D): number {
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
    this.assertBondEndpoint(bond.i);
    this.assertBondEndpoint(bond.j);
    if (bond.i === bond.j) {
      throw new Error("addBond: self-bond not allowed");
    }
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
    this.atoms[index] = cloneAtom(atom);
  }

  setBondInternal(index: number, bond: Bond2D): void {
    if (index < 0 || index >= this.bonds.length) {
      throw new Error(`setBond: index ${index} out of range`);
    }
    this.assertBondEndpoint(bond.i);
    this.assertBondEndpoint(bond.j);
    this.bonds[index] = cloneBond(bond);
  }

  /** Replace entire graph (used by clear/snapshot commands). */
  replaceAll(data: MoleculeData): void {
    this.loadMoleculeData(data);
  }

  private assertBondEndpoint(i: number): void {
    if (i < 0 || i >= this.atoms.length) {
      throw new Error(`bond endpoint ${i} out of range (n=${this.atoms.length})`);
    }
  }

  private assertBondIndices(): void {
    for (const b of this.bonds) {
      this.assertBondEndpoint(b.i);
      this.assertBondEndpoint(b.j);
    }
  }
}
