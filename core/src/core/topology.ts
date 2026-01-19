/**
 * Molecular topology graph for tracking atoms and bonds.
 * Maintains relationships between atoms and their connected bonds.
 */
export class MolecularTopology {
  // Map: atomId -> Set of bondIds connected to this atom
  private atomBonds: Map<number, Set<number>> = new Map();
  
  // Map: bondId -> { atomId1, atomId2 }
  private bondAtoms: Map<number, { atom1: number; atom2: number }> = new Map();

  /**
   * Register an atom in the topology.
   */
  addAtom(atomId: number): void {
    if (!this.atomBonds.has(atomId)) {
      this.atomBonds.set(atomId, new Set());
    }
  }

  /**
   * Register a bond between two atoms.
   */
  addBond(bondId: number, atomId1: number, atomId2: number): void {
    // Register bond
    this.bondAtoms.set(bondId, { atom1: atomId1, atom2: atomId2 });

    // Update atom connections
    if (!this.atomBonds.has(atomId1)) {
      this.atomBonds.set(atomId1, new Set());
    }
    if (!this.atomBonds.has(atomId2)) {
      this.atomBonds.set(atomId2, new Set());
    }

    this.atomBonds.get(atomId1)!.add(bondId);
    this.atomBonds.get(atomId2)!.add(bondId);
  }

  /**
   * Remove an atom and all its connected bonds.
   * Returns array of bondIds that were removed.
   */
  removeAtom(atomId: number): number[] {
    const bondIds = Array.from(this.atomBonds.get(atomId) || []);
    
    // Remove all connected bonds
    for (const bondId of bondIds) {
      this.removeBond(bondId);
    }

    // Remove atom
    this.atomBonds.delete(atomId);
    
    return bondIds;
  }

  /**
   * Remove a bond from the topology.
   */
  removeBond(bondId: number): void {
    const bondInfo = this.bondAtoms.get(bondId);
    if (!bondInfo) return;

    // Remove bond from atom connections
    const atom1Bonds = this.atomBonds.get(bondInfo.atom1);
    const atom2Bonds = this.atomBonds.get(bondInfo.atom2);
    
    if (atom1Bonds) {
      atom1Bonds.delete(bondId);
    }
    if (atom2Bonds) {
      atom2Bonds.delete(bondId);
    }

    // Remove bond
    this.bondAtoms.delete(bondId);
  }

  /**
   * Get all bond IDs connected to an atom.
   */
  getBondsForAtom(atomId: number): number[] {
    return Array.from(this.atomBonds.get(atomId) || []);
  }

  /**
   * Get the two atoms connected by a bond.
   */
  getAtomsForBond(bondId: number): { atom1: number; atom2: number } | undefined {
    return this.bondAtoms.get(bondId);
  }

  /**
   * Clear all topology data.
   */
  clear(): void {
    this.atomBonds.clear();
    this.bondAtoms.clear();
  }

  /**
   * Get all atom IDs.
   */
  getAllAtoms(): number[] {
    return Array.from(this.atomBonds.keys());
  }

  /**
   * Get all bond IDs.
   */
  getAllBonds(): number[] {
    return Array.from(this.bondAtoms.keys());
  }
}








