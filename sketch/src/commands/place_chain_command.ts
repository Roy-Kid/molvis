import type { MoleculeGraph } from "../molecule_graph";
import { SketchCommand } from "../sketch_command";
import type { MoleculeData } from "../types";

/**
 * Place a carbon chain from atom `startIndex` toward (endX, endY)
 * with fixed step length. One undo restores the pre-chain graph.
 */
export class PlaceChainCommand extends SketchCommand {
  private before: MoleculeData | null = null;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly startIndex: number,
    private readonly endX: number,
    private readonly endY: number,
    private readonly step: number,
    private readonly order: number,
  ) {
    super();
  }

  do(): void {
    this.before = this.graph.getMoleculeData();
    const start = this.graph.getAtom(this.startIndex);
    const dx = this.endX - start.x;
    const dy = this.endY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < this.step * 0.5) return;
    const nSeg = Math.max(1, Math.round(dist / this.step));
    const ux = dx / dist;
    const uy = dy / dist;
    let prev = this.startIndex;
    for (let s = 1; s <= nSeg; s++) {
      const idx = this.graph.addAtomInternal({
        element: "C",
        x: start.x + ux * this.step * s,
        y: start.y + uy * this.step * s,
      });
      this.graph.addBondInternal({ i: prev, j: idx, order: this.order });
      prev = idx;
    }
  }

  undo(): void {
    if (this.before) {
      this.graph.replaceAll(this.before);
      this.before = null;
    }
  }
}
