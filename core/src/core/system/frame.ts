import { Block } from './block';
import { MrFrame, MrBlock } from 'molrs-wasm';
import type { Box } from 'molrs-wasm';


class AtomBlock extends Block {

  constructor(x?: number[] | Float32Array, y?: number[] | Float32Array, z?: number[] | Float32Array, element?: string[]) {
    super();
    if (x !== undefined) this.x = x;
    if (y !== undefined) this.y = y;
    if (z !== undefined) this.z = z;
    if (element !== undefined) this.element = element;
  }

  /** Create AtomBlock from MrBlock */
  static fromMrBlock(mrBlock: MrBlock): AtomBlock {
    const block = new AtomBlock();
    (block as any)._mrBlock = mrBlock;
    return block;
  }

  get x(): Float32Array {
    return this.get_f32('x') ?? new Float32Array(0);
  }

  set x(v: number[] | Float32Array) {
    this.set_f32('x', v);
  }

  get y(): Float32Array {
    return this.get_f32('y') ?? new Float32Array(0);
  }

  set y(v: number[] | Float32Array) {
    this.set_f32('y', v);
  }

  get z(): Float32Array {
    return this.get_f32('z') ?? new Float32Array(0);
  }

  set z(v: number[] | Float32Array) {
    this.set_f32('z', v);
  }

  get n_atoms(): number {
    return this.nrows;
  }

  get element(): string[] {
    return this.get_strings('element') ?? [];
  }

  set element(v: string[]) {
    this.set_strings('element', v);
  }

}

class BondBlock extends Block {

  constructor(i?: number[] | Uint32Array, j?: number[] | Uint32Array, order?: number[] | Uint8Array) {
    super();
    if (i !== undefined) this.i = i;
    if (j !== undefined) this.j = j;
    if (order !== undefined) this.order = order;
  }

  /** Create BondBlock from MrBlock */
  static fromMrBlock(mrBlock: MrBlock): BondBlock {
    const block = new BondBlock();
    (block as any)._mrBlock = mrBlock;
    return block;
  }

  get i(): Uint32Array {
    return this.get_u32('i') ?? new Uint32Array(0);
  }

  set i(v: number[] | Uint32Array) {
    this.set_u32('i', v);
  }

  get j(): Uint32Array {
    return this.get_u32('j') ?? new Uint32Array(0);
  }

  set j(v: number[] | Uint32Array) {
    this.set_u32('j', v);
  }

  get order(): Uint8Array {
    return this.get_u8('order') ?? new Uint8Array(0);
  }

  set order(v: number[] | Uint8Array) {
    this.set_u8('order', v);
  }

  get n_bonds(): number {
    return this.nrows;
  }

}

class Frame {

  /** Internal MrFrame from molrs-wasm */
  public readonly _mrFrame: MrFrame;
  public box: Box | undefined;

  constructor(atoms?: AtomBlock, bonds?: BondBlock, mrFrame?: MrFrame) {
    if (mrFrame) {
      this._mrFrame = mrFrame;
    } else {
      this._mrFrame = new MrFrame();
      if (atoms) {
        this._mrFrame.insert_block('atoms', atoms._mrBlock);
      }
      if (bonds) {
        this._mrFrame.insert_block('bonds', bonds._mrBlock);
      }
    }
    this.box = undefined;
  }

  /** Create Frame from MrFrame */
  static fromMrFrame(mrFrame: MrFrame): Frame {
    return new Frame(undefined, undefined, mrFrame);
  }

  get atoms(): AtomBlock {
    const mrBlock = this._mrFrame.get_block('atoms');
    if (!mrBlock) {
      // Create empty atoms block if not exists
      const emptyBlock = new AtomBlock();
      this._mrFrame.insert_block('atoms', emptyBlock._mrBlock);
      return emptyBlock;
    }
    return AtomBlock.fromMrBlock(mrBlock);
  }

  set atoms(value: AtomBlock) {
    this._mrFrame.insert_block('atoms', value._mrBlock);
  }

  get atomBlock(): AtomBlock {
    return this.atoms;
  }

  get bonds(): BondBlock | undefined {
    const mrBlock = this._mrFrame.get_block('bonds');
    return mrBlock ? BondBlock.fromMrBlock(mrBlock) : undefined;
  }

  set bonds(value: BondBlock | undefined) {
    if (value) {
      this._mrFrame.insert_block('bonds', value._mrBlock);
    } else {
      this._mrFrame.remove_block('bonds');
    }
  }

  get bondBlock(): BondBlock | undefined {
    return this.bonds;
  }

  get meta(): Map<string, string> {
    // For now, return empty map. We can enhance this later
    return new Map<string, string>();
  }

  /**
   * Get the number of atoms in this frame.
   */
  getAtomCount(): number {
    return this.atoms.n_atoms;
  }

  /**
   * Get the number of bonds in this frame.
   */
  getBondCount(): number {
    return this.bonds?.n_bonds ?? 0;
  }

  /**
   * Add a new atom to the frame.
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   * @param element Element symbol (e.g., 'C', 'N', 'O')
   * @returns The atom ID (index) of the newly added atom
   */
  addAtom(x: number, y: number, z: number, element: string): number {
    const atoms = this.atoms;
    const currentCount = atoms.n_atoms;

    // Get existing arrays or create new ones
    const xArray = currentCount > 0 ? atoms.x : new Float32Array(0);
    const yArray = currentCount > 0 ? atoms.y : new Float32Array(0);
    const zArray = currentCount > 0 ? atoms.z : new Float32Array(0);
    const elementArray = currentCount > 0 ? atoms.element : [];

    // Create new arrays with increased size
    const newX = new Float32Array(currentCount + 1);
    const newY = new Float32Array(currentCount + 1);
    const newZ = new Float32Array(currentCount + 1);
    const newElement = [...elementArray];

    // Copy existing data
    newX.set(xArray);
    newY.set(yArray);
    newZ.set(zArray);

    // Add new atom
    newX[currentCount] = x;
    newY[currentCount] = y;
    newZ[currentCount] = z;
    newElement.push(element);

    // Update the atom block
    atoms.x = newX;
    atoms.y = newY;
    atoms.z = newZ;
    atoms.element = newElement;

    return currentCount; // Return the new atom's ID
  }

  /**
   * Remove an atom from the frame by its ID (index).
   * Also removes all bonds connected to this atom.
   * @param atomId The atom ID (index) to remove
   */
  removeAtom(atomId: number): void {
    const currentCount = this.atoms.n_atoms;

    if (atomId < 0 || atomId >= currentCount) {
      throw new Error(`Invalid atom ID: ${atomId}. Must be between 0 and ${currentCount - 1}`);
    }

    // Get existing arrays
    const xArray = this.atoms.x;
    const yArray = this.atoms.y;
    const zArray = this.atoms.z;
    const elementArray = this.atoms.element;

    // Create new arrays with decreased size
    const newX = new Float32Array(currentCount - 1);
    const newY = new Float32Array(currentCount - 1);
    const newZ = new Float32Array(currentCount - 1);
    const newElement: string[] = [];

    // Copy data, skipping the removed atom
    let newIndex = 0;
    for (let i = 0; i < currentCount; i++) {
      if (i !== atomId) {
        newX[newIndex] = xArray[i];
        newY[newIndex] = yArray[i];
        newZ[newIndex] = zArray[i];
        newElement.push(elementArray[i]);
        newIndex++;
      }
    }

    // Update the atom block
    this.atoms.x = newX;
    this.atoms.y = newY;
    this.atoms.z = newZ;
    this.atoms.set('element', { kind: 'utf8', data: newElement });

    // Remove bonds connected to this atom
    if (this.bonds && this.bonds.n_bonds > 0) {
      const iArray = this.bonds.i;
      const jArray = this.bonds.j;
      const orderArray = this.bonds.order ?? new Uint8Array(0);

      const newBonds: { i: number; j: number; order: number }[] = [];

      for (let b = 0; b < this.bonds.n_bonds; b++) {
        let i = iArray[b];
        let j = jArray[b];

        // Skip bonds connected to the removed atom
        if (i === atomId || j === atomId) {
          continue;
        }

        // Adjust atom indices for atoms after the removed one
        if (i > atomId) i--;
        if (j > atomId) j--;

        newBonds.push({ i, j, order: orderArray[b] });
      }

      // Update bond block
      if (newBonds.length > 0) {
        this.bonds.i = new Uint32Array(newBonds.map(b => b.i));
        this.bonds.j = new Uint32Array(newBonds.map(b => b.j));
        this.bonds.set('order', { kind: 'uint8', data: new Uint8Array(newBonds.map(b => b.order)) });
      } else {
        // No bonds left, create empty bond block
        this.bonds = new BondBlock();
      }
    }
  }

  /**
   * Add a new bond to the frame.
   * @param atomId1 First atom ID
   * @param atomId2 Second atom ID
   * @param order Bond order (1 = single, 2 = double, 3 = triple)
   */
  addBond(atomId1: number, atomId2: number, order: number = 1): void {
    const atomCount = this.atoms.n_atoms;

    if (atomId1 < 0 || atomId1 >= atomCount) {
      throw new Error(`Invalid atomId1: ${atomId1}. Must be between 0 and ${atomCount - 1}`);
    }
    if (atomId2 < 0 || atomId2 >= atomCount) {
      throw new Error(`Invalid atomId2: ${atomId2}. Must be between 0 and ${atomCount - 1}`);
    }

    // Initialize bond block if it doesn't exist
    if (!this.bonds) {
      this.bonds = new BondBlock();
    }

    const currentBondCount = this.bonds.n_bonds;

    // Get existing arrays or create new ones
    const iArray = currentBondCount > 0 ? this.bonds.i : new Uint32Array(0);
    const jArray = currentBondCount > 0 ? this.bonds.j : new Uint32Array(0);
    const orderArray = currentBondCount > 0 ? (this.bonds.order ?? new Uint8Array(0)) : new Uint8Array(0);

    // Create new arrays with increased size
    const newI = new Uint32Array(currentBondCount + 1);
    const newJ = new Uint32Array(currentBondCount + 1);
    const newOrder = new Uint8Array(currentBondCount + 1);

    // Copy existing data
    newI.set(iArray);
    newJ.set(jArray);
    newOrder.set(orderArray);

    // Add new bond
    newI[currentBondCount] = atomId1;
    newJ[currentBondCount] = atomId2;
    newOrder[currentBondCount] = order;

    // Update the bond block
    this.bonds.i = newI;
    this.bonds.j = newJ;
    this.bonds.set('order', { kind: 'uint8', data: newOrder });
  }

  /**
   * Remove a bond from the frame by its ID (index).
   * @param bondId The bond ID (index) to remove
   */
  removeBond(bondId: number): void {
    if (!this.bonds) {
      throw new Error('No bonds to remove');
    }

    const currentBondCount = this.bonds.n_bonds;

    if (bondId < 0 || bondId >= currentBondCount) {
      throw new Error(`Invalid bond ID: ${bondId}. Must be between 0 and ${currentBondCount - 1}`);
    }

    // Get existing arrays
    const iArray = this.bonds.i;
    const jArray = this.bonds.j;
    const orderArray = this.bonds.order ?? new Uint8Array(0);

    // Create new arrays with decreased size
    const newI = new Uint32Array(currentBondCount - 1);
    const newJ = new Uint32Array(currentBondCount - 1);
    const newOrder = new Uint8Array(currentBondCount - 1);

    // Copy data, skipping the removed bond
    let newIndex = 0;
    for (let b = 0; b < currentBondCount; b++) {
      if (b !== bondId) {
        newI[newIndex] = iArray[b];
        newJ[newIndex] = jArray[b];
        newOrder[newIndex] = orderArray[b];
        newIndex++;
      }
    }

    // Update the bond block
    if (newIndex > 0) {
      this.bonds.i = newI;
      this.bonds.j = newJ;
      this.bonds.set('order', { kind: 'uint8', data: newOrder });
    } else {
      // No bonds left
      this.bonds = new BondBlock();
    }
  }

  /**
   * Clear all atoms and bonds from the frame.
   */
  clear(): void {
    this.atoms = new AtomBlock([], [], []);
    this.bonds = new BondBlock();
  }

}

export { Frame, AtomBlock, BondBlock };
