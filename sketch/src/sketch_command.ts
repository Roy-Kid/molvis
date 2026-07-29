/**
 * Reversible sketch edit. Independent of molvis-core Command (no MolvisApp).
 */
export abstract class SketchCommand {
  /** Apply the edit. */
  abstract do(): void;
  /** Reverse the edit. */
  abstract undo(): void;
}
