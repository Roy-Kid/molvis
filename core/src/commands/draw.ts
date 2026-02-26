import * as BABYLON from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import type { Box, Frame } from "@molcrafts/molrs";
import type { MolvisApp } from "../core/app";
import type { DrawAtomOptions, DrawBondOptions } from "../core/artist";
import { Command, command } from "./base";

export interface DrawAtomsOption {
  radii?: number[];
  color?: string[];
  impostor?: boolean;
  visible?: boolean[];
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
    const corners = cornersView.toCopy(); // Float32Array length 24

    // Create a root mesh for the box
    this.boxMesh = new BABYLON.Mesh("sim_box", scene);
    this.boxMesh.isPickable = false;

    const material = this.app.styleManager.getBoxMaterial();

    const edges = [
      [0, 1], [0, 3], [0, 4], // From 0
      [1, 5], [4, 5], [6, 5], // Connected to 5
      [2, 6], [2, 3], [1, 2], // From 2 or connecting
      [4, 7], [3, 7], [6, 7], // Connected to 7
    ];

    const getPoint = (idx: number) =>
      new BABYLON.Vector3(corners[idx * 3], corners[idx * 3 + 1], corners[idx * 3 + 2]);

    const l = this.box.lengths().toCopy();
    const lengths = new BABYLON.Vector3(l[0], l[1], l[2]);
    const o = this.box.origin().toCopy();
    const origin = new BABYLON.Vector3(o[0], o[1], o[2]);
    const center = origin.add(lengths.scale(0.5));

    edges.forEach(([i, j]) => {
      const p1 = getPoint(i);
      const p2 = getPoint(j);
      const diff = p2.subtract(p1);
      const len = diff.length();

      // Create Cylinder (defaults to Y axis alignment, diameter 1, height 1)
      // Diameter 1 allows easy scaling: scaling.x/z = diameter
      const cyl = BABYLON.MeshBuilder.CreateCylinder("box_edge", {
        height: len,
        diameter: 1,
        tessellation: 8
      }, scene);

      cyl.material = material;
      cyl.parent = this.boxMesh;
      cyl.isPickable = false;

      // Position at midpoint
      cyl.position = p1.add(diff.scale(0.5));

      // Rotation: Cylinder is Y-aligned. We need to rotate Y to match 'diff' direction.
      const up = new BABYLON.Vector3(0, 1, 0);
      const dir = diff.normalizeToNew();

      // Compute rotation quaternion
      const dot = BABYLON.Vector3.Dot(up, dir);

      if (dot < -0.9999) {
        // Parallel opposite - flip 180 on X
        cyl.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(Math.PI, 0, 0);
      } else if (dot > 0.9999) {
        // Parallel same - no rotation
        cyl.rotationQuaternion = BABYLON.Quaternion.Identity();
      } else {
        const axis = BABYLON.Vector3.Cross(up, dir);
        const angle = Math.acos(dot);
        cyl.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angle);
      }
    });

    const updateThickness = () => {
      if (!this.boxMesh || this.boxMesh.isDisposed()) return;
      if (!scene.activeCamera) return;

      const dist = BABYLON.Vector3.Distance(scene.activeCamera.position, center);
      let scale = dist * 0.002;
      scale = Math.max(scale, 0.015);

      const children = this.boxMesh.getChildren() as BABYLON.Mesh[];
      for (const child of children) {
        if (Math.abs(child.scaling.x - scale) > 0.0001) {
          child.scaling.x = scale;
          child.scaling.z = scale;
        }
      }
    };

    const observer = scene.onBeforeRenderObservable.add(updateThickness);
    this.boxMesh.onDisposeObservable.add(() => {
      scene.onBeforeRenderObservable.remove(observer);
    });

    // Register
    this.app.world.sceneIndex.registerBox({
      mesh: this.boxMesh,
      meta: {
        dimensions: [l[0], l[1], l[2]],
        origin: [o[0], o[1], o[2]],
      },
    });
  }

  undo(): Command {
    if (this.boxMesh) {
      this.app.world.sceneIndex.unregister(this.boxMesh.uniqueId);
      this.boxMesh.dispose();
      this.boxMesh = null;
    }
    return new NoOpCommand(this.app);
  }
} // End class

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

  async do(): Promise<void> {
    const artist = this.app.artist;

    // 1. Clear Renderer & Registry
    artist.clear();

    // 2. Render Frame via Artist
    await artist.renderFrame(this.frame, this.box, this.options);

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
  do(): void { }
  undo(): Command {
    return this;
  }
}

// DrawAtomOptions and DrawBondOptions are defined in artist.ts
export type { DrawAtomOptions, DrawBondOptions } from "../core/artist";

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
 * Command to delete an atom and connected bonds.
 * Operates on the edit pool.
 */
export class DeleteAtomCommand extends Command<void> {
  private savedAtomData: Record<string, Float32Array> | null = null;
  private savedAtomMeta: { element: string; position: { x: number; y: number; z: number } } | null = null;
  private deletedBonds: Array<{
    bondId: number;
    data: Record<string, Float32Array>;
    meta: { atomId1: number; atomId2: number; order: number; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } } | null;
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

    // Save atom buffers
    this.savedAtomData = {};
    for (const bufName of ["matrix", "instanceData", "instanceColor", "instancePickingColor"]) {
      const data = atomState.read(this.atomId, bufName);
      if (data) this.savedAtomData[bufName] = new Float32Array(data);
    }

    // Save atom metadata
    const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(this.atomId);
    if (meta) {
      this.savedAtomMeta = { element: meta.element, position: { ...meta.position } };
    }

    // Save and remove connected bonds
    const connectedBonds = this.app.world.sceneIndex.topology.getBondsForAtom(this.atomId);
    this.deletedBonds = [];

    for (const bondId of connectedBonds) {
      if (bondState) {
        const bondData: Record<string, Float32Array> = {};
        for (const bufName of ["matrix", "instanceData0", "instanceData1", "instanceColor0", "instanceColor1", "instanceSplit", "instancePickingColor"]) {
          const data = bondState.read(bondId, bufName);
          if (data) bondData[bufName] = new Float32Array(data);
        }
        const bondMeta = this.app.world.sceneIndex.metaRegistry.bonds.getMeta(bondId);
        this.deletedBonds.push({
          bondId,
          data: bondData,
          meta: bondMeta ? { atomId1: bondMeta.atomId1, atomId2: bondMeta.atomId2, order: bondMeta.order, start: { ...bondMeta.start }, end: { ...bondMeta.end } } : null,
        });
        this.app.artist.deleteBond(bondState.mesh.uniqueId, bondId);
      }
    }

    this.app.artist.deleteAtom(atomState.mesh.uniqueId, this.atomId);
  }

  undo(): Command {
    if (!this.savedAtomData || !this.savedAtomMeta) return new NoOpCommand(this.app);

    // Restore atom
    const buffers = new Map<string, Float32Array>();
    for (const [name, data] of Object.entries(this.savedAtomData)) {
      buffers.set(name, data);
    }
    this.app.world.sceneIndex.createAtom(
      { atomId: this.atomId, element: this.savedAtomMeta.element, position: this.savedAtomMeta.position },
      buffers,
    );

    // Restore bonds
    for (const { bondId, data, meta } of this.deletedBonds) {
      if (!meta) continue;
      const bondBuffers = new Map<string, Float32Array>();
      for (const [name, buf] of Object.entries(data)) {
        bondBuffers.set(name, buf);
      }
      this.app.world.sceneIndex.createBond(
        { bondId, atomId1: meta.atomId1, atomId2: meta.atomId2, order: meta.order, start: meta.start, end: meta.end },
        bondBuffers,
      );
    }

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
  private savedData: Record<string, Float32Array> | null = null;
  private savedMeta: { atomId1: number; atomId2: number; order: number; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } } | null = null;

  constructor(
    app: MolvisApp,
    private bondId: number,
  ) {
    super(app);
  }

  do(): void {
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (!bondState) return;

    // Save bond buffers and metadata before deletion
    this.savedData = {};
    for (const bufName of ["matrix", "instanceData0", "instanceData1", "instanceColor0", "instanceColor1", "instanceSplit", "instancePickingColor"]) {
      const data = bondState.read(this.bondId, bufName);
      if (data) this.savedData[bufName] = new Float32Array(data);
    }
    const meta = this.app.world.sceneIndex.metaRegistry.bonds.getMeta(this.bondId);
    if (meta) {
      this.savedMeta = { atomId1: meta.atomId1, atomId2: meta.atomId2, order: meta.order, start: { ...meta.start }, end: { ...meta.end } };
    }

    this.app.artist.deleteBond(bondState.mesh.uniqueId, this.bondId);
  }

  undo(): Command {
    if (!this.savedData || !this.savedMeta) return new NoOpCommand(this.app);

    const buffers = new Map<string, Float32Array>();
    for (const [name, data] of Object.entries(this.savedData)) {
      buffers.set(name, data);
    }
    this.app.world.sceneIndex.createBond(
      { bondId: this.bondId, ...this.savedMeta },
      buffers,
    );
    return new NoOpCommand(this.app);
  }
}
