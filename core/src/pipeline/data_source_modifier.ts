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

  // Visibility
  public showAtoms = true;
  public showBonds = true;
  public showBox = true;

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
    const sourceFrame = this._frame || input;

    if (this.showAtoms && this.showBonds && this.showBox) {
      return sourceFrame;
    }

    // Visibility flags are currently used for UI state only.
    // Frame-level block filtering is intentionally a no-op in v0.0.2.
    return sourceFrame;
  }
}
