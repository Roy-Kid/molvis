import { buildRingTemplate, type RingKind } from "../geometry/ring_template";
import { findAtom, SNAP_RADIUS } from "../geometry/snap";
import type { MoleculeGraph } from "../molecule_graph";
import { SketchCommand } from "../sketch_command";
import type { MoleculeData } from "../types";

export class PlaceRingCommand extends SketchCommand {
  private before: MoleculeData | null = null;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly size: number,
    private readonly cx: number,
    private readonly cy: number,
    private readonly radius: number | undefined,
    private readonly kind: RingKind,
  ) {
    super();
  }

  do(): void {
    this.before = this.graph.getMoleculeData();
    const ring = buildRingTemplate(
      this.size,
      this.cx,
      this.cy,
      this.radius,
      this.kind,
    );
    const indexMap: number[] = [];
    for (const v of ring.vertices) {
      const snap = findAtom(this.graph, v.x, v.y, SNAP_RADIUS);
      if (snap !== null) {
        indexMap.push(snap);
      } else {
        indexMap.push(
          this.graph.addAtomInternal({ element: "C", x: v.x, y: v.y }),
        );
      }
    }
    for (const [a, b] of ring.edges) {
      const i = indexMap[a];
      const j = indexMap[b];
      const data = this.graph.getMoleculeData();
      const exists = data.bonds.some(
        (bond) =>
          (bond.i === i && bond.j === j) || (bond.i === j && bond.j === i),
      );
      if (!exists) {
        this.graph.addBondInternal({ i, j, order: 1 });
      }
    }
    // store benzene flag on graph via atom charge? use a side map on board later.
    // For data export we don't need kind on graph for generate3D.
  }

  undo(): void {
    if (this.before) {
      this.graph.replaceAll(this.before);
      this.before = null;
    }
  }
}

export class CycleBondOrderCommand extends SketchCommand {
  private prevOrder = 1;
  private prevStereo: "none" | "up" | "down" | undefined;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly bondIndex: number,
  ) {
    super();
  }

  do(): void {
    const b = this.graph.getBond(this.bondIndex);
    this.prevOrder = b.order;
    this.prevStereo = b.stereo;
    const next = b.order >= 3 ? 1 : b.order + 1;
    this.graph.setBondInternal(this.bondIndex, {
      ...b,
      order: next,
      stereo: next === 1 ? b.stereo : "none",
    });
  }

  undo(): void {
    const b = this.graph.getBond(this.bondIndex);
    this.graph.setBondInternal(this.bondIndex, {
      ...b,
      order: this.prevOrder,
      stereo: this.prevStereo,
    });
  }
}

export class SetBondStereoCommand extends SketchCommand {
  private prev: "none" | "up" | "down" | undefined;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly bondIndex: number,
    private readonly stereo: "none" | "up" | "down",
  ) {
    super();
  }

  do(): void {
    const b = this.graph.getBond(this.bondIndex);
    this.prev = b.stereo;
    if (b.order !== 1) return;
    this.graph.setBondInternal(this.bondIndex, { ...b, stereo: this.stereo });
  }

  undo(): void {
    const b = this.graph.getBond(this.bondIndex);
    this.graph.setBondInternal(this.bondIndex, { ...b, stereo: this.prev });
  }
}

export class AdjustAtomChargeCommand extends SketchCommand {
  private prev = 0;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly atomIndex: number,
    private readonly delta: number,
  ) {
    super();
  }

  do(): void {
    const a = this.graph.getAtom(this.atomIndex);
    this.prev = a.charge ?? 0;
    this.graph.setAtomInternal(this.atomIndex, {
      ...a,
      charge: this.prev + this.delta,
    });
  }

  undo(): void {
    const a = this.graph.getAtom(this.atomIndex);
    this.graph.setAtomInternal(this.atomIndex, { ...a, charge: this.prev });
  }
}

export class MoveSelectionCommand extends SketchCommand {
  constructor(
    private readonly graph: MoleculeGraph,
    private readonly atomIndices: number[],
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super();
  }

  do(): void {
    for (const i of this.atomIndices) {
      const a = this.graph.getAtom(i);
      this.graph.setAtomInternal(i, { ...a, x: a.x + this.dx, y: a.y + this.dy });
    }
  }

  undo(): void {
    for (const i of this.atomIndices) {
      const a = this.graph.getAtom(i);
      this.graph.setAtomInternal(i, { ...a, x: a.x - this.dx, y: a.y - this.dy });
    }
  }
}

export class ClearDocumentCommand extends SketchCommand {
  private before: MoleculeData | null = null;

  constructor(private readonly graph: MoleculeGraph) {
    super();
  }

  do(): void {
    this.before = this.graph.getMoleculeData();
    this.graph.replaceAll({ atoms: [], bonds: [] });
  }

  undo(): void {
    if (this.before) {
      this.graph.replaceAll(this.before);
      this.before = null;
    }
  }
}
