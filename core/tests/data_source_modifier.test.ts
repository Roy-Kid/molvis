import { Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import { DataSourceModifier } from "../src/pipeline/data_source_modifier";
import { SelectionMask } from "../src/pipeline/types";
import "./setup_wasm";

describe("DataSourceModifier", () => {
  it("passes through the current input frame without retaining a prior frame", () => {
    const modifier = new DataSourceModifier();
    const frameA = new Frame();
    const frameB = new Frame();
    const context = {
      currentSelection: SelectionMask.all(0),
      selectionSet: new Map<string, SelectionMask>(),
      selectionCache: new Map<string, SelectionMask>(),
      selectedBondIds: [],
      suppressHighlight: false,
      frameIndex: 0,
      app: {} as never,
      postRenderEffects: [],
    };

    expect(modifier.apply(frameA, context)).toBe(frameA);
    expect(modifier.apply(frameB, context)).toBe(frameB);
  });
});
