import { type Engine, NullEngine } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { frameHasStructure } from "../src/analysis/requirements";
import { MolvisApp } from "../src/app";
import {
  DataSourceModifier,
  MemoryDataSource,
} from "../src/pipeline/data_source_modifier";

/**
 * Git-like scene commit: working tree = SceneIndex; HEAD = system.frame + DS.
 */

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  return canvas;
}

function makeHeadlessApp(engine: Engine): MolvisApp {
  return new MolvisApp(makeCanvas(), { gui: false, engine });
}

function seedEditAtom(app: MolvisApp, atomId = 0, element = "C"): void {
  app.world.sceneIndex.metaRegistry.atoms.setEdit(atomId, {
    type: "atom",
    atomId,
    element,
    position: { x: 1 + atomId, y: 2, z: 3 },
  });
  app.world.sceneIndex.markAllUnsaved();
}

describe("commitScene / discardScene", () => {
  it("ac-001: commitScene dumps edit pool into system.frame + MemoryDataSource", () => {
    const engine = new NullEngine();
    const app = makeHeadlessApp(engine);
    try {
      expect(frameHasStructure(app.system.frame)).toBe(false);
      seedEditAtom(app);
      app.commitScene();

      expect(frameHasStructure(app.system.frame)).toBe(true);
      expect(app.system.frame.getBlock("atoms")?.nrows()).toBe(1);
      const sources = app.modifierPipeline
        .getModifiers()
        .filter(
          (m): m is DataSourceModifier => m instanceof DataSourceModifier,
        );
      expect(sources).toHaveLength(1);
      expect(sources[0]).toBeInstanceOf(MemoryDataSource);
      expect(app.world.sceneIndex.hasUnsavedChanges).toBe(false);
    } finally {
      app.destroy();
    }
  });

  it("ac-002: mutating the edit pool without commit leaves HEAD empty", () => {
    const engine = new NullEngine();
    const app = makeHeadlessApp(engine);
    try {
      seedEditAtom(app);
      expect(app.world.sceneIndex.hasUnsavedChanges).toBe(true);
      expect(frameHasStructure(app.system.frame)).toBe(false);
    } finally {
      app.destroy();
    }
  });

  it("subsequent commits update HEAD without duplicating data sources", () => {
    const engine = new NullEngine();
    const app = makeHeadlessApp(engine);
    try {
      seedEditAtom(app, 0, "C");
      app.commitScene();
      seedEditAtom(app, 1, "O");
      app.commitScene();

      expect(
        app.modifierPipeline
          .getModifiers()
          .filter((m) => m instanceof DataSourceModifier),
      ).toHaveLength(1);
      expect(app.system.frame.getBlock("atoms")?.nrows()).toBe(2);
    } finally {
      app.destroy();
    }
  });

  it("ac-003: discardScene restores working tree dirty flag after commit", () => {
    const engine = new NullEngine();
    const app = makeHeadlessApp(engine);
    try {
      seedEditAtom(app, 0, "C");
      app.commitScene();
      expect(app.world.sceneIndex.hasUnsavedChanges).toBe(false);

      // Dirt without changing HEAD
      seedEditAtom(app, 1, "N");
      expect(app.world.sceneIndex.hasUnsavedChanges).toBe(true);
      expect(app.system.frame.getBlock("atoms")?.nrows()).toBe(1);

      app.discardScene();
      expect(app.world.sceneIndex.hasUnsavedChanges).toBe(false);
      // HEAD still one atom
      expect(app.system.frame.getBlock("atoms")?.nrows()).toBe(1);
    } finally {
      app.destroy();
    }
  });

  it("save() aliases commitScene", () => {
    const engine = new NullEngine();
    const app = makeHeadlessApp(engine);
    try {
      seedEditAtom(app);
      app.save();
      expect(frameHasStructure(app.system.frame)).toBe(true);
    } finally {
      app.destroy();
    }
  });
});
