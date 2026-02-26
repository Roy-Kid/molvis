import {
  Color3,
  Engine,
  type Mesh,
  MeshBuilder,
  type LinesMesh,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Block, Box, Frame } from "@molcrafts/molrs";
import type { MolvisApp } from "./app";
import { encodePickingColor } from "./picker";

import { SliceModifier } from "../modifiers/SliceModifier";
import "./shaders/impostor";

/**
 * Artist options for initialization
 */
export interface ArtistOptions {
  app: MolvisApp;
}

/**
 * Options for drawing a single atom
 */
export interface DrawAtomOptions {
  element: string;
  name?: string;
  radius?: number;
  color?: string;
  atomId?: number;
}

/**
 * Options for drawing a single bond
 */
export interface DrawBondOptions {
  order?: number;
  radius?: number;
  atomId1?: number;
  atomId2?: number;
  bondId?: number;
}

/**
 * Artist class - Unified Graphics Engine
 *
 * Responsibilities:
 * - Owns rendering meshes (atom_base_renderer, bond_base_renderer).
 * - Manages SceneIndex and Impostor Pools.
 * - Provides high-level drawing API (drawAtom, drawBond, renderFrame).
 * - Stateless regarding interaction history.
 */
export class Artist {
  private app: MolvisApp;

  // The singleton meshes (View Mode / Base)
  public atomMesh: Mesh;
  public bondMesh: Mesh;

  constructor(options: ArtistOptions) {
    this.app = options.app;
    const scene = this.app.world.scene;

    // 1. Create Base Meshes (Hidden planes for thin instances)
    this.atomMesh = this.createBaseMesh(
      "atom_base_renderer",
      "atomMat_impostor",
      scene,
    );
    this.bondMesh = this.createBaseMesh(
      "bond_base_renderer",
      "bondMat_impostor",
      scene,
    );
  }

  /**
   * Clear all rendered data.
   * Meshes are kept hidden and disabled until renderFrame populates them.
   */
  public clear(): void {
    const scene = this.app.world.scene;

    // Hide and dispose old meshes
    if (this.atomMesh) {
      this.atomMesh.isVisible = false;
      this.atomMesh.setEnabled(false);
      this.atomMesh.dispose();
    }
    if (this.bondMesh) {
      this.bondMesh.isVisible = false;
      this.bondMesh.setEnabled(false);
      this.bondMesh.dispose();
    }

    // Clear scene index
    this.app.world.sceneIndex.clear();

    // Recreate base meshes (disabled by default)
    this.atomMesh = this.createBaseMesh(
      "atom_base_renderer",
      "atomMat_impostor",
      scene,
    );
    this.bondMesh = this.createBaseMesh(
      "bond_base_renderer",
      "bondMat_impostor",
      scene,
    );

    // Keep meshes disabled until data is ready
    this.atomMesh.setEnabled(false);
    this.bondMesh.setEnabled(false);
  }

  // ============ Frame Rendering (Bulk) ============

  /**
   * Ensure shader variants used by thin instances are fully compiled before enabling meshes.
   */
  private async waitForMaterials(includeBonds: boolean): Promise<void> {
    const compileOne = async (
      mesh: Mesh,
      material: ShaderMaterial | null,
      materialLabel: string,
    ) => {
      if (!material) {
        throw new Error(`Missing shader material for ${materialLabel}`);
      }

      // Check the exact variant used by this renderer (instanced / thin-instanced path).
      if (material.isReady(mesh, true)) return;

      await material.forceCompilationAsync(mesh, { useInstances: true });

      if (!material.isReady(mesh, true)) {
        throw new Error(
          `Shader material "${material.name}" for ${materialLabel} is not ready after compilation`,
        );
      }
    };

    const tasks: Promise<void>[] = [
      compileOne(
        this.atomMesh,
        this.atomMesh.material as ShaderMaterial | null,
        "atoms",
      ),
    ];

    if (includeBonds) {
      tasks.push(
        compileOne(
          this.bondMesh,
          this.bondMesh.material as ShaderMaterial | null,
          "bonds",
        ),
      );
    }

    await Promise.all(tasks);
  }

  /**
   * Render a Frame into SceneIndex.
   * Computes render buffers and registers everything.
   */
  public async renderFrame(
    frame: Frame,
    _box?: Box,
    options?: {
      atoms?: { radii?: number[]; visible?: boolean[]; impostor?: boolean };
      bonds?: { radii?: number; impostor?: boolean };
    },
  ): Promise<void> {
    const sceneIndex = this.app.world.sceneIndex;
    const atomsBlock = frame.getBlock("atoms");
    const bondsBlock = frame.getBlock("bonds");

    // --- ATOMS ---
    if (!atomsBlock || atomsBlock.nrows() === 0) return;
    const atomCount = atomsBlock.nrows();
    const xCoords = atomsBlock.getColumnF32("x");
    const yCoords = atomsBlock.getColumnF32("y");
    const zCoords = atomsBlock.getColumnF32("z");
    const elementsColumn = atomsBlock.getColumnStrings("element");
    const typesColumn = atomsBlock.getColumnStrings("type");

    if (!elementsColumn && !typesColumn) throw new Error("No elements or types column found");
    if (!xCoords || !yCoords || !zCoords) throw new Error("No coordinates column");

    // Buffers for Atom Pool
    const atomMatrix = new Float32Array(atomCount * 16);
    const atomData = new Float32Array(atomCount * 4);
    const atomColor = new Float32Array(atomCount * 4);
    const atomPick = new Float32Array(atomCount * 4);

    const styleManager = this.app.styleManager;
    const styleCache = new Map<
      string,
      { r: number; g: number; b: number; a: number; radius: number }
    >();
    const customRadii = options?.atoms?.radii;

    // Check for visibility options
    const visibleArr = options?.atoms?.visible;

    // Helper to check visibility
    const isVisible = (i: number) => {
      if (visibleArr) return visibleArr[i];
      return true;
    };

    for (let i = 0; i < atomCount; i++) {
      // Logic: Prefer element. If missing, use type.
      // If we use type, we use a different coloring strategy (hash)
      // If element is present, we use CPK.

      let style: { r: number; g: number; b: number; a: number; radius: number };

      if (elementsColumn) {
        const element = elementsColumn[i];
        let cached = styleCache.get(element);
        if (!cached) {
          const s = styleManager.getAtomStyle(element);
          const c = Color3.FromHexString(s.color).toLinearSpace();
          cached = { r: c.r, g: c.g, b: c.b, a: s.alpha ?? 1.0, radius: s.radius };
          styleCache.set(element, cached);
        }
        style = cached;
      } else {
        // Fallback to type
        const type = typesColumn ? typesColumn[i] : "UNK";
        let cached = styleCache.get("TYPE:" + type);
        if (!cached) {
          // DELEGATE TO STYLE MANAGER
          const s = styleManager.getTypeStyle(type);
          const c = Color3.FromHexString(s.color).toLinearSpace();
          cached = { r: c.r, g: c.g, b: c.b, a: 1.0, radius: s.radius };
          styleCache.set("TYPE:" + type, cached);
        }
        style = cached;
      }

      const radius = customRadii?.[i] ?? style.radius;
      const scale = radius * 2;

      const matOffset = i * 16;
      const idx4 = i * 4;

      // Matrix
      atomMatrix[matOffset + 0] = scale;
      atomMatrix[matOffset + 5] = scale;
      atomMatrix[matOffset + 10] = scale;
      atomMatrix[matOffset + 15] = 1;
      atomMatrix[matOffset + 12] = xCoords[i];
      atomMatrix[matOffset + 13] = yCoords[i];
      atomMatrix[matOffset + 14] = zCoords[i];

      // Data
      atomData[idx4 + 0] = xCoords[i];
      atomData[idx4 + 1] = yCoords[i];
      atomData[idx4 + 2] = zCoords[i];
      atomData[idx4 + 3] = radius;

      atomColor[idx4 + 0] = style.r;
      atomColor[idx4 + 1] = style.g;
      atomColor[idx4 + 2] = style.b;
      atomColor[idx4 + 3] = isVisible(i) ? style.a : 0.2;

      const pCol = encodePickingColor(this.atomMesh.uniqueId, i);
      atomPick[idx4 + 0] = pCol[0];
      atomPick[idx4 + 1] = pCol[1];
      atomPick[idx4 + 2] = pCol[2];
      atomPick[idx4 + 3] = pCol[3];
    }

    const atomBuffers = new Map<string, Float32Array>();
    atomBuffers.set("matrix", atomMatrix);
    atomBuffers.set("instanceData", atomData);
    atomBuffers.set("instanceColor", atomColor);
    atomBuffers.set("instancePickingColor", atomPick);

    // --- BONDS ---
    let bondBuffers: Map<string, Float32Array> | undefined;
    let bondBlockObj: Block | undefined = undefined;

    if (bondsBlock && bondsBlock.nrows() > 0) {
      bondBlockObj = bondsBlock;
      const bondCount = bondsBlock.nrows();
      const iAtoms = bondsBlock.getColumnU32("i");
      const jAtoms = bondsBlock.getColumnU32("j");

      if (iAtoms && jAtoms) {
        const bondMatrix = new Float32Array(bondCount * 16);
        const bondData0 = new Float32Array(bondCount * 4);
        const bondData1 = new Float32Array(bondCount * 4);
        const bondCol0 = new Float32Array(bondCount * 4);
        const bondCol1 = new Float32Array(bondCount * 4);
        const bondSplit = new Float32Array(bondCount * 4);
        const bondPick = new Float32Array(bondCount * 4);

        const bondRadius = options?.bonds?.radii ?? 0.1;

        const atomColors = new Float32Array(atomCount * 4);
        for (let i = 0; i < atomCount; i++) {
          atomColors[i * 4 + 0] = atomColor[i * 4 + 0];
          atomColors[i * 4 + 1] = atomColor[i * 4 + 1];
          atomColors[i * 4 + 2] = atomColor[i * 4 + 2];
          atomColors[i * 4 + 3] = atomColor[i * 4 + 3];
        }

        const TMP_VEC_1 = new Vector3();
        const TMP_VEC_2 = new Vector3();
        const TMP_CENTER = new Vector3();
        const TMP_DIR = new Vector3();

        for (let b = 0; b < bondCount; b++) {
          const i = iAtoms[b];
          const j = jAtoms[b];

          const visible = isVisible(i) && isVisible(j);

          TMP_VEC_1.set(xCoords[i], yCoords[i], zCoords[i]);
          TMP_VEC_2.set(xCoords[j], yCoords[j], zCoords[j]);

          // center = (p1 + p2) * 0.5
          TMP_CENTER.copyFrom(TMP_VEC_1).addInPlace(TMP_VEC_2).scaleInPlace(0.5);

          // direction
          TMP_DIR.copyFrom(TMP_VEC_2).subtractInPlace(TMP_VEC_1);
          const dist = TMP_DIR.length();
          if (dist > 1e-8) TMP_DIR.scaleInPlace(1 / dist);
          else TMP_DIR.set(0, 1, 0);

          const scale = dist + bondRadius * 2;
          const matOffset = b * 16;
          const idx4 = b * 4;

          // Matrix
          bondMatrix[matOffset + 0] = scale;
          bondMatrix[matOffset + 5] = scale;
          bondMatrix[matOffset + 10] = scale;
          bondMatrix[matOffset + 15] = 1;
          bondMatrix[matOffset + 12] = TMP_CENTER.x;
          bondMatrix[matOffset + 13] = TMP_CENTER.y;
          bondMatrix[matOffset + 14] = TMP_CENTER.z;

          // Data0 (center, radius)
          bondData0[idx4 + 0] = TMP_CENTER.x;
          bondData0[idx4 + 1] = TMP_CENTER.y;
          bondData0[idx4 + 2] = TMP_CENTER.z;
          bondData0[idx4 + 3] = bondRadius;

          // Data1 (dir, length)
          bondData1[idx4 + 0] = TMP_DIR.x;
          bondData1[idx4 + 1] = TMP_DIR.y;
          bondData1[idx4 + 2] = TMP_DIR.z;
          bondData1[idx4 + 3] = dist;

          // Split (simplified)
          bondSplit[idx4 + 0] = 0;

          // Colors - grab directly from atom colors we calculated
          const alpha = visible ? 1.0 : 0.2;

          bondCol0[idx4 + 0] = atomColors[i * 4 + 0];
          bondCol0[idx4 + 1] = atomColors[i * 4 + 1];
          bondCol0[idx4 + 2] = atomColors[i * 4 + 2];
          bondCol0[idx4 + 3] = atomColors[i * 4 + 3] * alpha;

          bondCol1[idx4 + 0] = atomColors[j * 4 + 0];
          bondCol1[idx4 + 1] = atomColors[j * 4 + 1];
          bondCol1[idx4 + 2] = atomColors[j * 4 + 2];
          bondCol1[idx4 + 3] = atomColors[j * 4 + 3] * alpha;

          // Picking
          const p = encodePickingColor(this.bondMesh.uniqueId, b);
          bondPick[idx4 + 0] = p[0];
          bondPick[idx4 + 1] = p[1];
          bondPick[idx4 + 2] = p[2];
          bondPick[idx4 + 3] = p[3];
        }

        bondBuffers = new Map<string, Float32Array>();
        bondBuffers.set("matrix", bondMatrix);
        bondBuffers.set("instanceData0", bondData0);
        bondBuffers.set("instanceData1", bondData1);
        bondBuffers.set("instanceColor0", bondCol0);
        bondBuffers.set("instanceColor1", bondCol1);
        bondBuffers.set("instanceSplit", bondSplit);
        bondBuffers.set("instancePickingColor", bondPick);
      }
    }

    // ... registerFrame ...
    sceneIndex.registerFrame({
      atomMesh: this.atomMesh,
      bondMesh: this.bondMesh,
      atomBlock: atomsBlock,
      bondBlock: bondBlockObj,
      atomBuffers,
      bondBuffers,
    });

    await this.waitForMaterials(Boolean(bondBlockObj));
    this.atomMesh.setEnabled(true);
    this.atomMesh.isVisible = true;

    if (bondBlockObj) {
      this.bondMesh.setEnabled(true);
      this.bondMesh.isVisible = true;
    }

    this.app.events.emit("frame-rendered", { frame, box: _box });
    this.updateVisualGuide(this.findSliceModifier());
  }

  /**
   * Fast-path update: refreshes atom/bond positions and visibility without recreating meshes.
   */
  public refreshFrame(frame: Frame): void {
    const atomsBlock = frame.getBlock("atoms");
    if (atomsBlock && atomsBlock.nrows() > 0) {
      const x = atomsBlock.getColumnF32("x");
      const y = atomsBlock.getColumnF32("y");
      const z = atomsBlock.getColumnF32("z");

      const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();

      if (x && y && z && atomState) {
        const count = Math.min(atomsBlock.nrows(), atomState.count);
        const matDesc = atomState.buffers.get("matrix");
        const dataDesc = atomState.buffers.get("instanceData");

        if (matDesc && dataDesc) {
          for (let i = 0; i < count; i++) {
            // Update Matrix (pos at 12, 13, 14)
            matDesc.data[i * 16 + 12] = x[i];
            matDesc.data[i * 16 + 13] = y[i];
            matDesc.data[i * 16 + 14] = z[i];

            // Update Data (pos at 0, 1, 2)
            dataDesc.data[i * 4 + 0] = x[i];
            dataDesc.data[i * 4 + 1] = y[i];
            dataDesc.data[i * 4 + 2] = z[i];
          }
          atomState.mesh.thinInstanceBufferUpdated("matrix");
          atomState.mesh.thinInstanceBufferUpdated("instanceData");
        }

        const bondsBlock = frame.getBlock("bonds");
        const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();

        if (bondsBlock && bondState) {
          const iAtoms = bondsBlock.getColumnU32("i");
          const jAtoms = bondsBlock.getColumnU32("j");
          const matB = bondState.buffers.get("matrix");
          const d0B = bondState.buffers.get("instanceData0");
          const d1B = bondState.buffers.get("instanceData1");

          if (iAtoms && jAtoms && matB && d0B && d1B) {
            const bCount = Math.min(bondsBlock.nrows(), bondState.count);
            const tmp1 = new Vector3();
            const tmp2 = new Vector3();
            const tmpC = new Vector3();
            const tmpD = new Vector3();

            for (let b = 0; b < bCount; b++) {
              const i = iAtoms[b];
              const j = jAtoms[b];

              tmp1.set(x[i], y[i], z[i]);
              tmp2.set(x[j], y[j], z[j]);

              tmpC.copyFrom(tmp1).addInPlace(tmp2).scaleInPlace(0.5);
              tmpD.copyFrom(tmp2).subtractInPlace(tmp1);
              let dist = tmpD.length();
              if (dist > 1e-8) tmpD.scaleInPlace(1 / dist);
              else tmpD.set(0, 1, 0);

              const radius = d0B.data[b * 4 + 3];
              const scale = dist + radius * 2;

              // Matrix
              matB.data[b * 16 + 0] = scale;
              matB.data[b * 16 + 5] = scale;
              matB.data[b * 16 + 10] = scale;
              matB.data[b * 16 + 12] = tmpC.x;
              matB.data[b * 16 + 13] = tmpC.y;
              matB.data[b * 16 + 14] = tmpC.z;

              // Data0
              d0B.data[b * 4 + 0] = tmpC.x;
              d0B.data[b * 4 + 1] = tmpC.y;
              d0B.data[b * 4 + 2] = tmpC.z;

              // Data1
              d1B.data[b * 4 + 0] = tmpD.x;
              d1B.data[b * 4 + 1] = tmpD.y;
              d1B.data[b * 4 + 2] = tmpD.z;
              d1B.data[b * 4 + 3] = dist;
            }
            bondState.mesh.thinInstanceBufferUpdated("matrix");
            bondState.mesh.thinInstanceBufferUpdated("instanceData0");
            bondState.mesh.thinInstanceBufferUpdated("instanceData1");
          }
        }
      }
    }

    const sliceMod = this.findSliceModifier();
    this.updateVisualGuide(sliceMod);
    if (!sliceMod?.visibilityMask) return;
    const visMask = sliceMod.visibilityMask;

    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    if (!atomState) return;

    const instanceColorDesc = atomState.buffers.get("instanceColor");
    if (!instanceColorDesc) return;

    const totalCount = atomState.frameOffset + atomState.count;
    for (let i = 0; i < totalCount; i++) {
      instanceColorDesc.data[i * 4 + 3] = visMask[i] ? 1.0 : 0.0;
    }
    atomState.mesh.thinInstanceBufferUpdated("instanceColor");

    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (!bondState) return;

    const bondColor0 = bondState.buffers.get("instanceColor0");
    const bondColor1 = bondState.buffers.get("instanceColor1");
    const bondsBlock = frame.getBlock("bonds");
    if (!bondsBlock || !bondColor0 || !bondColor1) return;

    const iAtoms = bondsBlock.getColumnU32("i");
    const jAtoms = bondsBlock.getColumnU32("j");
    if (!iAtoms || !jAtoms) return;

    const safeCount = Math.min(bondsBlock.nrows(), bondState.frameOffset);
    for (let b = 0; b < safeCount; b++) {
      const alpha = (!visMask[iAtoms[b]] || !visMask[jAtoms[b]]) ? 0.0 : 1.0;
      bondColor0.data[b * 4 + 3] = alpha;
      bondColor1.data[b * 4 + 3] = alpha;
    }
    bondState.mesh.thinInstanceBufferUpdated("instanceColor0");
    bondState.mesh.thinInstanceBufferUpdated("instanceColor1");
  }

  private findSliceModifier(): SliceModifier | null {
    for (const mod of this.app.modifierPipeline.getModifiers()) {
      if (mod instanceof SliceModifier && mod.enabled) return mod;
    }
    return null;
  }

  /**
   * Update the visual guide wireframe mesh from the SliceModifier's guideLines.
   */
  private updateVisualGuide(sliceMod: SliceModifier | null): void {
    const scene = this.app.world.scene;
    const existing = scene.getMeshByName("visual_guide_mesh") as LinesMesh | null;

    if (!sliceMod || sliceMod.guideLines.length === 0) {
      if (existing) existing.dispose();
      return;
    }

    const lines: Vector3[][] = [];
    for (const guide of sliceMod.guideLines) {
      lines.push(guide.points.map(([x, y, z]) => new Vector3(x, y, z)));
    }

    if (existing) existing.dispose();
    const guideMesh = MeshBuilder.CreateLineSystem("visual_guide_mesh", { lines }, scene);
    guideMesh.color = new Color3(1, 0, 0);
    guideMesh.renderingGroupId = 1;
    guideMesh.isPickable = false;
  }

  // ============ Single Drawing Methods ============

  /**
   * Draw an atom at the specified position
   */
  public drawAtom(
    position: Vector3,
    options: DrawAtomOptions,
  ): { atomId: number; meshId: number } {
    const atomId = options.atomId ?? this.app.world.sceneIndex.getNextAtomId();
    const element = options.element;
    const style = this.app.styleManager.getAtomStyle(element);
    const radius = options.radius || style.radius * 0.6;
    const scale = radius * 2;

    // Compute colors
    const c = Color3.FromHexString(style.color).toLinearSpace();

    // Build buffer values
    const values = new Map<string, Float32Array>();

    // Matrix (Scale + Translation)
    const matrix = new Float32Array(16);
    matrix[0] = scale;
    matrix[5] = scale;
    matrix[10] = scale;
    matrix[15] = 1;
    matrix[12] = position.x;
    matrix[13] = position.y;
    matrix[14] = position.z;
    values.set("matrix", matrix);

    // instanceData (x, y, z, radius)
    values.set(
      "instanceData",
      new Float32Array([position.x, position.y, position.z, radius]),
    );

    // instanceColor (r, g, b, a)
    values.set(
      "instanceColor",
      new Float32Array([c.r, c.g, c.b, style.alpha ?? 1.0]),
    );

    // instancePickingColor will be set by the pool itself
    values.set("instancePickingColor", new Float32Array(4));

    // Create Atom in SceneIndex
    this.app.world.sceneIndex.createAtom(
      {
        atomId: atomId,
        element,
        position: { x: position.x, y: position.y, z: position.z },
      },
      values,
    );

    // Get meshID for reference
    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    const meshId = atomState ? atomState.mesh.uniqueId : 0;

    return { atomId, meshId };
  }

  /**
   * Draw a bond between two positions
   */
  public drawBond(
    start: Vector3,
    end: Vector3,
    options: DrawBondOptions = {},
  ): { bondId: number; meshId: number } {
    const bondId = options.bondId ?? this.app.world.sceneIndex.getNextBondId();
    const order = options.order ?? 1;
    const bondRadius =
      options.radius || this.app.styleManager.getBondStyle(order).radius;

    // Compute center, direction, distance
    const center = start.add(end).scaleInPlace(0.5);
    const dir = end.subtract(start);
    const distance = dir.length();
    if (distance > 1e-8) {
      dir.scaleInPlace(1 / distance);
    } else {
      dir.set(0, 1, 0);
    }

    const scale = distance + bondRadius * 2;

    // Matrix
    const matrix = new Float32Array(16);
    matrix[0] = scale;
    matrix[5] = scale;
    matrix[10] = scale;
    matrix[15] = 1;
    matrix[12] = center.x;
    matrix[13] = center.y;
    matrix[14] = center.z;

    // instanceData0 (center.xyz, bondRadius)
    const data0 = new Float32Array([center.x, center.y, center.z, bondRadius]);

    // instanceData1 (dir.xyz, distance)
    const data1 = new Float32Array([dir.x, dir.y, dir.z, distance]);

    // Colors
    const atomId1 = options.atomId1 ?? 0;
    const atomId2 = options.atomId2 ?? 0;

    const c0 = this.getAtomColor(atomId1);
    const c1 = this.getAtomColor(atomId2);

    // Split offset
    const r0 = this.getAtomRadius(atomId1);
    const r1 = this.getAtomRadius(atomId2);
    const splitOffset = (r0 - r1) * 0.5;

    const values = new Map<string, Float32Array>();
    values.set("matrix", matrix);
    values.set("instanceData0", data0);
    values.set("instanceData1", data1);
    values.set("instanceColor0", c0);
    values.set("instanceColor1", c1);
    values.set("instanceSplit", new Float32Array([splitOffset, 0, 0, 0]));
    values.set("instancePickingColor", new Float32Array(4));

    // Create Bond
    this.app.world.sceneIndex.createBond(
      {
        bondId: bondId,
        atomId1,
        atomId2,
        order,
        start: { x: start.x, y: start.y, z: start.z },
        end: { x: end.x, y: end.y, z: end.z },
      },
      values,
    );

    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    const meshId = bondState ? bondState.mesh.uniqueId : 0;

    return { bondId, meshId };
  }

  /**
   * Delete an atom
   */
  public deleteAtom(meshId: number, atomId: number): void {
    this.app.world.sceneIndex.unregisterEditAtom(meshId, atomId);
  }

  /**
   * Limit selection to atoms matching the expression.
   *
   * @param expression - Boolean expression string (e.g. "element == 'C'")
   */
  public selectByExpression(expression: string): void {
    this.app.world.selectionManager.selectByExpression(expression);
  }

  /**
   * Delete a bond
   */
  public deleteBond(meshId: number, bondId: number): void {
    this.app.world.sceneIndex.unregisterEditBond(meshId, bondId);
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.atomMesh.dispose();
    this.bondMesh.dispose();
  }

  // ============ Helpers ============

  private createBaseMesh(
    name: string,
    materialName: string,
    scene: Scene,
  ): Mesh {
    let material = scene.getMaterialByName(
      materialName,
    ) as ShaderMaterial | null;
    if (!material) {
      material = this.createMaterial(materialName, scene);
    }

    const mesh = MeshBuilder.CreatePlane(name, { size: 1.0 }, scene);
    mesh.material = material;
    mesh.freezeWorldMatrix(); // Optimization
    mesh.isVisible = false; // Hidden by default, activated by ImpostorState

    // Ensure mesh starts with no instances to prevent rendering errors
    mesh.thinInstanceCount = 0;

    return mesh;
  }

  private createMaterial(name: string, scene: Scene): ShaderMaterial {
    const isAtom = name.includes("atom");

    const material = new ShaderMaterial(
      name,
      scene,
      {
        vertex: isAtom ? "sphereImpostor" : "bondImpostor",
        fragment: isAtom ? "sphereImpostor" : "bondImpostor",
      },
      {
        attributes: isAtom
          ? [
            "position",
            "uv",
            "instanceData",
            "instanceColor",
            "instancePickingColor",
          ]
          : [
            "position",
            "uv",
            "instanceData0",
            "instanceData1",
            "instanceColor0",
            "instanceColor1",
            "instanceSplit",
            "instancePickingColor",
          ],
        uniforms: [
          "view",
          "projection",
          "lightDir",
          "lightAmbient",
          "lightDiffuse",
          "lightSpecular",
          "lightSpecularPower",
          "uPickingEnabled",
        ],
      },
    );

    const isGhost = name.includes("ghost");

    material.backFaceCulling = false;
    material.alphaMode = isGhost ? Engine.ALPHA_COMBINE : Engine.ALPHA_DISABLE;
    material.disableDepthWrite = false;
    material.forceDepthWrite = !isGhost; // Opaque writes depth, Ghost reads (tests) but doesn't write

    const lighting = this.app.settings.getLighting();
    let zParams = lighting.lightDir[2];
    if (this.app.config.useRightHandedSystem) {
      zParams = -zParams;
    }

    material.setVector3(
      "lightDir",
      new Vector3(lighting.lightDir[0], lighting.lightDir[1], zParams),
    );
    material.setFloat("lightAmbient", lighting.ambient);
    material.setFloat("lightDiffuse", lighting.diffuse);
    material.setFloat("lightSpecular", lighting.specular);
    material.setFloat("lightSpecularPower", lighting.specularPower);
    material.setFloat("uPickingEnabled", 0.0);

    material.onBindObservable.add(() => {
      if (!material) return;
      material.setMatrix("view", scene.getViewMatrix());
      material.setMatrix("projection", scene.getProjectionMatrix());
      material.setFloat(
        "uPickingEnabled",
        this.app.world.picker?.isPicking ? 1.0 : 0.0,
      );

      const lighting = this.app.settings.getLighting();

      let zParams = lighting.lightDir[2];
      if (this.app.config.useRightHandedSystem) {
        zParams = -zParams;
      }

      material.setVector3(
        "lightDir",
        new Vector3(lighting.lightDir[0], lighting.lightDir[1], zParams),
      );
      material.setFloat("lightAmbient", lighting.ambient);
      material.setFloat("lightDiffuse", lighting.diffuse);
      material.setFloat("lightSpecular", lighting.specular);
      material.setFloat("lightSpecularPower", lighting.specularPower);
    });

    return material;
  }

  private getAtomColor(atomId: number): Float32Array {
    const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
    if (meta) {
      const s = this.app.styleManager.getAtomStyle(meta.element);
      const c = Color3.FromHexString(s.color).toLinearSpace();
      return new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
    }
    // Fallback to carbon
    const s = this.app.styleManager.getAtomStyle("C");
    const c = Color3.FromHexString(s.color).toLinearSpace();
    return new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
  }

  private getAtomRadius(atomId: number): number {
    const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
    if (meta) {
      return this.app.styleManager.getAtomStyle(meta.element).radius;
    }
    return this.app.styleManager.getAtomStyle("C").radius;
  }
}
