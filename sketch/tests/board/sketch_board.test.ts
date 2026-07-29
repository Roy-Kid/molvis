import { describe, expect, it } from "@rstest/core";
import { SketchBoard } from "../../src/board/sketch_board";

function makeCanvas(w = 300, h = 200): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({
      left: 0,
      top: 0,
      width: w,
      height: h,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  return canvas;
}

function pointer(
  type: "pointerdown" | "pointerup",
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
) {
  canvas.dispatchEvent(
    new PointerEvent(type, {
      clientX,
      clientY,
      bubbles: true,
    }),
  );
}

describe("SketchBoard", () => {
  it("atom tool places atom on empty click", () => {
    const board = new SketchBoard();
    const canvas = makeCanvas();
    board.mount(canvas);
    board.setTool("atom");
    board.setElement("O");
    // center of canvas → doc ~ (0,0)
    pointer("pointerdown", canvas, 150, 100);
    expect(board.getMoleculeData().atoms).toHaveLength(1);
    expect(board.getMoleculeData().atoms[0].element).toBe("O");
    board.unmount();
  });

  it("bond tool connects two atoms", () => {
    const board = new SketchBoard();
    const canvas = makeCanvas();
    board.mount(canvas);
    board.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "O", x: 1.2, y: 0 },
      ],
      bonds: [],
    });
    board.setTool("bond");
    const p0 = board.viewport.docToScreen(0, 0);
    const p1 = board.viewport.docToScreen(1.2, 0);
    pointer("pointerdown", canvas, p0.x, p0.y);
    pointer("pointerup", canvas, p1.x, p1.y);
    expect(board.getMoleculeData().bonds).toHaveLength(1);
    board.unmount();
  });

  it("bond empty-drop creates carbon chain; one undo restores", () => {
    const board = new SketchBoard({ bondChainStep: 1.2 });
    const canvas = makeCanvas();
    board.mount(canvas);
    board.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    board.setTool("bond");
    const p0 = board.viewport.docToScreen(0, 0);
    // 2.4 doc units → 2 segments → 2 new carbons
    const pEnd = board.viewport.docToScreen(2.4, 0);
    pointer("pointerdown", canvas, p0.x, p0.y);
    pointer("pointerup", canvas, pEnd.x, pEnd.y);
    expect(board.getMoleculeData().atoms).toHaveLength(3);
    expect(board.getMoleculeData().bonds).toHaveLength(2);
    board.undo();
    expect(board.getMoleculeData().atoms).toHaveLength(1);
    expect(board.getMoleculeData().bonds).toHaveLength(0);
    board.unmount();
  });

  it("erase removes atom and incident bonds", () => {
    const board = new SketchBoard();
    const canvas = makeCanvas();
    board.mount(canvas);
    board.loadMoleculeData({
      atoms: [
        { element: "O", x: 0, y: 0 },
        { element: "H", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
    board.setTool("erase");
    const p = board.viewport.docToScreen(0, 0);
    pointer("pointerdown", canvas, p.x, p.y);
    expect(board.getMoleculeData().atoms).toHaveLength(1);
    expect(board.getMoleculeData().bonds).toHaveLength(0);
    board.unmount();
  });

  it("select toggle and Delete key", () => {
    const board = new SketchBoard();
    const canvas = makeCanvas();
    board.mount(canvas);
    board.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    board.setTool("select");
    const p = board.viewport.docToScreen(0, 0);
    pointer("pointerdown", canvas, p.x, p.y);
    canvas.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
    );
    expect(board.getMoleculeData().atoms).toHaveLength(0);
    board.unmount();
  });

  it("markDirty schedules at most one rAF; idle after paint", () => {
    const board = new SketchBoard();
    const canvas = makeCanvas();
    const rafCbs: FrameRequestCallback[] = [];
    const original = globalThis.requestAnimationFrame;
    let calls = 0;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      calls += 1;
      rafCbs.push(cb);
      return calls;
    }) as typeof requestAnimationFrame;
    try {
      board.mount(canvas);
      // flush mount paint
      while (rafCbs.length) {
        const cb = rafCbs.shift();
        cb?.(0);
      }
      calls = 0;
      board.markDirty();
      board.markDirty();
      expect(calls).toBe(1);
      expect(board.isPaintScheduled()).toBe(true);
      rafCbs[0]?.(0);
      expect(board.isPaintScheduled()).toBe(false);
    } finally {
      globalThis.requestAnimationFrame = original;
      board.unmount();
    }
  });

  it("toFrame works without mount", () => {
    const board = new SketchBoard();
    board.loadMoleculeData({
      atoms: [
        { element: "O", x: 0, y: 0 },
        { element: "H", x: 1, y: 0 },
        { element: "H", x: 0, y: 1 },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
      ],
    });
    const frame = board.toFrame();
    try {
      expect(frame.getBlock("atoms")?.copyColStr("element")).toEqual([
        "O",
        "H",
        "H",
      ]);
    } finally {
      frame.free();
    }
  });
});
