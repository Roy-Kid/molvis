import {
  type AbstractMesh,
  Constants,
  RenderTargetTexture,
  type Scene,
  ShaderMaterial,
} from "@babylonjs/core";
import type { HitResult } from "../mode/types";
import type { MolvisApp } from "./app";

/**
 * ID Encoder/Decoder Constants
 */
const MESH_ID_BITS = 12; // 4096 meshes max
const INSTANCE_ID_BITS = 20; // 1M instances per mesh max
const MAX_MESH_ID = (1 << MESH_ID_BITS) - 1;
const MAX_INSTANCE_ID = (1 << INSTANCE_ID_BITS) - 1;

export class Picker {
  private app: MolvisApp;
  private scene: Scene;
  private pickingTexture: RenderTargetTexture | null = null;
  private _pickingEnabled = false;
  private atomPickingMaterial: ShaderMaterial | null = null;
  private bondPickingMaterial: ShaderMaterial | null = null;

  constructor(app: MolvisApp, scene: Scene) {
    this.app = app;
    this.scene = scene;
  }

  /**
   * Pick top-most object at screen coordinates (x, y).
   * Returns HitResult with type 'empty' if nothing hit.
   */
  public async pick(x: number, y: number): Promise<HitResult> {
    if (!this.ensureTexture()) {
      return { type: "empty" };
    }
    this.ensurePickingMaterials();

    const engine = this.scene.getEngine();
    const canvas = engine.getRenderingCanvas();
    if (!canvas) return { type: "empty" };

    const scaling = engine.getHardwareScalingLevel();
    const texHeight = this.pickingTexture?.getRenderHeight();

    // Perform render
    this.renderPickingScene();

    // Canvas Y is top-down, Texture/WebGL Y is bottom-up (usually).
    const glY = texHeight - y / scaling - 1;
    const glX = x / scaling;

    // Async read from the texture
    const rttWrapper = this.pickingTexture?.renderTarget;
    if (rttWrapper) {
      engine.bindFramebuffer(rttWrapper);
    }

    const buffer = await engine.readPixels(
      Math.floor(glX),
      Math.floor(glY),
      1,
      1,
    );

    if (rttWrapper) {
      engine.unBindFramebuffer(rttWrapper);
    }

    if (!buffer) return { type: "empty" };
    const data = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );

    // Decode RGBA -> ID
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = data[3];

    if (r === 0 && g === 0 && b === 0 && a === 0) {
      return { type: "empty" };
    }

    // Reconstruct 32-bit int
    const fullId = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

    const meshId = fullId >>> INSTANCE_ID_BITS;
    const thinId = fullId & MAX_INSTANCE_ID;

    // All picking now uses the impostor pipeline
    const mesh = this.findMeshByShortId(meshId);
    if (!mesh) return { type: "empty" };

    const meta = this.app.world.sceneIndex.getMeta(mesh.uniqueId, thinId);
    if (!meta) return { type: "empty" };

    return {
      type: meta.type as "atom" | "bond",
      mesh,
      thinInstanceIndex: thinId,
      metadata: meta,
    };
  }

  /**
   * Create or resize RTT if needed.
   */
  private ensureTexture(): boolean {
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();

    if (
      this.pickingTexture &&
      (this.pickingTexture.getRenderWidth() !== width ||
        this.pickingTexture.getRenderHeight() !== height)
    ) {
      this.pickingTexture.dispose();
      this.pickingTexture = null;
    }

    if (!this.pickingTexture) {
      this.pickingTexture = new RenderTargetTexture(
        "pickingTexture",
        { width, height },
        this.scene,
        false, // No generate mipmaps
        true, // Do not change aspect ratio
        Constants.TEXTURETYPE_UNSIGNED_BYTE,
        false, // isCube
        undefined,
        true, // generateDepthBuffer (Required for correct depth testing)
        false, // generateStencilBuffer
      );
    }
    return true;
  }

  private ensurePickingMaterials() {
    if (!this.atomPickingMaterial) {
      this.atomPickingMaterial = new ShaderMaterial(
        "atomMat_picking",
        this.scene,
        { vertex: "sphereImpostor", fragment: "sphereImpostor" },
        {
          attributes: [
            "position",
            "uv",
            "instanceData",
            "instanceColor",
            "instancePickingColor",
          ],
          uniforms: ["view", "projection", "uPickingEnabled"],
        },
      );
      this.atomPickingMaterial.backFaceCulling = false;
      this.atomPickingMaterial.alphaMode = Constants.ALPHA_DISABLE;
      this.atomPickingMaterial.disableDepthWrite = false;

      this.atomPickingMaterial.onBindObservable.add((_mesh) => {
        this.atomPickingMaterial?.setMatrix("view", this.scene.getViewMatrix());
        this.atomPickingMaterial?.setMatrix(
          "projection",
          this.scene.getProjectionMatrix(),
        );
        this.atomPickingMaterial?.setFloat("uPickingEnabled", 1.0);
      });
    }

    if (!this.bondPickingMaterial) {
      this.bondPickingMaterial = new ShaderMaterial(
        "bondMat_picking",
        this.scene,
        { vertex: "bondImpostor", fragment: "bondImpostor" },
        {
          attributes: [
            "position",
            "uv",
            "instanceData0",
            "instanceData1",
            "instanceColor0",
            "instanceColor1",
            "instanceSplit",
            "instancePickingColor",
          ],
          uniforms: ["view", "projection", "uPickingEnabled"],
        },
      );
      this.bondPickingMaterial.backFaceCulling = false;
      this.bondPickingMaterial.alphaMode = Constants.ALPHA_DISABLE;
      this.bondPickingMaterial.disableDepthWrite = false;

      this.bondPickingMaterial.onBindObservable.add((_mesh) => {
        this.bondPickingMaterial?.setMatrix("view", this.scene.getViewMatrix());
        this.bondPickingMaterial?.setMatrix(
          "projection",
          this.scene.getProjectionMatrix(),
        );
        this.bondPickingMaterial?.setFloat("uPickingEnabled", 1.0);
      });
    }
  }

  /**
   * Render the scene in picking mode.
   * All atoms/bonds use the impostor pipeline (ThinInstances).
   */
  private renderPickingScene() {
    if (!this.pickingTexture) return;

    this._pickingEnabled = true;

    this.pickingTexture.renderList = [];
    for (const m of this.scene.meshes) {
      const isAtom =
        m.name.startsWith("atom_base") ||
        m.name.startsWith("edit_atom_base") ||
        m.name.startsWith("manip_atom_base");
      const isBond =
        m.name.startsWith("bond_base") ||
        m.name.startsWith("edit_bond_base") ||
        m.name.startsWith("manip_bond_base");

      if (isAtom && this.atomPickingMaterial) {
        this.pickingTexture?.renderList?.push(m);
        this.pickingTexture?.setMaterialForRendering(
          m,
          this.atomPickingMaterial,
        );
      } else if (isBond && this.bondPickingMaterial) {
        this.pickingTexture?.renderList?.push(m);
        this.pickingTexture?.setMaterialForRendering(
          m,
          this.bondPickingMaterial,
        );
      }
    }

    this.pickingTexture.render(false, false);

    this._pickingEnabled = false;
  }

  public get isPicking(): boolean {
    return this._pickingEnabled;
  }

  private findMeshByShortId(id: number): AbstractMesh | undefined {
    return this.scene.getMeshByUniqueId(id) || undefined;
  }
}

/**
 * Helper to encode ID (MeshID << 20 | ThinID) to Normalized Color Array
 */
export function encodePickingColor(
  meshId: number,
  thinId: number,
): [number, number, number, number] {
  const fullId =
    ((meshId & MAX_MESH_ID) << INSTANCE_ID_BITS) | (thinId & MAX_INSTANCE_ID);

  const r = ((fullId >>> 24) & 0xff) / 255.0;
  const g = ((fullId >>> 16) & 0xff) / 255.0;
  const b = ((fullId >>> 8) & 0xff) / 255.0;
  const a = (fullId & 0xff) / 255.0;

  return [r, g, b, a];
}
