/**
 * Page-host reuse regression for the shared element picker.
 * Provenance: MolvisSketch and ToolsTab input wiring, 2026-07-30.
 */

import {
  defineMolvisElementPicker,
  type MolvisElementPickerElement,
} from "@molcrafts/molvis-core/element-picker";
import { describe, expect, it } from "@rstest/core";

interface SketchBoardStyleState {
  element: string;
  tool: "bond" | "atom";
  setElement(element: string): void;
  setTool(tool: "bond" | "atom"): void;
}

interface EditModeStyleState {
  element: string;
  bondOrder: number;
}

function pickerCell(
  picker: MolvisElementPickerElement,
  symbol: string,
): HTMLButtonElement {
  const cell =
    picker.shadowRoot?.querySelector<HTMLButtonElement>(
      `button[data-element="${symbol}"]`,
    ) ?? null;
  if (!cell) {
    throw new Error(`Element picker did not render its ${symbol} cell`);
  }
  return cell;
}

describe("shared-element-picker-03-page regression", () => {
  it("drives both SketchBoard-style and EditMode-style page consumers", () => {
    defineMolvisElementPicker();
    const picker = document.createElement("molvis-element-picker");
    document.body.append(picker);

    const sketchBoard: SketchBoardStyleState = {
      element: "C",
      tool: "bond",
      setElement(element) {
        this.element = element;
      },
      setTool(tool) {
        this.tool = tool;
      },
    };
    const editMode: EditModeStyleState = {
      element: "C",
      bondOrder: 1,
    };

    picker.addEventListener("input", () => {
      sketchBoard.setElement(picker.value);
      sketchBoard.setTool("atom");
    });
    picker.addEventListener("input", () => {
      editMode.element = picker.value;
    });

    try {
      expect(picker.value).toBe("C");

      const trigger =
        picker.shadowRoot?.querySelector<HTMLButtonElement>(
          'button[part~="trigger"]',
        ) ?? null;
      if (!trigger) {
        throw new Error("Element picker did not render its trigger");
      }
      trigger.click();
      pickerCell(picker, "Fe").click();

      expect(sketchBoard.element).toBe("Fe");
      expect(sketchBoard.tool).toBe("atom");
      expect(editMode.element).toBe("Fe");
      expect(picker.value).toBe("Fe");
    } finally {
      picker.remove();
    }
  });
});
