/**
 * 2D atom in document coordinates (Å-like units, not CSS pixels).
 */
export interface Atom2D {
  element: string;
  /** Document-space x (Å-like). */
  x: number;
  /** Document-space y (Å-like). */
  y: number;
  /** Formal charge (dimensionless). Default 0 when omitted. */
  charge?: number;
}

/**
 * Bond between atom indices `i` and `j` in the parent atom list.
 */
export interface Bond2D {
  /** Atom index of the first endpoint. */
  i: number;
  /** Atom index of the second endpoint. */
  j: number;
  /** Bond order: 1, 2, or 3. */
  order: number;
  /** Stereochemistry for single bonds only. */
  stereo?: "none" | "up" | "down";
}

/**
 * Stable sketch export contract (generalized from former KekuleComposer.getMoleculeData).
 */
export interface MoleculeData {
  atoms: Atom2D[];
  bonds: Bond2D[];
}
