import type { MolvisApp } from "../app";
import type { RepresentationStyle } from "../artist/representation";
import { Command, command } from "./base";

@command("set_representation")
export class SetRepresentationCommand extends Command<void> {
  private next: RepresentationStyle;
  private prev: RepresentationStyle;

  constructor(app: MolvisApp, args: { style: RepresentationStyle }) {
    super(app);
    this.next = args.style;
    this.prev = app.styleManager.getRepresentation();
  }

  async do(): Promise<void> {
    this.applyRepresentation(this.next);
  }

  async undo(): Promise<Command> {
    this.applyRepresentation(this.prev);
    return new SetRepresentationCommand(this.app, { style: this.prev });
  }

  private applyRepresentation(repr: RepresentationStyle): void {
    this.app.styleManager.setRepresentation(repr);

    // Toggle mesh visibility
    this.app.artist.atomMesh.setEnabled(repr.showAtoms);
    this.app.artist.bondMesh.setEnabled(repr.showBonds);
    this.app.artist.ribbonRenderer.setVisible(repr.showRibbon);

    // Re-render current frame with new radii
    const frame = this.app.system.frame;
    const box = this.app.system.box;
    if (frame) {
      this.app.artist.clear();
      this.app.artist.renderFrame(frame, box);
    }

    // Restore ribbon visibility after clear (which disposes meshes)
    this.app.artist.ribbonRenderer.setVisible(repr.showRibbon);

    this.app.events.emit("representation-change", repr);
  }
}
