import type { Frame } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "./modifier";
import type { PipelineContext } from "./types";

/**
 * DataSourceModifier acts as the visual entry point for the pipeline.
 * It technically just passes the input frame through (identity),
 * but controls the App's source state via its UI properties.
 *
 * ``sourceType`` reflects where the frame data entered the pipeline:
 * - ``empty``   — no data loaded yet
 * - ``file``    — loaded from a local file via the page UI or drag-drop
 * - ``backend`` — pushed by a remote controller over the WebSocket RPC
 */
export class DataSourceModifier extends BaseModifier {
  // Properties for UI binding
  public sourceType: "file" | "empty" | "backend" = "empty";
  public filename = "";

  private _frame: Frame | null = null;
  constructor() {
    super(`data-source-${Date.now()}`, "Data Source", ModifierCategory.Data);
  }

  public setFrame(frame: Frame | null) {
    this._frame = frame;
  }

  public getFrame(): Frame | null {
    return this._frame;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    // Identity passthrough — this modifier is the pipeline's data entry point.
    // Per-component render visibility lives in the StyleManager representation
    // (atoms/bonds) and the sim_box mesh (box), which the Artist consumes.
    return this._frame || input;
  }
}
