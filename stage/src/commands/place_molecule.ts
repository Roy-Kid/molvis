import { Vector3 } from "@babylonjs/core";
import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { MolvisApp } from "../app";
import { viewAtomCoords } from "../io/atom_coords";
import { BOND_TYPE_SINGLE } from "../utils/bond_order";
import { withKekuleOrders } from "../utils/kekule";
import { Command } from "./base";
import { CompositeCommand } from "./composite";
import { DrawAtomCommand, DrawBondCommand } from "./draw";

/**
 * Extracts atom and bond data from a Frame, offsets positions to
 * the target location, and executes batch DrawAtom + DrawBond commands.
 * Undo removes all placed atoms/bonds as a single atomic action.
 *
 * Read-only on the caller's Frame: stamps go through molrs
 * {@link withKekuleOrders} (new handle, freed after column snapshot) so
 * aromatic bonds carry localized `bond_number` without mutating the template.
 * Ownership of the constructor Frame stays with the caller.
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

    // molrs Perceive.findKekuleOrders — new Frame; free when we are done reading.
    const prepared = withKekuleOrders(this.frame);
    try {
      await this.buildAndRunFrom(prepared);
    } finally {
      prepared.free();
    }
  }

  private async buildAndRunFrom(frame: Frame): Promise<void> {
    const atomBlock = frame.getBlock("atoms");
    if (!atomBlock) return;

    const nAtoms = atomBlock.nrows();
    if (nAtoms === 0) return;

    // Snapshot positions into JS-owned buffers before any other WASM column
    // read (copyColStr can reallocate and invalidate viewColF views).
    const coords = viewAtomCoords(atomBlock);
    if (!coords) {
      throw new Error("Frame atoms are missing x/y/z and xu/yu/zu coordinates");
    }
    const xs = Float64Array.from(coords.x);
    const ys = Float64Array.from(coords.y);
    const zs = Float64Array.from(coords.z);

    // Read element symbols — try canonical "element", fall back to "symbol" for
    // older molrs builds that still use the atomistic-layer column name.
    const elements =
      atomBlock.copyColStr("element") ?? atomBlock.copyColStr("symbol");
    if (!elements || elements.length < nAtoms) {
      throw new Error(
        "Frame atoms are missing element/symbol column (required to place)",
      );
    }

    // Compute molecule center so the template is centered on the click target
    // (same click projection as a single DrawAtomCommand).
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
    const bondBlock = frame.getBlock("bonds");

    if (bondBlock && bondBlock.nrows() > 0) {
      const nBonds = bondBlock.nrows();
      const is = bondBlock.copyColU32("atomi");
      const js = bondBlock.copyColU32("atomj");

      const typeCol = bondBlock.viewColU32("bond_type");
      const numberCol = bondBlock.viewColU32("bond_number");

      for (let b = 0; b < nBonds; b++) {
        const ai = is[b];
        const aj = js[b];
        if (ai >= nAtoms || aj >= nAtoms) continue;

        const bondType = typeCol?.[b] ?? BOND_TYPE_SINGLE;
        const bondNumber =
          numberCol?.[b] ??
          (bondType >= BOND_TYPE_SINGLE && bondType <= 3 ? bondType : 0);

        const startPos = new Vector3(xs[ai] + ox, ys[ai] + oy, zs[ai] + oz);
        const endPos = new Vector3(xs[aj] + ox, ys[aj] + oy, zs[aj] + oz);

        bondCommands.push(
          new DrawBondCommand(this.app, startPos, endPos, {
            bondType,
            bondNumber,
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
