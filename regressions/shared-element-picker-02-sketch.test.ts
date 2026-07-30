/**
 * Shared element-picker → SketchBoard integration regression.
 * Golden: selecting Fe through the core Web Component activates SketchBoard's
 * atom tool and element through the public input-event protocol.
 * Provenance: 2026-07-30.
 */

import { defineMolvisElementPicker } from "@molcrafts/molvis-core/element-picker";
import { describe, expect, it } from "@rstest/core";
import { SketchBoard } from "../sketch/src/index";

describe("shared-element-picker-02-sketch regression", () => {
  it("selects Fe through the picker and drives the SketchBoard public API", () => {
    defineMolvisElementPicker();
    const picker = document.createElement("molvis-element-picker");
    const board = new SketchBoard();
    board.setTool("bond");

    const onInput = (): void => {
      board.setElement(picker.value);
      board.setTool("atom");
    };
    picker.addEventListener("input", onInput);
    document.body.append(picker);

    try {
      const trigger =
        picker.shadowRoot?.querySelector<HTMLButtonElement>(
          'button[part~="trigger"]',
        ) ?? null;
      const iron =
        picker.shadowRoot?.querySelector<HTMLButtonElement>(
          'button[data-element="Fe"]',
        ) ?? null;
      if (!trigger || !iron) {
        throw new Error(
          "Element picker did not render its trigger and Fe cell",
        );
      }

      trigger.click();
      iron.click();

      expect(board.getElement()).toBe("Fe");
      expect(board.getTool()).toBe("atom");
      expect(picker.value).toBe("Fe");
    } finally {
      picker.removeEventListener("input", onInput);
      picker.remove();
    }
  });
});
