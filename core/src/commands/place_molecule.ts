import { Vector3 } from "@babylonjs/core";
import type { Frame } from "@molcrafts/molrs";
import type { MolvisApp } from "../app";
import { Command } from "./base";
import { CompositeCommand } from "./composite";
import { DrawAtomCommand, DrawBondCommand } from "./draw";

/**
 * Extracts atom and bond data from a Frame, offsets positions to
 * the target location, and executes batch DrawAtom + DrawBond commands.
 * Undo removes all placed atoms/bonds as a single atomic action.
 */
export class PlaceMoleculeCommand extends Command<void> {
  private composite: CompositeCommand | null = null;

  constructor(
    app: MolvisApp,
    private frame: Frame,
    private target: Vector3,
  ) {
    super(app);
  }

  async do(): Promise<void> {
    // Redo path: re-execute the existing composite
    if (this.composite) {
      await this.composite.do();
      return;
    }

    const atomBlock = this.frame.getBlock("atoms");
    if (!atomBlock) return;

    const nAtoms = atomBlock.nrows();
    if (nAtoms === 0) return;

    // Read atom positions
    const xs = atomBlock.copyColF("x");
    const ys = atomBlock.copyColF("y");
    const zs = atomBlock.copyColF("z");

    // Read element symbols — try canonical "element", fall back to "symbol" for
    // older molrs builds that still use the atomistic-layer column name.
    const elements =
      atomBlock.copyColStr("element") ?? atomBlock.copyColStr("symbol");

    // Compute molecule center
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < nAtoms; i++) {
      cx += xs[i];
      cy += ys[i];
      cz += zs[i];
    }
    cx /= nAtoms;
    cy /= nAtoms;
    cz /= nAtoms;

    // Offset = target - center
    const ox = this.target.x - cx;
    const oy = this.target.y - cy;
    const oz = this.target.z - cz;

    // Pre-allocate contiguous atom and bond IDs
    const baseAtomId = this.app.world.sceneIndex.getNextAtomId();
    const baseBondId = this.app.world.sceneIndex.getNextBondId();

    // Build atom commands
    const atomCommands: Command<unknown>[] = [];
    for (let i = 0; i < nAtoms; i++) {
      const position = new Vector3(xs[i] + ox, ys[i] + oy, zs[i] + oz);
      atomCommands.push(
        new DrawAtomCommand(this.app, position, {
          element: elements[i],
          atomId: baseAtomId + i,
        }),
      );
    }

    // Build bond commands with pre-assigned IDs
    const bondCommands: Command<unknown>[] = [];
    const bondBlock = this.frame.getBlock("bonds");

    if (bondBlock && bondBlock.nrows() > 0) {
      const nBonds = bondBlock.nrows();
      const is = bondBlock.copyColU32("atomi");
      const js = bondBlock.copyColU32("atomj");

      // molrs stores bond order as float; read f32 first, fall back to u32
      let orderValues: number[];
      try {
        const f = bondBlock.copyColF("order");
        orderValues = Array.from(f, (v) => Math.round(v));
      } catch {
        try {
          const u = bondBlock.copyColU32("order");
          orderValues = Array.from(u);
        } catch {
          orderValues = Array.from({ length: nBonds }, () => 1);
        }
      }

      for (let b = 0; b < nBonds; b++) {
        const ai = is[b];
        const aj = js[b];
        if (ai >= nAtoms || aj >= nAtoms) continue;

        const startPos = new Vector3(xs[ai] + ox, ys[ai] + oy, zs[ai] + oz);
        const endPos = new Vector3(xs[aj] + ox, ys[aj] + oy, zs[aj] + oz);

        bondCommands.push(
          new DrawBondCommand(this.app, startPos, endPos, {
            order: orderValues[b],
            atomId1: baseAtomId + ai,
            atomId2: baseAtomId + aj,
            bondId: baseBondId + b,
          }),
        );
      }
    }

    this.composite = new CompositeCommand(this.app, [
      ...atomCommands,
      ...bondCommands,
    ]);
    await this.composite.do();
  }

  async undo(): Promise<Command> {
    if (this.composite) {
      await this.composite.undo();
    }
    return this;
  }
}
