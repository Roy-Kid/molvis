import { describe, expect, it } from "@rstest/core";
import {
  SelectionManager,
  makeSelectionKey,
  parseSelectionKey,
} from "../src/selection_manager";

// Minimal SceneIndex mock
function mockSceneIndex(atomMeta?: Map<string, any>) {
  const meta = atomMeta ?? new Map();
  return {
    getMeta(meshId: number, subIndex?: number) {
      const key =
        subIndex !== undefined ? `${meshId}:${subIndex}` : String(meshId);
      return meta.get(key) ?? null;
    },
    getSelectionKeyForAtom(atomId: number): string | null {
      // Reverse lookup: find a key whose meta has matching atomId
      for (const [key, m] of meta) {
        if (m.type === "atom" && m.atomId === atomId) return key;
      }
      return null;
    },
  } as any;
}

describe("parseSelectionKey", () => {
  it("should parse mesh-only key", () => {
    const ref = parseSelectionKey("42");
    expect(ref).toEqual({ meshId: 42 });
  });

  it("should parse mesh:sub key", () => {
    const ref = parseSelectionKey("10:5");
    expect(ref).toEqual({ meshId: 10, subIndex: 5 });
  });

  it("should return null for empty string", () => {
    expect(parseSelectionKey("")).toBeNull();
  });

  it("should return null for non-numeric mesh", () => {
    expect(parseSelectionKey("abc")).toBeNull();
  });
});

describe("makeSelectionKey", () => {
  it("should create mesh-only key", () => {
    expect(makeSelectionKey(42)).toBe("42");
  });

  it("should create mesh:sub key", () => {
    expect(makeSelectionKey(10, 5)).toBe("10:5");
  });
});

describe("SelectionManager", () => {
  describe("replace", () => {
    it("should replace atom selection", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", atoms: ["1:0", "1:1"] });
      const state = mgr.getState();
      expect(state.atoms.size).toBe(2);
      expect(state.atoms.has("1:0")).toBe(true);
      expect(state.atoms.has("1:1")).toBe(true);
    });

    it("should clear previous selection on replace", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", atoms: ["1:0", "1:1"] });
      mgr.apply({ type: "replace", atoms: ["1:2"] });
      const state = mgr.getState();
      expect(state.atoms.size).toBe(1);
      expect(state.atoms.has("1:2")).toBe(true);
    });
  });

  describe("add", () => {
    it("should add to existing selection", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", atoms: ["1:0"] });
      mgr.apply({ type: "add", atoms: ["1:1", "1:2"] });
      const state = mgr.getState();
      expect(state.atoms.size).toBe(3);
    });
  });

  describe("remove", () => {
    it("should remove from selection", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", atoms: ["1:0", "1:1", "1:2"] });
      mgr.apply({ type: "remove", atoms: ["1:1"] });
      const state = mgr.getState();
      expect(state.atoms.size).toBe(2);
      expect(state.atoms.has("1:1")).toBe(false);
    });

    it("should not error when removing non-existent key", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "remove", atoms: ["999:999"] });
      expect(mgr.getState().atoms.size).toBe(0);
    });
  });

  describe("toggle", () => {
    it("should add if not present, remove if present", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", atoms: ["1:0"] });
      mgr.apply({ type: "toggle", atoms: ["1:0", "1:1"] });
      const state = mgr.getState();
      // 1:0 was present -> removed, 1:1 was absent -> added
      expect(state.atoms.has("1:0")).toBe(false);
      expect(state.atoms.has("1:1")).toBe(true);
    });
  });

  describe("clear", () => {
    it("should clear all selections", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({
        type: "replace",
        atoms: ["1:0", "1:1"],
        bonds: ["2:0"],
      });
      mgr.apply({ type: "clear" });
      const state = mgr.getState();
      expect(state.atoms.size).toBe(0);
      expect(state.bonds.size).toBe(0);
    });
  });

  describe("bonds", () => {
    it("should support bond selection operations", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", bonds: ["2:0", "2:1"] });
      const state = mgr.getState();
      expect(state.bonds.size).toBe(2);

      mgr.apply({ type: "toggle", bonds: ["2:0", "2:2"] });
      const state2 = mgr.getState();
      expect(state2.bonds.has("2:0")).toBe(false);
      expect(state2.bonds.has("2:2")).toBe(true);
    });
  });

  describe("getState returns defensive copy", () => {
    it("mutating returned state should not affect internal state", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply({ type: "replace", atoms: ["1:0"] });
      const state = mgr.getState();
      state.atoms.add("FAKE");
      // Internal state should be unchanged
      expect(mgr.getState().atoms.has("FAKE")).toBe(false);
    });
  });

  describe("selection-change event", () => {
    it("should emit selection-change on apply", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      let emitted = false;
      mgr.on("selection-change", () => {
        emitted = true;
      });
      mgr.apply({ type: "replace", atoms: ["1:0"] });
      expect(emitted).toBe(true);
    });
  });

  describe("isSelected", () => {
    it("should return true for selected atom", () => {
      const meta = new Map([["1:0", { type: "atom", atomId: 0 }]]);
      const mgr = new SelectionManager(mockSceneIndex(meta));
      mgr.apply({ type: "replace", atoms: ["1:0"] });
      expect(mgr.isSelected("1:0")).toBe(true);
    });

    it("should return false for unselected key", () => {
      const meta = new Map([["1:0", { type: "atom", atomId: 0 }]]);
      const mgr = new SelectionManager(mockSceneIndex(meta));
      expect(mgr.isSelected("1:0")).toBe(false);
    });
  });

  describe("getSelectedAtomIds", () => {
    it("should return atom ids from selected keys", () => {
      const meta = new Map([
        ["1:0", { type: "atom", atomId: 10 }],
        ["1:1", { type: "atom", atomId: 20 }],
        ["1:2", { type: "atom", atomId: 30 }],
      ]);
      const mgr = new SelectionManager(mockSceneIndex(meta));
      mgr.apply({ type: "replace", atoms: ["1:0", "1:2"] });
      const ids = mgr.getSelectedAtomIds();
      expect(ids.has(10)).toBe(true);
      expect(ids.has(30)).toBe(true);
      expect(ids.has(20)).toBe(false);
    });
  });

  describe("expression context tracking", () => {
    it("should track expression source", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      expect(mgr.hasExpressionSelectionContext()).toBe(false);

      mgr.apply(
        { type: "replace", atoms: ["1:0"] },
        { source: "expression", expression: "element == 'C'" },
      );
      expect(mgr.hasExpressionSelectionContext()).toBe(true);
    });

    it("should reset to manual on clear", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply(
        { type: "replace", atoms: ["1:0"] },
        { source: "expression", expression: "element == 'C'" },
      );
      mgr.apply({ type: "clear" });
      expect(mgr.hasExpressionSelectionContext()).toBe(false);
    });

    it("should reset to manual on manual operation", () => {
      const mgr = new SelectionManager(mockSceneIndex());
      mgr.apply(
        { type: "replace", atoms: ["1:0"] },
        { source: "expression", expression: "element == 'C'" },
      );
      mgr.apply({ type: "add", atoms: ["1:1"] });
      expect(mgr.hasExpressionSelectionContext()).toBe(false);
    });
  });

  describe("selectAtomsByIds", () => {
    it("should add atoms by their logical ids", () => {
      const meta = new Map([
        ["1:0", { type: "atom", atomId: 100 }],
        ["1:1", { type: "atom", atomId: 200 }],
      ]);
      const mgr = new SelectionManager(mockSceneIndex(meta));
      mgr.selectAtomsByIds([100, 200]);
      const state = mgr.getState();
      expect(state.atoms.size).toBe(2);
    });
  });

  describe("replaceAtomsByIds", () => {
    it("should replace selection with atoms by logical ids", () => {
      const meta = new Map([
        ["1:0", { type: "atom", atomId: 10 }],
        ["1:1", { type: "atom", atomId: 20 }],
      ]);
      const mgr = new SelectionManager(mockSceneIndex(meta));
      mgr.apply({ type: "replace", atoms: ["1:0"] });
      mgr.replaceAtomsByIds([20]);
      const state = mgr.getState();
      expect(state.atoms.has("1:0")).toBe(false);
      expect(state.atoms.has("1:1")).toBe(true);
    });
  });
});
