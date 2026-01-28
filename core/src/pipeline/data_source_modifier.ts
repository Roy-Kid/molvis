import { BaseModifier, ModifierCategory } from "./modifier";
import type { PipelineContext } from "./types";
import { Frame } from "molrs-wasm";

/**
 * DataSourceModifier acts as the visual entry point for the pipeline.
 * It technically just passes the input frame through (identity),
 * but controls the App's source state via its UI properties.
 */
export class DataSourceModifier extends BaseModifier {
    // Properties for UI binding
    public sourceType: 'file' | 'empty' = 'empty';
    public filename: string = '';

    private _frame: Frame | null = null;

    constructor() {
        super(
            "data-source",
            "Data Source",
            ModifierCategory.SelectionInsensitive
        );
        // Data source is always enabled and typically shouldn't be moved or disabled easily
        this.enabled = true;
    }

    public setFrame(frame: Frame) {
        this._frame = frame;
    }

    public getFrame(): Frame | null {
        return this._frame;
    }

    apply(input: Frame, _context: PipelineContext): Frame {
        // If we have a stored frame, we return it, effectively acting as the source.
        // If not, we pass through the input (which might be the default empty source).
        if (this._frame) {
            return this._frame;
        }
        return input;
    }
}
