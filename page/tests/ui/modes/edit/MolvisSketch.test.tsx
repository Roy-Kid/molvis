import { describe, expect, it } from "@rstest/core";
import { MolvisSketch } from "../../../../src/ui/modes/edit/MolvisSketch";

describe("MolvisSketch", () => {
  it("exports a forwardRef component with displayName", () => {
    expect(MolvisSketch).toBeDefined();
    expect(MolvisSketch.displayName).toBe("MolvisSketch");
  });
});
