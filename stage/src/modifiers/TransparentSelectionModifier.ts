import type { Frame } from "@molcrafts/molvis-core/molrs";
import { BaseModifier, ModifierCapability } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import { type ProjectParams, readNumber } from "../project/params";

/**
 * Modifier that applies a persistent alpha override to selected atoms.
 * Reads selection from context.currentSelection (set by a preceding SelectModifier).
 * Multiple transparent modifiers can stack; later modifiers override earlier ones.
 */
export class TransparentSelectionModifier extends BaseModifier {
  public opacity = 0.35;
  private _lastCount = 0;

  constructor(id = `transparent-selection-${Date.now()}`) {
    super(
      id,
      "Transparent",
      new Set([
        ModifierCapability.ConsumesSelection,
        ModifierCapability.TransformsData,
      ]),
    );
  }

  get selectedCount(): number {
    return this._lastCount;
  }

  toProjectParams(): ProjectParams {
    return { opacity: this.opacity };
  }

  fromProjectParams(params: ProjectParams): void {
    this.opacity = Math.max(
      0,
      Math.min(1, readNumber(params.opacity, this.opacity)),
    );
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this.opacity}`;
  }

  apply(input: Frame, context: PipelineContext): Frame {
    const selection = context.currentSelection;
    const indices = new Set(selection.getIndices());
    if (indices.size === 0) return input;

    this._lastCount = indices.size;

    const opacity = this.opacity;
    context.postRenderEffects.push(() => {
      const artist = context.app.artist;
      artist.setAtomOpacity(indices, opacity);
      artist.setBondOpacityForAtoms(indices, opacity);
    });

    return input;
  }
}
