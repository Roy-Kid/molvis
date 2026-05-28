import {
  Color3,
  Mesh,
  MeshBuilder,
  type Scene,
  type ShaderMaterial,
  StandardMaterial,
  type Vector3,
  VertexData,
} from "@babylonjs/core";
import { WasmArray } from "@molcrafts/molrs";
import type { Block, Box, Frame, Grid } from "@molcrafts/molrs";

import type { MolvisApp } from "./app";

import { type AtomBufferOptions, buildAtomBuffers } from "./artist/atom_buffer";
import {
  type BondBufferResult,
  buildBondBuffers,
  buildSubBondInstanceBuffers,
  clampBondOrder,
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
import { registerImpostorShaders } from "./shaders/impostor";
import { DType } from "./utils/dtype";

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
 * Module-level scratch buffers for `computeBondMIDisplacements` so the
 * hot per-frame path doesn't allocate. Grow on demand; the returned
 * subarray view is valid only until the next call.
 */
let MI_A_SCRATCH = new Float64Array(0);
let MI_B_SCRATCH = new Float64Array(0);
let MI_OUT_SCRATCH = new Float64Array(0);

/**
 * Compute per-bond minimum-image displacement vectors
 * `(atom_j - atom_i)` via WASM `Box.delta(..., minimum_image = true)`.
 *
 * Returns a row-major `Float64Array` view of length `3 * nbonds`
 * (`[dx0, dy0, dz0, dx1, …]`) to feed into `buildBondBuffers` /
 * `refreshBondPositions` via their `miDisplacements` option. Returns
 * `undefined` when there is no box, no bonds, or the required
 * columns/views are missing.
 *
 * Why in WASM: `Box.delta` knows per-axis PBC flags and the full `h`
 * cell matrix, so triclinic cells and partial-PBC setups (e.g. 2D
 * slabs with z non-periodic) get correct minimum-image handling for
 * free — no JS-side axis-length approximation.
 *
 * The returned array is a view over module-level scratch storage and
 * is overwritten on the next call. Callers consume it synchronously
 * inside one render/refresh and must not retain it across frames.
 */
function computeBondMIDisplacements(
  frame: Frame,
  atomsBlock: Block,
  bondsBlock: Block,
): Float64Array | undefined {
  const box = frame.simbox;
  if (!box) return undefined;
  const nbonds = bondsBlock.nrows();
  if (nbonds === 0) return undefined;

  const iAtoms = bondsBlock.viewColU32("atomi");
  const jAtoms = bondsBlock.viewColU32("atomj");
  if (!iAtoms || !jAtoms) return undefined;

  const x = atomsBlock.viewColF("x");
  const y = atomsBlock.viewColF("y");
  const z = atomsBlock.viewColF("z");
  if (!x || !y || !z) return undefined;

  const flatLen = nbonds * 3;
  if (MI_A_SCRATCH.length < flatLen) {
    MI_A_SCRATCH = new Float64Array(flatLen);
    MI_B_SCRATCH = new Float64Array(flatLen);
    MI_OUT_SCRATCH = new Float64Array(flatLen);
  }
  const aBuf = MI_A_SCRATCH;
  const bBuf = MI_B_SCRATCH;
  for (let b = 0; b < nbonds; b++) {
    const i = iAtoms[b];
    const j = jAtoms[b];
    const o = 3 * b;
    aBuf[o] = x[i];
    aBuf[o + 1] = y[i];
    aBuf[o + 2] = z[i];
    bBuf[o] = x[j];
    bBuf[o + 1] = y[j];
    bBuf[o + 2] = z[j];
  }

  const shape = new Uint32Array([nbonds, 3]);
  const aArr = WasmArray.from(aBuf.subarray(0, flatLen), shape);
  const bArr = WasmArray.from(bBuf.subarray(0, flatLen), shape);
  try {
    const delta = box.delta(aArr, bArr, true);
    try {
      MI_OUT_SCRATCH.set(delta.toTypedArray());
      return MI_OUT_SCRATCH.subarray(0, flatLen);
    } finally {
      delta.free();
    }
  } finally {
    aArr.free();
    bArr.free();
  }
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
  public cloudMesh: Mesh | null = null;
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

    const total = atomState.frameOffset + atomState.count;
    for (const idx of indices) {
      if (idx >= 0 && idx < total) {
        colorDesc.data[idx * 4 + 3] = clamped;
      }
    }
    atomState.uploadBuffer("instanceColor");
  }

  /**
   * Set opacity on bonds whose either endpoint is in the given atom set.
   * Iterates all logical bonds and applies opacity to all render instances.
   */
  setBondOpacityForAtoms(
    atomIndices: ReadonlySet<number>,
    opacity: number,
  ): void {
    const clamped = Math.max(0.02, Math.min(1.0, opacity));
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (!bondState) return;

    const c0 = bondState.buffers.get("instanceColor0");
    const c1 = bondState.buffers.get("instanceColor1");
    if (!c0 || !c1) return;

    const bondsBlock = this.app.world.sceneIndex.metaRegistry.bonds.frameBlock;
    if (!bondsBlock) return;

    const iAtoms = bondsBlock.viewColU32("atomi");
    const jAtoms = bondsBlock.viewColU32("atomj");
    if (!iAtoms || !jAtoms) return;
    const orderCol =
      bondsBlock.dtype("order") === DType.U32
        ? bondsBlock.viewColU32("order")
        : undefined;
    if (!iAtoms || !jAtoms) return;

    const logicalCount = bondsBlock.nrows();
    let renderIdx = 0;
    for (let b = 0; b < logicalCount; b++) {
      const order = orderCol ? orderCol[b] : 1;
      const hit = atomIndices.has(iAtoms[b]) || atomIndices.has(jAtoms[b]);
      for (let s = 0; s < order && renderIdx < bondState.frameOffset; s++) {
        if (hit) {
          c0.data[renderIdx * 4 + 3] = clamped;
          c1.data[renderIdx * 4 + 3] = clamped;
        }
        renderIdx++;
      }
    }
    bondState.uploadBuffer("instanceColor0");
    bondState.uploadBuffer("instanceColor1");
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
        atomState.uploadBuffer("instanceColor");
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
        bondState.uploadBuffer("instanceColor0");
        bondState.uploadBuffer("instanceColor1");
      }
    }
  }

  constructor(options: ArtistOptions) {
    registerImpostorShaders();
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
    this.cloudMesh?.dispose();
    this.cloudMesh = null;

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
    this.cloudMesh?.dispose();
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
      this.renderAuxiliaryLayers(frame);
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
          radius:
            options?.bonds?.radii ??
            this.app.styleManager.getBondStyle(1).radius,
          visible: visibleArr ? (i: number) => visibleArr[i] : undefined,
          miDisplacements: computeBondMIDisplacements(
            frame,
            atomsBlock,
            bondsBlock,
          ),
        },
      );
    }

    this.app.world.sceneIndex.registerFrame({
      atomMesh: this.atomMesh,
      bondMesh: this.bondMesh,
      frame,
      atomBlock: atomsBlock,
      bondBlock: bondBlockObj,
      atomBuffers,
      bondBuffers: bondResult?.buffers,
      bondInstanceCount: bondResult?.instanceCount,
      bondInstanceMap: bondResult?.instanceMap,
    });

    this.applySceneIndexToMeshes();
    this.renderAuxiliaryLayers(frame);

    // Apply slice visibility if a SliceModifier is in the pipeline
    const sliceMod = findSliceModifier(this.app.modifierPipeline);
    if (sliceMod?.visibilityMask) {
      this.applySliceVisibility(sliceMod.visibilityMask, frame);
    }

    this.app.events.emit("frame-rendered", { frame, box: _box });
    updateVisualGuide(this.app.world.scene, sliceMod);
  }

  public drawCloud(
    grid: Grid,
    options?: {
      stride?: number;
      threshold?: number;
      pointSize?: number;
      alpha?: number;
    },
  ): void {
    this.cloudMesh?.dispose();
    this.cloudMesh = null;

    const arrayNames = grid.arrayNames();
    if (arrayNames.length === 0) return;
    const valuesArray = grid.getArray(arrayNames[0] as string);
    if (!valuesArray || valuesArray.length === 0) return;

    let maxAbs = 0;
    for (let i = 0; i < valuesArray.length; i++) {
      const value = Math.abs(valuesArray[i]);
      if (value > maxAbs) maxAbs = value;
    }
    if (maxAbs <= 0) return;

    const shape = Array.from(grid.dim()) as number[];
    const stride =
      options?.stride ?? Math.max(1, Math.floor(Math.max(...shape) / 48));
    const threshold = options?.threshold ?? maxAbs * 0.08;
    const alpha = options?.alpha ?? 0.18;

    const origin = Array.from(grid.origin().toCopy()) as number[];
    const cellFlat = Array.from(grid.cell().toCopy()) as number[];
    const cell: number[][] = [
      [cellFlat[0], cellFlat[1], cellFlat[2]],
      [cellFlat[3], cellFlat[4], cellFlat[5]],
      [cellFlat[6], cellFlat[7], cellFlat[8]],
    ];
    const spacing = [
      Math.hypot(
        cell[0][0] / shape[0],
        cell[0][1] / shape[0],
        cell[0][2] / shape[0],
      ),
      Math.hypot(
        cell[1][0] / shape[1],
        cell[1][1] / shape[1],
        cell[1][2] / shape[1],
      ),
      Math.hypot(
        cell[2][0] / shape[2],
        cell[2][1] / shape[2],
        cell[2][2] / shape[2],
      ),
    ];
    const pointSize =
      options?.pointSize ?? Math.max(2, Math.min(...spacing) * 18);

    const positions: number[] = [];
    const colors: number[] = [];

    const index = (ix: number, iy: number, iz: number) =>
      (ix * shape[1] + iy) * shape[2] + iz;

    for (let ix = 0; ix < shape[0]; ix += stride) {
      for (let iy = 0; iy < shape[1]; iy += stride) {
        for (let iz = 0; iz < shape[2]; iz += stride) {
          const value = valuesArray[index(ix, iy, iz)];
          const magnitude = Math.abs(value);
          if (magnitude < threshold) continue;

          const fx = ix / shape[0];
          const fy = iy / shape[1];
          const fz = iz / shape[2];
          const px =
            origin[0] + fx * cell[0][0] + fy * cell[1][0] + fz * cell[2][0];
          const py =
            origin[1] + fx * cell[0][1] + fy * cell[1][1] + fz * cell[2][1];
          const pz =
            origin[2] + fx * cell[0][2] + fy * cell[1][2] + fz * cell[2][2];
          const t = Math.min(1, magnitude / maxAbs);

          positions.push(px, py, pz);

          colors.push(
            0.08 + 0.92 * t,
            0.28 + 0.62 * t,
            0.95 - 0.35 * t,
            alpha * (0.35 + 0.65 * t),
          );
        }
      }
    }

    if (colors.length === 0) return;

    const scene = this.app.world.scene;
    const cloudMesh = new Mesh("field_cloud_renderer", scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.colors = colors;
    vertexData.applyToMesh(cloudMesh, true);

    const material = new StandardMaterial("field_cloud_material", scene);
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.pointsCloud = true;
    material.pointSize = pointSize;
    material.alphaMode = 2;
    cloudMesh.material = material;
    cloudMesh.isPickable = false;
    cloudMesh.alwaysSelectAsActiveMesh = true;
    // Cloud sorts FIRST among translucent meshes — points are additive
    // and have no real "front face" to occlude atoms with. Pinning to
    // 0 documents the alpha-pass ordering: cloud (0) → atoms/bonds (1)
    // → translucent surfaces (MAX_VALUE).
    cloudMesh.alphaIndex = 0;
    this.cloudMesh = cloudMesh;
  }

  // ============ Frame Refresh (Fast Path) ============

  public redrawFrame(frame: Frame): void {
    const atomsBlock = frame.getBlock("atoms");
    if (!atomsBlock || atomsBlock.nrows() === 0) {
      this.renderAuxiliaryLayers(frame);
      return;
    }

    const x = atomsBlock.viewColF("x");
    const y = atomsBlock.viewColF("y");
    const z = atomsBlock.viewColF("z");
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
      atomState.uploadBuffer("matrix");
      atomState.uploadBuffer("instanceData");
    }

    // Update bond positions
    const bondsBlock = frame.getBlock("bonds");
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (bondsBlock && bondState) {
      refreshBondPositions(
        bondsBlock,
        x,
        y,
        z,
        bondState,
        computeBondMIDisplacements(frame, atomsBlock, bondsBlock),
      );
    }

    // Update slice visibility
    const sliceMod = findSliceModifier(this.app.modifierPipeline);
    updateVisualGuide(this.app.world.scene, sliceMod);
    this.renderAuxiliaryLayers(frame);
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
    const radius = options.radius || style.radius;
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
    const order = clampBondOrder(options.order ?? 1);
    const bondRadius =
      options.radius || this.app.styleManager.getBondStyle(order).radius;

    const atomId1 = options.atomId1 ?? 0;
    const atomId2 = options.atomId2 ?? 0;
    const c0 = this.getAtomColor(atomId1);
    const c1 = this.getAtomColor(atomId2);

    const r0 = this.getAtomRadius(atomId1);
    const r1 = this.getAtomRadius(atomId2);
    const splitOffset = (r0 - r1) * 0.5;

    const { buffers: subBuffers, subCount } = buildSubBondInstanceBuffers(
      start,
      end,
      order,
      bondRadius,
      c0,
      c1,
      splitOffset,
    );

    const values = new Map<string, Float32Array>(subBuffers);
    // Picking color is filled by ImpostorState.writePickingColor per sub-slot.
    values.set("instancePickingColor", new Float32Array(4 * subCount));

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
      subCount,
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
    // Infer subCount from matrix buffer length (16 floats per render instance).
    const matrix = buffers.get("matrix");
    const matrixLen = Array.isArray(matrix) ? matrix.length : matrix?.length;
    const subCount = Math.max(1, Math.floor((matrixLen ?? 16) / 16));
    this.app.world.sceneIndex.createBond(meta, buffers, subCount);
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

  /**
   * Data-driven auxiliary rendering layers — everything that depends on
   * frame data but isn't the primary atom/bond impostor pass (volumetric
   * clouds, protein ribbons, future isosurfaces/SES). Each branch inspects
   * the frame for the keys it cares about and renders or disposes. Adding
   * another layer means adding a branch here — no loader or dispatcher
   * changes required.
   */
  private renderAuxiliaryLayers(frame: Frame): void {
    // Volumetric / grid-backed fields.
    const grid = frame.getGrid("electron_density") ?? this.firstGrid(frame);
    if (grid) this.drawCloud(grid);

    // Protein backbone — populated by molrs's PDB reader.
    this.ribbonRenderer.syncFromFrame(frame);
    this.ribbonRenderer.setVisible(
      this.app.styleManager.getRepresentation().showRibbon,
    );
  }

  private firstGrid(frame: Frame): Grid | null {
    const names = frame.gridNames();
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (typeof name !== "string") continue;
      const grid = frame.getGrid(name);
      if (grid) return grid;
    }
    return null;
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
    // Thin-instanced impostor host mesh — the host plane is 1×1 in
    // model space; thin-instance bounding info should track all
    // instances after `thinInstanceRefreshBoundingInfo`, but the
    // combination of `freezeWorldMatrix()` and certain camera
    // orientations leaves the host's effective bounds tight to the
    // 1×1 plane and makes BabylonJS cull the entire mesh in one go.
    // Was removed in the molrs-0.0.11 refactor; re-applied to fix the
    // class of "atom disappears at certain rotation angles" bugs.
    mesh.alwaysSelectAsActiveMesh = true;
    // Pin atoms/bonds to a low `alphaIndex` so they always sort
    // *before* translucent surfaces (mark_atom halos, isosurface lobes,
    // ribbons) in the alpha-blend pass. Atoms write depth via
    // `forceDepthWrite=true`; when a translucent surface happens to
    // sort first by camera-distance, its depth write blocks atoms
    // inside the lobe on the GL_LESS test. Atoms-first ordering keeps
    // atoms in the depth buffer; surfaces render after and only
    // partially blend with the existing atom pixels.
    //
    // 1 puts atoms after the cloud (alphaIndex=0) but before any
    // mesh that defaults to MAX_VALUE — surface, ribbon, halo, etc.
    mesh.alphaIndex = 1;
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
      // Upload only the buffers marked dirty. The position-only playback path
      // mutates just matrix + instanceData, so the (unchanged) color and
      // picking buffers — by far the largest — are skipped. Structural changes
      // mark everything dirty (isAllDirty) and re-upload all buffers.
      const matrixDesc = state.buffers.get("matrix");
      if (matrixDesc && state.isBufferDirty("matrix")) {
        const view = matrixDesc.data.subarray(
          0,
          totalCount * matrixDesc.stride,
        );
        mesh.thinInstanceSetBuffer("matrix", view, matrixDesc.stride, false);
      }

      for (const [name, desc] of state.buffers) {
        if (name === "matrix") continue;
        if (!state.isBufferDirty(name)) continue;
        const view = desc.data.subarray(0, totalCount * desc.stride);
        mesh.thinInstanceSetBuffer(name, view, desc.stride, false);
      }

      // thinInstanceCount/picking are idempotent; bounds must refresh whenever
      // matrices moved (which is the case on every dirty cycle that touches
      // positions). Keep these unconditional — they are cheap relative to the
      // buffer uploads we just gated.
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
    atomState.uploadBuffer("instanceColor");

    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (!bondState) return;

    const bondColor0 = bondState.buffers.get("instanceColor0");
    const bondColor1 = bondState.buffers.get("instanceColor1");
    const bondsBlock = frame.getBlock("bonds");
    if (!bondsBlock || !bondColor0 || !bondColor1) return;

    const iAtoms = bondsBlock.viewColU32("atomi");
    const jAtoms = bondsBlock.viewColU32("atomj");
    const orderCol =
      bondsBlock.dtype("order") === DType.U32
        ? bondsBlock.viewColU32("order")
        : undefined;

    // Iterate with a running render index that advances by the bond's order,
    // because multi-order bonds expand to multiple GPU instances.
    const logicalCount = bondsBlock.nrows();
    let renderIdx = 0;
    for (let b = 0; b < logicalCount; b++) {
      const order = orderCol ? orderCol[b] : 1;
      const alpha = !visMask[iAtoms[b]] || !visMask[jAtoms[b]] ? 0.0 : 1.0;
      for (let s = 0; s < order && renderIdx < bondState.frameOffset; s++) {
        bondColor0.data[renderIdx * 4 + 3] = alpha;
        bondColor1.data[renderIdx * 4 + 3] = alpha;
        renderIdx++;
      }
    }
    bondState.uploadBuffer("instanceColor0");
    bondState.uploadBuffer("instanceColor1");
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
