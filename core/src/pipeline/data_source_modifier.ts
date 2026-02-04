import type { Frame } from "molwasm";
import { BaseModifier, ModifierCategory } from "./modifier";
import type { PipelineContext } from "./types";

/**
 * DataSourceModifier acts as the visual entry point for the pipeline.
 * It technically just passes the input frame through (identity),
 * but controls the App's source state via its UI properties.
 */
export class DataSourceModifier extends BaseModifier {
  // Properties for UI binding
  public sourceType: "file" | "empty" = "empty";
  public filename = "";

  // Visibility
  public showAtoms = true;
  public showBonds = true;
  public showBox = true;

  private _frame: Frame | null = null;
  constructor() {
    super(`data-source-${Date.now()}`, "Data Source", ModifierCategory.Data);
  }

  public setFrame(frame: Frame) {
    this._frame = frame;
  }

  public getFrame(): Frame | null {
    return this._frame;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    // Source Frame
    const sourceFrame = this._frame || input;

    // If all visible, return as is
    if (this.showAtoms && this.showBonds && this.showBox) {
      return sourceFrame;
    }

    // Create restricted view (new Frame or modified copy)
    // Since Frame is WASM, we can't easily "clone shallowly".
    // However, we can create a new Frame and set blocks from the source.
    // const output = new Frame();

    // TODO: Fix Frame API usage for filtering. setBlock and box assignment are not available or typed correctly.
    // For now, we return the full frame. logic is disabled.
    /*
        if (this.showAtoms) {
            const atoms = sourceFrame.getBlock("atoms");
            if (atoms) output.setBlock("atoms", atoms);
        }

        if (this.showBonds) {
            const bonds = sourceFrame.getBlock("bonds");
            if (bonds) output.setBlock("bonds", bonds);
        }

        if (this.showBox) {
            output.box = sourceFrame.box;
        }
        return output;
        */
    return sourceFrame;
  }
}
