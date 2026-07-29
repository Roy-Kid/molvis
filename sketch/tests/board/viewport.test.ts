import { describe, expect, it } from "@rstest/core";
import { ViewportCoords } from "../../src/board/coords";
import { ViewportController } from "../../src/board/viewport";

describe("ViewportController", () => {
  it("zoomAtScreen keeps world point under cursor fixed", () => {
    const coords = new ViewportCoords();
    coords.resize(200, 200, 1);
    coords.setScale(40);
    coords.setPan(0, 0);
    const ctrl = new ViewportController(coords);
    const sx = 100;
    const sy = 100;
    const before = coords.screenToDoc(sx, sy);
    ctrl.zoomAtScreen(sx, sy, 2);
    const after = coords.screenToDoc(sx, sy);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});
