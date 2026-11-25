import { describe, expect, it } from "@rstest/core";
import {
  type SketchAnnotation,
  snapToAnnotationText,
} from "../src/annotations";

describe("snapToAnnotationText", () => {
  const text: SketchAnnotation = {
    kind: "text",
    x: 3,
    y: 0,
    label: { text: "PEGM", size: 1, align: "left" },
  };

  it("snaps to the incoming side at the measured extent of left-aligned text", () => {
    const measure = () => 2;
    expect(
      snapToAnnotationText(
        [text],
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        0.2,
        0.1,
        measure,
      ),
    ).toEqual({ x: 2.9, y: 0 });
    expect(
      snapToAnnotationText(
        [text],
        { x: 8, y: 0 },
        { x: 4, y: 0 },
        0.2,
        0.1,
        measure,
      ),
    ).toEqual({ x: 5.1, y: 0 });
  });

  it("does not snap a pointer outside the tolerance or back across the starting point", () => {
    expect(
      snapToAnnotationText([text], { x: 0, y: 0 }, { x: 1, y: 0 }, 0.2, 0.1),
    ).toBeUndefined();
    expect(
      snapToAnnotationText([text], { x: 4, y: 0 }, { x: 5, y: 0 }, 0.2, 0.1),
    ).toBeUndefined();
  });
});
