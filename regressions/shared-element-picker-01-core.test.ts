/**
 * Shared element-picker public-API regression.
 * Goldens: conventional 18-column periodic-table layout with detached f-block,
 * hand-checked against the IUPAC Periodic Table (release 4 May 2022) on
 * 2026-07-30; user-event protocol follows the HTML input/change convention.
 */

import { defineMolvisElementPicker } from "@molcrafts/molvis-core/element-picker";
import { PeriodicTableElements } from "@molcrafts/molvis-core/elements";
import { describe, expect, it } from "@rstest/core";

function metadataFor(symbol: string) {
  const element = PeriodicTableElements.find(
    (candidate) => candidate.symbol === symbol,
  );
  if (!element) {
    throw new Error(`Missing periodic-table metadata for ${symbol}`);
  }
  return element;
}

describe("shared-element-picker-01-core regression", () => {
  it("preserves layout goldens and the user selection event protocol", () => {
    expect(metadataFor("H")).toMatchObject({
      atomicNumber: 1,
      period: 1,
      group: 1,
      block: "s",
      row: 1,
      column: 1,
    });
    expect(metadataFor("C")).toMatchObject({
      atomicNumber: 6,
      period: 2,
      group: 14,
      block: "p",
      row: 2,
      column: 14,
    });
    expect(metadataFor("La")).toMatchObject({
      atomicNumber: 57,
      period: 6,
      group: null,
      block: "f",
      row: 8,
      column: 3,
    });
    expect(metadataFor("Og")).toMatchObject({
      atomicNumber: 118,
      period: 7,
      group: 18,
      block: "p",
      row: 7,
      column: 18,
    });

    defineMolvisElementPicker();
    const picker = document.createElement("molvis-element-picker");
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

      const events: Array<{
        type: string;
        bubbles: boolean;
        composed: boolean;
        value: string;
      }> = [];
      const record = (event: Event): void => {
        events.push({
          type: event.type,
          bubbles: event.bubbles,
          composed: event.composed,
          value: picker.value,
        });
      };
      picker.addEventListener("input", record);
      picker.addEventListener("change", record);

      expect(picker.value).toBe("C");
      trigger.click();
      iron.click();

      expect(picker.value).toBe("Fe");
      expect(events).toEqual([
        { type: "input", bubbles: true, composed: true, value: "Fe" },
        { type: "change", bubbles: true, composed: true, value: "Fe" },
      ]);
    } finally {
      picker.remove();
    }
  });
});
