import type { SketchAnnotation } from "../annotations";
import { SketchCommand } from "../sketch_command";

export class ReplaceAnnotationsCommand extends SketchCommand {
  constructor(
    private readonly replace: (items: readonly SketchAnnotation[]) => void,
    private readonly before: readonly SketchAnnotation[],
    private readonly after: readonly SketchAnnotation[],
  ) {
    super();
  }

  do(): void {
    this.replace(this.after);
  }

  undo(): void {
    this.replace(this.before);
  }
}
