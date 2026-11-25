import { describe, expect, it } from "@rstest/core";
import { SketchBoard } from "../../src/board/sketch_board";

describe("SketchBoard draw verbs", () => {
  it("drawAtom returns the new index and undo removes it", () => {
    const board = new SketchBoard();
    const index = board.drawAtom({ element: "O", x: 1, y: 2, charge: 0 });
    expect(index).toBe(0);
    expect(board.getMoleculeData().atoms[0]).toMatchObject({
      element: "O",
      x: 1,
      y: 2,
    });
    board.undo();
    expect(board.getMoleculeData()).toEqual({ atoms: [], bonds: [] });
  });

  it("drawBond connects two drawn atoms and undo removes the bond", () => {
    const board = new SketchBoard();
    const i = board.drawAtom({ element: "C", x: 0, y: 0 });
    const j = board.drawAtom({ element: "C", x: 1, y: 0 });
    const bond = board.drawBond({ i, j, order: 2, stereo: "none" });
    expect(bond).toBe(0);
    expect(board.getMoleculeData().bonds).toEqual([
      { i: 0, j: 1, order: 2, stereo: "none" },
    ]);
    board.undo();
    expect(board.getMoleculeData().bonds).toEqual([]);
  });

  it("edits atom display text without changing its element or bonds", () => {
    const board = new SketchBoard();
    board.loadSketchDocument({
      atoms: [
        { element: "N", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
      annotations: [],
    });
    const before = board.getSketchDocument();
    board.setAtomLabelDraft({ index: 0, text: "N draft" });
    expect(board.getSketchDocument()).toEqual(before);
    expect(board.toSvg()).not.toContain("N draft");
    board.setAtomLabelDraft(null);

    board.updateAtomLabel(0, "N<&");
    const edited = board.getSketchDocument();
    expect(edited.atoms[0]).toEqual({ ...before.atoms[0], label: "N<&" });
    expect(edited.bonds).toEqual(before.bonds);
    expect(board.toSvg()).toContain("N&lt;&amp;");
    board.undo();
    expect(board.getSketchDocument()).toEqual(before);
    board.redo();
    expect(board.getSketchDocument()).toEqual(edited);
    board.loadSketchDocument(edited);
    expect(board.getSketchDocument()).toEqual(edited);
    board.updateAtomLabel(0, " ");
    expect(board.getSketchDocument()).toEqual(before);
  });

  it("drawChain places carbon bonds of order 1 and ignores the toolbar bond order", () => {
    const board = new SketchBoard({ bondChainStep: 1 });
    board.setBondOrder(2);
    board.drawChain(0, 0, 3, 0);
    const data = board.getMoleculeData();
    expect(data.atoms.length).toBeGreaterThan(1);
    expect(data.atoms.every((atom) => atom.element === "C")).toBe(true);
    expect(data.bonds.every((bond) => bond.order === 1)).toBe(true);
    expect(data.atoms.every((atom) => atom.color === undefined)).toBe(true);
    expect(data.bonds.every((bond) => bond.color === undefined)).toBe(true);
    board.undo();
    expect(board.getMoleculeData()).toEqual({ atoms: [], bonds: [] });
  });

  it("drawChain from a start atom ignores x0 and y0", () => {
    const board = new SketchBoard({ bondChainStep: 1 });
    const start = board.drawAtom({ element: "N", x: 0, y: 0 });
    board.drawChain(99, 99, 3, 0, start);
    const data = board.getMoleculeData();
    expect(data.atoms[0]).toMatchObject({ element: "N", x: 0, y: 0 });
    expect(data.atoms.slice(1).every((atom) => atom.element === "C")).toBe(
      true,
    );
    expect(data.bonds.every((bond) => bond.order === 1)).toBe(true);
  });

  it("deleteSelection removes the selected atom as one undo step", () => {
    const board = new SketchBoard();
    board.drawAtom({ element: "C", x: 0, y: 0 });
    board.drawAtom({ element: "O", x: 1, y: 0 });
    board.replaceSelectedAtoms([1]);
    board.deleteSelection();
    expect(board.getMoleculeData().atoms).toEqual([
      { element: "C", x: 0, y: 0 },
    ]);
    expect(board.selectedAtomIndices()).toEqual([]);
    board.undo();
    expect(board.getMoleculeData().atoms).toHaveLength(2);
  });
});

describe("Interactive figure placement", () => {
  it("selects the new figure after drawing and keeps locked drawing active", () => {
    const board = new SketchBoard();
    const shape = { kind: "ellipse" as const, x: 1, y: 2, width: 2, height: 2 };
    board.setTool("annotation");
    board.placeAnnotation(shape);
    expect(board.getState()).toMatchObject({
      tool: "select",
      selectedAnnotationCount: 1,
    });
    expect(board.getSelectedAnnotation()?.item).toMatchObject(shape);
    board.setTool("annotation");
    board.setFigureToolLocked(true);
    board.placeAnnotation({ ...shape, x: 5 });
    expect(board.getState()).toMatchObject({
      tool: "annotation",
      figureToolLocked: true,
      selectedAnnotationCount: 0,
    });
    board.undo();
    expect(board.getSketchDocument().annotations).toHaveLength(1);
    board.setFigureToolLocked(false);
    expect(board.getTool()).toBe("select");
  });

  it("leaves an unfinished text draft out of history, documents and export", () => {
    const board = new SketchBoard();
    const text = {
      kind: "text" as const,
      x: 1,
      y: 2,
      label: { text: "Draft", size: 0.6 },
    };
    board.setAnnotationDraft({ item: text });
    expect(board.getState().canUndo).toBe(false);
    expect(board.getSketchDocument().annotations).toEqual([]);
    expect(board.toSvg()).not.toContain("Draft");
    board.setAnnotationDraft(null);
    board.placeAnnotation(text);
    expect(board.toSvg()).toContain("Draft");
    board.undo();
    expect(board.getSketchDocument().annotations).toEqual([]);
  });
});

describe("Sketch figure documents", () => {
  it("picks rotated bracket edges and saves the angle as an undoable edit", () => {
    const board = new SketchBoard();
    board.setTool("select");
    const bracket = {
      kind: "bracket" as const,
      variant: "round" as const,
      x: 0,
      y: 0,
      width: 6,
      height: 2,
      cornerLabels: { bottomRight: { text: "7", size: 1 } },
    };
    const index = board.drawAnnotation(bracket);
    const leftEdge = { x: -3, y: 0 };
    const topEdge = { x: 0, y: 3 };
    const hit = { kind: "annotation", index };
    expect(board.hitAt(leftEdge)).toEqual(hit);
    expect(board.hitAt(topEdge)).toEqual({ kind: "none" });
    board.updateAnnotation(index, { ...bracket, rotation: 450 });
    expect(board.hitAt(leftEdge)).toEqual({ kind: "none" });
    expect(board.hitAt(topEdge)).toEqual(hit);
    expect(board.hitAt({ x: -1.5, y: -3.16 })).toEqual(hit);
    const saved = board.getSketchDocument();
    expect(saved.annotations[index]).toMatchObject({ rotation: 90 });
    board.undo();
    expect(board.hitAt(leftEdge)).toEqual(hit);
    board.redo();
    expect(board.hitAt(topEdge)).toEqual(hit);
    board.loadSketchDocument(saved);
    expect(board.hitAt(topEdge)).toEqual(hit);
    expect(() =>
      board.updateAnnotation(index, { ...bracket, rotation: Infinity }),
    ).toThrow(/rotation/);
    expect(board.getSketchDocument()).toEqual(saved);
  });

  it("loads label-only brackets and picks an individual corner label", () => {
    const board = new SketchBoard();
    const bracket = {
      kind: "bracket" as const,
      variant: "none" as const,
      x: 0,
      y: 0,
      width: 4,
      height: 3,
      cornerLabels: { topLeft: { text: "ABC", size: 1 } },
    };
    board.loadSketchDocument({ atoms: [], bonds: [], annotations: [bracket] });
    board.setTool("select");

    expect(board.getSketchDocument().annotations[0]).toMatchObject(bracket);
    expect(board.hitAt({ x: -3, y: 1.5 })).toEqual({
      kind: "annotation",
      index: 0,
    });
    board.updateAnnotation(0, { ...bracket, cornerLabels: {} });
    expect(board.hitAt({ x: -3, y: 1.5 })).toEqual({ kind: "none" });
    board.undo();
    expect(board.hitAt({ x: -3, y: 1.5 })).toEqual({
      kind: "annotation",
      index: 0,
    });
  });

  it("clears the structure and annotations in one undo step", () => {
    const board = new SketchBoard();
    board.drawAtom({ element: "O", x: 0, y: 0 });
    board.drawAnnotation({
      kind: "text",
      x: 2,
      y: 1,
      label: { text: "PEGM", size: 0.6 },
    });
    const drawing = board.getSketchDocument();
    expect(board.getMoleculeData()).toEqual({
      atoms: drawing.atoms,
      bonds: [],
    });
    board.clear();
    expect(board.hasContent()).toBe(false);
    board.undo();
    expect(board.getSketchDocument()).toEqual(drawing);
    board.redo();
    expect(board.hasContent()).toBe(false);
  });

  it("reopens a drawing atomically and undoes a subsequent replacement", () => {
    const board = new SketchBoard();
    const drawing = {
      atoms: [{ element: "N", x: 0, y: 0 }],
      bonds: [],
      annotations: [
        {
          kind: "ellipse" as const,
          x: 2,
          y: 0,
          width: 1,
          height: 1,
          fill: "#117733",
        },
      ],
    };
    board.loadSketchDocument(drawing);
    const before = board.getSketchDocument();
    drawing.annotations[0].x = 8;
    expect(board.getSketchDocument()).toEqual(before);
    expect(() =>
      board.updateSketchDocument({
        atoms: [],
        bonds: [],
        annotations: [{ ...drawing.annotations[0], width: 0 }],
      }),
    ).toThrow(/width and height/);
    expect(board.getSketchDocument()).toEqual(before);
    expect(board.getState().canUndo).toBe(false);
    board.updateSketchDocument({
      atoms: [],
      bonds: [],
      annotations: drawing.annotations,
    });
    expect(board.getState()).toMatchObject({
      atomCount: 0,
      annotationCount: 1,
      canUndo: true,
    });
    board.undo();
    expect(board.getSketchDocument()).toEqual(before);
  });

  it("fits artwork outside the molecular graph in a narrow viewport", () => {
    const board = new SketchBoard();
    board.viewport.resize(240, 160, 1);
    board.drawAtom({ element: "O", x: 0, y: 0 });
    board.drawAnnotation({
      kind: "rectangle",
      x: 40,
      y: 0,
      width: 10,
      height: 4,
    });
    board.fitToView();
    expect(board.viewport.docToScreen(0, 0).x).toBeGreaterThan(40);
    expect(board.viewport.docToScreen(45, 0).x).toBeLessThan(200);
  });
});
