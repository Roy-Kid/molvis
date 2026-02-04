import * as BABYLON from "@babylonjs/core"; // Used for mesh types
import { Vector3 } from "@babylonjs/core";
import type { Box, Frame } from "molwasm";
import type { MolvisApp } from "../core/app";
import { Command, command } from "./base";

export interface DrawAtomsOption {
  radii?: number[];
  color?: string[];
  impostor?: boolean;
}

export interface DrawBondsOption {
  radii?: number;
  impostor?: boolean;
  bicolor?: boolean;
}

export interface DrawFrameOption {
  atoms?: DrawAtomsOption;
  bonds?: DrawBondsOption;
}

/**
 * Command to draw a simulation box (wireframe)
 */
@command("draw_box")
export class DrawBoxCommand extends Command<void> {
  private boxMesh: BABYLON.Mesh | null = null;
  private box: Box;

  constructor(app: MolvisApp, args: { box: Box; options?: unknown }) {
    super(app);
    this.box = args.box;
  }

  do(): void {
    const scene = this.app.world.scene;

    // Clear existing box
    const existingBox = scene.getMeshByName("sim_box");
    if (existingBox) {
      this.app.world.sceneIndex.unregister(existingBox.uniqueId);
      existingBox.dispose();
    }

    // Get corners from molrs Box
    const cornersView = this.box.get_corners();
    const corners = cornersView.to_js_array(); // Float32Array length 24

    // Create a root mesh for the box
    this.boxMesh = new BABYLON.Mesh("sim_box", scene);

    // Styling
    const radius = 0.01; // Tube radius
    const material = this.app.styleManager.getBoxMaterial();

    this.createEdges(corners, radius, material, scene);

    // Register
    this.app.world.sceneIndex.registerBox({
      mesh: this.boxMesh,
      meta: {
        dimensions: (() => {
          const l = this.box.lengths().to_js_array();
          return [l[0], l[1], l[2]] as [number, number, number];
        })(),
        origin: (() => {
          const o = this.box.origin().to_js_array();
          return [o[0], o[1], o[2]] as [number, number, number];
        })(),
      },
    });
  }

  private createEdges(
    corners: Float32Array,
    radius: number,
    material: BABYLON.Material,
    scene: BABYLON.Scene,
  ) {
    // Pairs of indices defining the 12 edges
    const edges = [
      [0, 1],
      [0, 3],
      [0, 4],
      [1, 5],
      [4, 5],
      [6, 5],
      [2, 6],
      [2, 3],
      [1, 2],
      [4, 7],
      [3, 7],
      [6, 7],
    ];

    // Helper to get Vector3 from flat array
    const getPoint = (idx: number) =>
      new Vector3(corners[idx * 3], corners[idx * 3 + 1], corners[idx * 3 + 2]);

    for (const [i, j] of edges) {
      const p1 = getPoint(i);
      const p2 = getPoint(j);

      const tube = BABYLON.MeshBuilder.CreateTube(
        "box_edge",
        {
          path: [p1, p2],
          radius: radius,
          tessellation: 8,
          cap: BABYLON.Mesh.CAP_ALL,
        },
        scene,
      );

      tube.material = material;
      tube.parent = this.boxMesh;
      tube.isPickable = false;
    }
  }

  undo(): Command {
    if (this.boxMesh) {
      this.app.world.sceneIndex.unregister(this.boxMesh.uniqueId);
      this.boxMesh.dispose();
      this.boxMesh = null;
    }
    return new NoOpCommand(this.app);
  }
}

/**
 * Command to draw atoms and bonds using Thin Instances via Artist
 */
@command("draw_frame")
export class DrawFrameCommand extends Command<void> {
  private frame: Frame;
  private box?: Box;
  private options?: DrawFrameOption;

  constructor(
    app: MolvisApp,
    args: {
      frame: Frame;
      box?: Box;
      options?: DrawFrameOption;
    },
  ) {
    super(app);
    this.frame = args.frame;
    this.box = args.box;
    this.options = args.options;
  }

  do(): void {
    const artist = this.app.artist;

    // 1. Clear Renderer & Registry
    artist.clear();

    // 2. Render Frame via Artist
    artist.renderFrame(this.frame, this.box, this.options);

    // 3. Draw Box (Delegate to DrawBoxCommand)
    if (this.box) {
      this.app.execute("draw_box", { box: this.box });
    }
  }

  undo(): Command {
    this.app.artist.clear();
    return new NoOpCommand(this.app);
  }
}

/**
 * No-op command
 */
class NoOpCommand extends Command<void> {
  do(): void {}
  undo(): Command {
    return this;
  }
}

/**
 * Command to draw an atom
 */
export interface DrawAtomOptions {
  element: string;
  name?: string;
  radius?: number;
  color?: string;
  atomId?: number;
}

/**
 * Options for drawing a bond
 */
export interface DrawBondOptions {
  order?: number;
  radius?: number;
  color?: string;
  atomId1?: number;
  atomId2?: number;
  bondId?: number;
}

/**
 * Command to draw an atom in Edit mode.
 */
export class DrawAtomCommand extends Command<{ atomId: number }> {
  private atomId: number;
  private executed = false;
  private meshId = 0;

  constructor(
    app: MolvisApp,
    private position: Vector3,
    private options: DrawAtomOptions,
  ) {
    super(app);
    this.atomId =
      options.atomId ?? (app.world.sceneIndex.getNextAtomId?.() || 0);
  }

  do(): { atomId: number } {
    const result = this.app.artist.drawAtom(this.position, {
      ...this.options,
      atomId: this.atomId,
    });
    this.atomId = result.atomId;
    this.meshId = result.meshId;
    this.executed = true;
    return { atomId: this.atomId };
  }

  undo(): Command {
    if (!this.executed) {
      throw new Error("Cannot undo DrawAtomCommand: not executed");
    }
    if (this.meshId) {
      this.app.artist.deleteAtom(this.meshId, this.atomId);
    }
    this.executed = false;
    return new NoOpCommand(this.app);
  }
}

/**
 * Command to delete an edit-mode atom and connected bonds.
 */
export class DeleteAtomCommand extends Command<void> {
  private savedAtomData: Record<string, Float32Array> | null = null;
  // We would need robust state restoration for true undo, which might be out of scope for this refactor.
  // The previous implementation stored data buffers.
  // Since Artist is high level, maybe it should support "restoreAtom(data)"?
  // For now, I will keep the previous logic of manual data backup if possible, or simplifying.
  // The previous code accessed SceneIndex directly to backup data. That is still valid as Command is close to app.
  // However, Artist is "Unified Graphics Engine".
  // Ideally Command asks Artist to delete and Artist returns the deleted data?
  // Current Artist.deleteAtom returns void.
  // I'll stick to SceneIndex access for data backup to minimize changes to existing logic, but delegate deletion to Artist.

  private deletedBonds: Array<{
    bondId: number;
    data: Record<string, Float32Array>;
  }> = [];

  constructor(
    app: MolvisApp,
    private atomId: number,
  ) {
    super(app);
  }

  do(): void {
    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    if (!atomState) return;
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();

    // Save atom data (Keep using SceneIndex for deep state access if not exposed by Artist)
    // Or better: Artist should expose `getAtomData(id)`?
    // Let's rely on SceneIndex for data retrieval as it is the store.
    this.savedAtomData = {};
    for (const bufName of [
      "matrix",
      "instanceData",
      "instanceColor",
      "instancePickingColor",
    ]) {
      const data = atomState.read(this.atomId, bufName);
      if (data) this.savedAtomData[bufName] = new Float32Array(data);
    }

    // Find and remove connected bonds
    const connectedBonds = this.app.world.sceneIndex.topology.getBondsForAtom(
      this.atomId,
    );
    this.deletedBonds = [];

    for (const bondId of connectedBonds) {
      if (bondState) {
        const bondData: Record<string, Float32Array> = {};
        for (const bufName of [
          "matrix",
          "instanceData0",
          "instanceData1",
          "instanceColor0",
          "instanceColor1",
          "instanceSplit",
          "instancePickingColor",
        ]) {
          const data = bondState.read(bondId, bufName);
          if (data) bondData[bufName] = new Float32Array(data);
        }
        this.deletedBonds.push({ bondId, data: bondData });
        this.app.artist.deleteBond(bondState.mesh.uniqueId, bondId);
      }
    }

    // Remove atom
    this.app.artist.deleteAtom(atomState.mesh.uniqueId, this.atomId);
  }

  undo(): Command {
    // Restore implementation would go here (using Artist.restoreAtom/Bond if available, or direct SceneIndex)
    // Previous code just returned NoOpCommand. Keeping that.
    return new NoOpCommand(this.app);
  }
}

/**
 * Command to draw a bond in Edit mode.
 */
export class DrawBondCommand extends Command<{ bondId: number }> {
  private bondId: number;
  private executed = false;
  private meshId = 0;

  constructor(
    app: MolvisApp,
    private startPos: Vector3,
    private endPos: Vector3,
    private options: DrawBondOptions,
  ) {
    super(app);
    this.bondId =
      options.bondId ?? (app.world.sceneIndex.getNextBondId?.() || 0);
  }

  do(): { bondId: number } {
    const result = this.app.artist.drawBond(this.startPos, this.endPos, {
      ...this.options,
      bondId: this.bondId,
    });
    this.bondId = result.bondId;
    this.meshId = result.meshId;
    this.executed = true;
    return { bondId: this.bondId };
  }

  undo(): Command {
    if (!this.executed) {
      throw new Error("Cannot undo DrawBondCommand: not executed");
    }
    if (this.meshId) {
      this.app.artist.deleteBond(this.meshId, this.bondId);
    }
    this.executed = false;
    return new NoOpCommand(this.app);
  }
}

/**
 * Command to delete an edit-mode bond.
 */
export class DeleteBondCommand extends Command<void> {
  constructor(
    app: MolvisApp,
    private bondId: number,
  ) {
    super(app);
  }

  do(): void {
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (!bondState) return;
    this.app.artist.deleteBond(bondState.mesh.uniqueId, this.bondId);
  }

  undo(): Command {
    return new NoOpCommand(this.app);
  }
}
