import { BaseModifier, ModifierCategory } from './modifier';
import { Frame } from "molrs-wasm";
import type { PipelineContext } from './types';

// TODO: These should interact with the main rendering system, not just modify the frame.
// For now, they act as markers in the pipeline that the App will observe to trigger interactions
// or they modify the frame's metadata to hint rendering.

export class DrawBoxModifier extends BaseModifier {
    // Properties for UI binding
    public color: string = '#ffffff';
    public lineWidth: number = 1.0;

    constructor() {
        super(
            `draw-box-${Date.now()}`,
            'Draw Box',
            ModifierCategory.SelectionInsensitive
        );
    }

    apply(frame: Frame, _context: PipelineContext): Frame {
        // In a real pipeline, this might attach a visualization op to the frame
        // or the pipeline execution result would include render ops.
        // For this refactor, we are focusing on the UI structure.
        return frame;
    }
}

export class DrawAtomsModifier extends BaseModifier {
    public coloring: string = 'element';
    public radius: number = 0.3;

    constructor() {
        super(
            `draw-atoms-${Date.now()}-${Math.random()}`,
            'Draw Atoms',
            ModifierCategory.SelectionInsensitive
        );
    }

    apply(frame: Frame, _context: PipelineContext): Frame {
        return frame;
    }
}

export class DrawBondsModifier extends BaseModifier {
    public color: string = '#ffffff';
    public radius: number = 0.1;

    constructor() {
        super(
            `draw-bonds-${Date.now()}-${Math.random()}`,
            'Draw Bonds',
            ModifierCategory.SelectionInsensitive
        );
    }

    apply(frame: Frame, _context: PipelineContext): Frame {
        return frame;
    }
}
