import type { MoleculeGraph } from "../molecule_graph";
import { SketchCommand } from "../sketch_command";

/** Replace the displayed element text while leaving chemistry intact. */
export class SetAtomLabelCommand extends SketchCommand {
  private previous: string | undefined;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly index: number,
    private readonly label: string | undefined,
  ) {
    super();
  }

  do(): void {
    const atom = this.graph.getAtom(this.index);
    this.previous = atom.label;
    this.graph.setAtomInternal(this.index, { ...atom, label: this.label });
  }

  undo(): void {
    const atom = this.graph.getAtom(this.index);
    this.graph.setAtomInternal(this.index, { ...atom, label: this.previous });
  }
}

/** Apply or clear an atom-specific label color. */
export class SetAtomColorCommand extends SketchCommand {
  private previous: string | undefined;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly atomIndex: number,
    private readonly color: string | undefined,
  ) {
    super();
  }

  do(): void {
    const atom = this.graph.getAtom(this.atomIndex);
    this.previous = atom.color;
    this.graph.setAtomInternal(this.atomIndex, {
      ...atom,
      color: this.color,
    });
  }

  undo(): void {
    const atom = this.graph.getAtom(this.atomIndex);
    this.graph.setAtomInternal(this.atomIndex, {
      ...atom,
      color: this.previous,
    });
  }
}

/** Apply or clear a bond-specific stroke color. */
export class SetBondColorCommand extends SketchCommand {
  private previous: string | undefined;

  constructor(
    private readonly graph: MoleculeGraph,
    private readonly bondIndex: number,
    private readonly color: string | undefined,
  ) {
    super();
  }

  do(): void {
    const bond = this.graph.getBond(this.bondIndex);
    this.previous = bond.color;
    this.graph.setBondInternal(this.bondIndex, {
      ...bond,
      color: this.color,
    });
  }

  undo(): void {
    const bond = this.graph.getBond(this.bondIndex);
    this.graph.setBondInternal(this.bondIndex, {
      ...bond,
      color: this.previous,
    });
  }
}
