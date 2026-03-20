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
    await this.applyRepresentation(this.next);
  }

  async undo(): Promise<Command> {
    await this.applyRepresentation(this.prev);
    return new SetRepresentationCommand(this.app, { style: this.prev });
  }

  private async applyRepresentation(repr: RepresentationStyle): Promise<void> {
    this.app.styleManager.setRepresentation(repr);

    // Re-render current frame with new radii
    const frame = this.app.system.frame;
    const box = this.app.system.box;
    await this.app.artist.redrawRepresentation(frame, box);

    this.app.events.emit("representation-change", repr);
  }
}
