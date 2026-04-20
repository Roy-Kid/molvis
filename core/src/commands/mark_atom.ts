/**
 * mark_atom / unmark_atom — first-class commands for marking atoms.
 *
 * A "mark" is a composite annotation (shape + optional label) that pins to an
 * atom and follows it across trajectory frames. Stored internally in
 * `OverlayManager` alongside arrows and text labels, but exposed as its own
 * domain-level command pair so callers think in terms of "mark this atom",
 * not "add an overlay of type mark_atom".
 *
 * Undo symmetry: mark_atom ↔ unmark_atom. The overlay instance is carried
 * as a snapshot across the pair so redo reinstates the exact same object.
 */

import type { MolvisApp } from "../app";
import { MarkAtomOverlay } from "../overlays/mark_atom";
import type { MarkAtomProps } from "../overlays/types";
import { Command, command } from "./base";

// ── mark_atom ────────────────────────────────────────────────────────────────

/**
 * Mark an atom (or world position) with a halo and/or a text label.
 *
 * Usage:
 *   app.execute("mark_atom", { anchorAtomId: 0 })
 *   app.execute("mark_atom", { anchorAtomId: 3, label: { text: "*" } })
 *   app.execute("mark_atom", { position: [1, 0, 0], shape: null, label: { text: "α" } })
 *
 * Returns the created MarkAtomOverlay (use `.id` for later unmark/update).
 */
@command("mark_atom")
export class MarkAtomCommand extends Command<MarkAtomOverlay> {
  private readonly _props: MarkAtomProps;
  private _added: MarkAtomOverlay | null = null;

  constructor(app: MolvisApp, args: MarkAtomProps) {
    super(app);
    this._props = args;
  }

  do(): MarkAtomOverlay {
    const overlay = MarkAtomOverlay.create(
      this.app.scene,
      this._props,
      this.app.overlayManager.labelTexture,
    );
    this._added = overlay;
    this.app.overlayManager.add(overlay);
    this.app.events.emit("overlay-added", { overlay });
    return overlay;
  }

  undo(): UnmarkAtomCommand {
    if (!this._added) {
      throw new Error("Cannot undo mark_atom before the mark is created");
    }
    return new UnmarkAtomCommand(this.app, {
      id: this._added.id,
      _snapshot: this._added,
    });
  }
}

// ── unmark_atom ──────────────────────────────────────────────────────────────

/**
 * Remove a mark by id.
 * Usage: app.execute("unmark_atom", { id: "mark_atom_1" })
 *
 * No-ops silently if the id does not match a current mark, so callers can
 * use it defensively without a prior existence check.
 */
@command("unmark_atom")
export class UnmarkAtomCommand extends Command<void> {
  private readonly _id: string;
  private _snapshot: MarkAtomOverlay | null;

  constructor(
    app: MolvisApp,
    args: { id: string; _snapshot?: MarkAtomOverlay | null },
  ) {
    super(app);
    this._id = args.id;
    this._snapshot = args._snapshot ?? null;
  }

  do(): void {
    if (!this._snapshot) {
      const existing = this.app.overlayManager.get(this._id);
      if (existing instanceof MarkAtomOverlay) this._snapshot = existing;
    }
    this.app.overlayManager.remove(this._id);
    this.app.events.emit("overlay-removed", { id: this._id });
  }

  undo(): RemarkAtomCommand {
    if (!this._snapshot) {
      throw new Error("Cannot undo unmark_atom without a saved mark snapshot");
    }
    return new RemarkAtomCommand(this.app, this._snapshot);
  }
}

// ── Internal: re-add a previously removed mark (for redo of unmark) ──────────

/**
 * Re-adds an already-constructed MarkAtomOverlay object.
 * Not RPC-exposed — only reachable via UnmarkAtomCommand.undo().
 */
export class RemarkAtomCommand extends Command<MarkAtomOverlay> {
  constructor(
    app: MolvisApp,
    private readonly _overlay: MarkAtomOverlay,
  ) {
    super(app);
  }

  do(): MarkAtomOverlay {
    this.app.overlayManager.add(this._overlay);
    this.app.events.emit("overlay-added", { overlay: this._overlay });
    return this._overlay;
  }

  undo(): UnmarkAtomCommand {
    return new UnmarkAtomCommand(this.app, {
      id: this._overlay.id,
      _snapshot: this._overlay,
    });
  }
}
