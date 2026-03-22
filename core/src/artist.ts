import {
  Color3,
  type Mesh,
  MeshBuilder,
  type Scene,
  type ShaderMaterial,
  type Vector3,
} from "@babylonjs/core";
import type { Block, Box, Frame } from "molrs-wasm";
import type { MolvisApp } from "./app";

import { type AtomBufferOptions, buildAtomBuffers } from "./artist/atom_buffer";
import {
  type BondBufferResult,
  buildBondBuffers,
  refreshBondPositions,
} from "./artist/bond_buffer";
import { LabelRenderer } from "./artist/label_renderer";
import {
  compileShaderMaterial,
  createImpostorMaterial,
  syncImpostorMaterialUniforms,
} from "./artist/material_factory";
import {
  type ImpostorTarget,
  getImpostorMaterialSpec,
} from "./artist/material_spec";
import { RibbonRenderer } from "./artist/ribbon/ribbon_renderer";
import { findSliceModifier, updateVisualGuide } from "./artist/visual_guide";
import { createWarmupMesh } from "./artist/warmup";
import type { AtomMeta, BondMeta } from "./entity_source";
import type { ImpostorState } from "./scene_index";
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
 * Artist — Unified Graphics Engine
 *
 * Orchestrates rendering by delegating to focused modules:
 * - material_factory: shader material creation + compilation
 * - atom_buffer / bond_buffer: GPU buffer computation (pure math)
 * - visual_guide: slice modifier wireframe
 * - warmup: shader pre-compilation
 */
export class Artist {
  private app: MolvisApp;
  private _globalOpacity = 1.0;
  private shaderCompileTasks = new Map<ImpostorTarget, Promise<void>>();

  public atomMesh: Mesh;
  public bondMesh: Mesh;
  public ribbonRenderer: RibbonRenderer;
  public labelRenderer: LabelRenderer;

  get globalOpacity(): number {
    return this._globalOpacity;
  }

  /**
   * Set global opacity for all atoms and bonds.
   * Modifies instanceColor alpha on existing buffers in-place.
   */
  setGlobalOpacity(opacity: number): void {
    this._globalOpacity = Math.max(0.02, Math.min(1.0, opacity));
    this.applyGlobalOpacity();
  }

  /**
   * Set opacity for specific atom indices.
   * Modifies instanceColor alpha in-place for the given atoms.
   */
  setAtomOpacity(indices: Iterable<number>, opacity: number): void {
    const clamped = Math.max(0.02, Math.min(1.0, opacity));
    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    if (!atomState) return;

    const colorDesc = atomState.buffers.get("instanceColor");
    if (!colorDesc) return;

    for (const idx of indices) {
      if (idx >= 0 && idx < atomState.frameOffset + atomState.count) {
        colorDesc.data[idx * 4 + 3] = clamped;
      }
    }
    atomState.mesh.thinInstanceBufferUpdated("instanceColor");
  }

  private applyGlobalOpacity(): void {
    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    if (atomState) {
      const colorDesc = atomState.buffers.get("instanceColor");
      if (colorDesc) {
        const total = atomState.frameOffset + atomState.count;
        for (let i = 0; i < total; i++) {
          colorDesc.data[i * 4 + 3] = this._globalOpacity;
        }
        atomState.mesh.thinInstanceBufferUpdated("instanceColor");
      }
    }

    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (bondState) {
      const c0 = bondState.buffers.get("instanceColor0");
      const c1 = bondState.buffers.get("instanceColor1");
      if (c0 && c1) {
        const total = bondState.frameOffset + bondState.count;
        for (let i = 0; i < total; i++) {
          c0.data[i * 4 + 3] = this._globalOpacity;
          c1.data[i * 4 + 3] = this._globalOpacity;
        }
        bondState.mesh.thinInstanceBufferUpdated("instanceColor0");
        bondState.mesh.thinInstanceBufferUpdated("instanceColor1");
      }
    }
  }

  constructor(options: ArtistOptions) {
    this.app = options.app;
    const scene = this.app.world.scene;

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
    this.ribbonRenderer = new RibbonRenderer(scene);
    this.labelRenderer = new LabelRenderer(scene);
    this.registerRuntimeLayers();
  }

  // ============ Shader Preparation ============

  private async ensureShadersForVisibleGeometry(
    targets: ImpostorTarget[],
  ): Promise<void> {
    if (targets.length === 0) return;

    this.app.world.renderOnce();
    await Promise.all(
      targets.map((target) => this.ensureTargetShaderReady(target)),
    );
  }

  private ensureTargetShaderReady(target: ImpostorTarget): Promise<void> {
    const existing = this.shaderCompileTasks.get(target);
    if (existing) return existing;

    const scene = this.app.world.scene;
    const spec = getImpostorMaterialSpec(target);
    const mesh = target === "atom" ? this.atomMesh : this.bondMesh;
    const material = mesh.material as ShaderMaterial | null;

    if (material) {
      syncImpostorMaterialUniforms(material, scene, this.app);
    }

    const warmupMesh = material
      ? createWarmupMesh(`__molvis_warmup_${target}__`, scene, material, spec)
      : null;

    const compileTask = compileShaderMaterial(
      warmupMesh ?? mesh,
      material,
      spec,
    ).finally(() => {
      warmupMesh?.dispose();
    });

    this.shaderCompileTasks.set(target, compileTask);
    return compileTask.catch((error) => {
      this.shaderCompileTasks.delete(target);
      throw error;
    });
  }

  // ============ Scene Lifecycle ============

  public clear(): void {
    const scene = this.app.world.scene;

    this.atomMesh.dispose();
    this.bondMesh.dispose();

    // Dispose box mesh if present
    const boxMesh = scene.getMeshByName("sim_box");
    if (boxMesh) {
      boxMesh.dispose();
    }

    this.app.world.sceneIndex.clear();

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
    this.registerRuntimeLayers();
  }

  public dispose(): void {
    this.atomMesh.dispose();
    this.bondMesh.dispose();
    this.ribbonRenderer.dispose();
    this.labelRenderer.dispose();
  }

  // ============ Frame Rendering (Bulk) ============

  public async drawFrame(
    frame: Frame,
    _box?: Box,
    options?: {
      atoms?: AtomBufferOptions & { impostor?: boolean };
      bonds?: { radii?: number; impostor?: boolean };
    },
  ): Promise<void> {
    const atomsBlock = frame.getBlock("atoms");
    const bondsBlock = frame.getBlock("bonds");

    const visibleTargets = this.collectVisibleTargets({
      atomCount: atomsBlock?.nrows() ?? 0,
      bondCount: bondsBlock?.nrows() ?? 0,
    });

    await this.ensureShadersForVisibleGeometry(visibleTargets);
    this.clear();

    if (!atomsBlock || atomsBlock.nrows() === 0) {
      this.app.events.emit("frame-rendered", { frame, box: _box });
      updateVisualGuide(
        this.app.world.scene,
        findSliceModifier(this.app.modifierPipeline),
      );
      return;
    }

    const atomBuffers = buildAtomBuffers(
      atomsBlock,
      this.app.styleManager,
      this.atomMesh.uniqueId,
      options?.atoms,
    );

    const atomColor = atomBuffers.get("instanceColor") as Float32Array;
    let bondBlockObj: Block | undefined;
    let bondResult: BondBufferResult | undefined;

    if (bondsBlock && bondsBlock.nrows() > 0) {
      bondBlockObj = bondsBlock;
      const visibleArr = options?.atoms?.visible;
      bondResult = buildBondBuffers(
        bondsBlock,
        atomsBlock,
        atomColor,
        this.bondMesh.uniqueId,
        {
          radius: options?.bonds?.radii,
          visible: visibleArr ? (i: number) => visibleArr[i] : undefined,
        },
      );
    }

    this.app.world.sceneIndex.registerFrame({
      atomMesh: this.atomMesh,
      bondMesh: this.bondMesh,
      atomBlock: atomsBlock,
      bondBlock: bondBlockObj,
      atomBuffers,
      bondBuffers: bondResult?.buffers,
      bondInstanceCount: bondResult?.instanceCount,
      bondInstanceMap: bondResult?.instanceMap,
    });

    this.applySceneIndexToMeshes();

    this.app.events.emit("frame-rendered", { frame, box: _box });
    updateVisualGuide(
      this.app.world.scene,
      findSliceModifier(this.app.modifierPipeline),
    );
  }

  // ============ Frame Refresh (Fast Path) ============

  public redrawFrame(frame: Frame): void {
    const atomsBlock = frame.getBlock("atoms");
    if (!atomsBlock || atomsBlock.nrows() === 0) return;

    const x = atomsBlock.viewColF32("x");
    const y = atomsBlock.viewColF32("y");
    const z = atomsBlock.viewColF32("z");
    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    if (!x || !y || !z || !atomState) return;

    // Update atom positions in-place
    const count = Math.min(atomsBlock.nrows(), atomState.getTotalCount());
    const matDesc = atomState.buffers.get("matrix");
    const dataDesc = atomState.buffers.get("instanceData");

    if (matDesc && dataDesc) {
      for (let i = 0; i < count; i++) {
        matDesc.data[i * 16 + 12] = x[i];
        matDesc.data[i * 16 + 13] = y[i];
        matDesc.data[i * 16 + 14] = z[i];

        dataDesc.data[i * 4 + 0] = x[i];
        dataDesc.data[i * 4 + 1] = y[i];
        dataDesc.data[i * 4 + 2] = z[i];
      }
      atomState.mesh.thinInstanceBufferUpdated("matrix");
      atomState.mesh.thinInstanceBufferUpdated("instanceData");
    }

    // Update bond positions
    const bondsBlock = frame.getBlock("bonds");
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (bondsBlock && bondState) {
      refreshBondPositions(bondsBlock, x, y, z, bondState);
    }

    // Update slice visibility
    const sliceMod = findSliceModifier(this.app.modifierPipeline);
    updateVisualGuide(this.app.world.scene, sliceMod);
    if (!sliceMod?.visibilityMask) return;

    this.applySliceVisibility(sliceMod.visibilityMask, frame);
  }

  // ============ Single Entity Drawing ============

  public async drawAtom(
    position: Vector3,
    options: DrawAtomOptions,
  ): Promise<{ atomId: number; meshId: number }> {
    const atomId = options.atomId ?? this.app.world.sceneIndex.getNextAtomId();
    const element = options.element;
    const style = this.app.styleManager.getAtomStyle(element);
    const radius = options.radius || style.radius * 0.6;
    const scale = radius * 2;

    const c = Color3.FromHexString(style.color).toLinearSpace();

    const values = new Map<string, Float32Array>();

    const matrix = new Float32Array(16);
    matrix[0] = scale;
    matrix[5] = scale;
    matrix[10] = scale;
    matrix[15] = 1;
    matrix[12] = position.x;
    matrix[13] = position.y;
    matrix[14] = position.z;
    values.set("matrix", matrix);

    values.set(
      "instanceData",
      new Float32Array([position.x, position.y, position.z, radius]),
    );
    values.set(
      "instanceColor",
      new Float32Array([c.r, c.g, c.b, style.alpha ?? 1.0]),
    );
    values.set("instancePickingColor", new Float32Array(4));

    await this.ensureShadersForVisibleGeometry(
      this.collectVisibleTargets({
        atomCount: 1,
        bondCount: 0,
      }),
    );

    this.app.world.sceneIndex.createAtom(
      {
        atomId,
        element,
        position: { x: position.x, y: position.y, z: position.z },
      },
      values,
    );
    this.applySceneIndexToMeshes();

    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    const meshId = atomState ? atomState.mesh.uniqueId : 0;
    return { atomId, meshId };
  }

  public async drawBond(
    start: Vector3,
    end: Vector3,
    options: DrawBondOptions = {},
  ): Promise<{ bondId: number; meshId: number }> {
    const bondId = options.bondId ?? this.app.world.sceneIndex.getNextBondId();
    const order = options.order ?? 1;
    const bondRadius =
      options.radius || this.app.styleManager.getBondStyle(order).radius;

    const center = start.add(end).scaleInPlace(0.5);
    const dir = end.subtract(start);
    const distance = dir.length();
    if (distance > 1e-8) {
      dir.scaleInPlace(1 / distance);
    } else {
      dir.set(0, 1, 0);
    }

    const scale = distance + bondRadius * 2;

    const matrix = new Float32Array(16);
    matrix[0] = scale;
    matrix[5] = scale;
    matrix[10] = scale;
    matrix[15] = 1;
    matrix[12] = center.x;
    matrix[13] = center.y;
    matrix[14] = center.z;

    const data0 = new Float32Array([center.x, center.y, center.z, bondRadius]);
    const data1 = new Float32Array([dir.x, dir.y, dir.z, distance]);

    const atomId1 = options.atomId1 ?? 0;
    const atomId2 = options.atomId2 ?? 0;
    const c0 = this.getAtomColor(atomId1);
    const c1 = this.getAtomColor(atomId2);

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

    await this.ensureShadersForVisibleGeometry(
      this.collectVisibleTargets({
        atomCount: 0,
        bondCount: 1,
      }),
    );

    this.app.world.sceneIndex.createBond(
      {
        bondId,
        atomId1,
        atomId2,
        order,
        start: { x: start.x, y: start.y, z: start.z },
        end: { x: end.x, y: end.y, z: end.z },
      },
      values,
    );
    this.applySceneIndexToMeshes();

    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    const meshId = bondState ? bondState.mesh.uniqueId : 0;
    return { bondId, meshId };
  }

  public deleteAtom(meshId: number, atomId: number): void {
    this.app.world.sceneIndex.unregisterEditAtom(meshId, atomId);
    this.applySceneIndexToMeshes();
  }

  public selectByExpression(expression: string): void {
    this.app.world.selectionManager.selectByExpression(expression);
  }

  public deleteBond(meshId: number, bondId: number): void {
    this.app.world.sceneIndex.unregisterEditBond(meshId, bondId);
    this.applySceneIndexToMeshes();
  }

  public async drawAtomFromBuffers(
    meta: Omit<AtomMeta, "type">,
    buffers: Map<string, Float32Array | number[]>,
  ): Promise<void> {
    await this.ensureShadersForVisibleGeometry(
      this.collectVisibleTargets({
        atomCount: 1,
        bondCount: 0,
      }),
    );
    this.app.world.sceneIndex.createAtom(meta, buffers);
    this.applySceneIndexToMeshes();
  }

  public async drawBondFromBuffers(
    meta: Omit<BondMeta, "type">,
    buffers: Map<string, Float32Array | number[]>,
  ): Promise<void> {
    await this.ensureShadersForVisibleGeometry(
      this.collectVisibleTargets({
        atomCount: 0,
        bondCount: 1,
      }),
    );
    this.app.world.sceneIndex.createBond(meta, buffers);
    this.applySceneIndexToMeshes();
  }

  public async redrawRepresentation(frame?: Frame, box?: Box): Promise<void> {
    const repr = this.app.styleManager.getRepresentation();
    this.ribbonRenderer.setVisible(repr.showRibbon);

    if (!frame) {
      this.redrawFromSceneIndex();
      return;
    }

    await this.drawFrame(frame, box);
    this.ribbonRenderer.setVisible(repr.showRibbon);
  }

  public redrawFromSceneIndex(frame?: Frame): void {
    this.applySceneIndexToMeshes();

    const sliceMod = findSliceModifier(this.app.modifierPipeline);
    updateVisualGuide(this.app.world.scene, sliceMod);
    if (frame && sliceMod?.visibilityMask) {
      this.applySliceVisibility(sliceMod.visibilityMask, frame);
    }
  }

  // ============ Private Helpers ============

  private registerRuntimeLayers(): void {
    const meshRegistry = this.app.world.sceneIndex.meshRegistry;
    meshRegistry.registerAtomLayer(this.atomMesh);
    meshRegistry.registerBondLayer(this.bondMesh);
  }

  private createBaseMesh(
    name: string,
    materialName: string,
    scene: Scene,
  ): Mesh {
    let material = scene.getMaterialByName(
      materialName,
    ) as ShaderMaterial | null;
    if (!material) {
      const target = materialName.includes("atom") ? "atom" : "bond";
      material = createImpostorMaterial(target, scene, this.app);
    }

    const mesh = MeshBuilder.CreatePlane(name, { size: 1.0 }, scene);
    mesh.material = material;
    mesh.freezeWorldMatrix();
    mesh.isVisible = false;
    mesh.setEnabled(false);
    mesh.thinInstanceCount = 0;
    return mesh;
  }

  private collectVisibleTargets(counts: {
    atomCount: number;
    bondCount: number;
  }): ImpostorTarget[] {
    const repr = this.app.styleManager.getRepresentation();
    const targets: ImpostorTarget[] = [];

    if (repr.showAtoms && counts.atomCount > 0) {
      targets.push("atom");
    }
    if (repr.showBonds && counts.bondCount > 0) {
      targets.push("bond");
    }

    return targets;
  }

  private applySceneIndexToMeshes(): void {
    const repr = this.app.styleManager.getRepresentation();
    this.applyStateToMesh(
      this.app.world.sceneIndex.meshRegistry.getAtomState(),
      this.atomMesh,
      repr.showAtoms,
    );
    this.applyStateToMesh(
      this.app.world.sceneIndex.meshRegistry.getBondState(),
      this.bondMesh,
      repr.showBonds,
    );
  }

  private applyStateToMesh(
    state: ImpostorState | null,
    mesh: Mesh,
    allowVisible: boolean,
  ): void {
    const totalCount = state?.getTotalCount() ?? 0;

    if (totalCount === 0) {
      mesh.isVisible = false;
      mesh.setEnabled(false);
      mesh.thinInstanceCount = 0;
      state?.markUploaded();
      return;
    }

    if (!allowVisible) {
      mesh.isVisible = false;
      mesh.setEnabled(false);
      return;
    }

    if (state?.needsUpload) {
      const matrixDesc = state.buffers.get("matrix");
      if (matrixDesc) {
        const view = matrixDesc.data.subarray(
          0,
          totalCount * matrixDesc.stride,
        );
        mesh.thinInstanceSetBuffer("matrix", view, matrixDesc.stride, false);
      }

      for (const [name, desc] of state.buffers) {
        if (name === "matrix") continue;
        const view = desc.data.subarray(0, totalCount * desc.stride);
        mesh.thinInstanceSetBuffer(name, view, desc.stride, false);
      }

      mesh.thinInstanceCount = totalCount;
      mesh.thinInstanceEnablePicking = true;
      mesh.thinInstanceRefreshBoundingInfo(true);
      state.markUploaded();
    }

    mesh.setEnabled(true);
    mesh.isVisible = true;
  }

  /**
   * Apply slice modifier visibility mask to atom and bond colors.
   */
  private applySliceVisibility(visMask: boolean[], frame: Frame): void {
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

    const iAtoms = bondsBlock.viewColU32("i");
    const jAtoms = bondsBlock.viewColU32("j");

    const safeCount = Math.min(bondsBlock.nrows(), bondState.frameOffset);
    for (let b = 0; b < safeCount; b++) {
      const alpha = !visMask[iAtoms[b]] || !visMask[jAtoms[b]] ? 0.0 : 1.0;
      bondColor0.data[b * 4 + 3] = alpha;
      bondColor1.data[b * 4 + 3] = alpha;
    }
    bondState.mesh.thinInstanceBufferUpdated("instanceColor0");
    bondState.mesh.thinInstanceBufferUpdated("instanceColor1");
  }

  private getAtomColor(atomId: number): Float32Array {
    const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
    const element = meta ? meta.element : "C";
    const s = this.app.styleManager.getAtomStyle(element);
    const c = Color3.FromHexString(s.color).toLinearSpace();
    return new Float32Array([c.r, c.g, c.b, s.alpha ?? 1.0]);
  }

  private getAtomRadius(atomId: number): number {
    const meta = this.app.world.sceneIndex.metaRegistry.atoms.getMeta(atomId);
    const element = meta ? meta.element : "C";
    return this.app.styleManager.getAtomStyle(element).radius;
  }
}
