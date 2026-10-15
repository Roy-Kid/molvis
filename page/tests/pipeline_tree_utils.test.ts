import {
  type Modifier,
  ModifierCapability,
  Session,
} from "@molcrafts/molvis-stage";
import { describe, expect, it } from "@rstest/core";
import {
  buildTree,
  getAvailableParents,
  getDescendants,
} from "../src/ui/modes/view/pipeline/tree_utils";

function mod(id: string, sourceOwnerId: string | null = null): Modifier {
  return {
    id,
    name: id,
    enabled: true,
    capabilities: new Set(),
    selectionScopeId: null,
    sourceOwnerId,
    highlightColor: null,
    matches: () => false,
    isApplicable: () => true,
    validate: () => ({ valid: true }),
    apply: (frame) => frame,
    getCacheKey: () => id,
    applyVisibility: () => {},
  };
}

describe("pipeline tree utils", () => {
  it("groups children by sourceOwnerId only", () => {
    const source = mod("source");
    const child = mod("draw", "source");
    const scoped = mod("hide");
    scoped.selectionScopeId = "select";

    const tree = buildTree([source, child, scoped]);

    expect(tree.map((node) => node.entry.id)).toEqual(["source", "hide"]);
    expect(tree[0].children.map((node) => node.entry.id)).toEqual(["draw"]);
  });

  it("does not ask a session for selection capabilities", () => {
    const session = new Session("Alpha", "ws://127.0.0.1/ws", () => {});
    const producer = mod("Bravo");
    (producer.capabilities as Set<ModifierCapability>).add(
      ModifierCapability.ProducesSelection,
    );

    const parents = getAvailableParents("hide", [
      session,
      producer,
      mod("hide"),
    ]);

    expect(parents.map((parent) => parent.id)).toEqual(["Bravo"]);
  });

  it("collects source-owned descendants", () => {
    const modifiers = [
      mod("source"),
      mod("draw", "source"),
      mod("leaf", "draw"),
    ];
    expect(getDescendants("source", modifiers).map((m) => m.id)).toEqual([
      "draw",
      "leaf",
    ]);
  });
});
