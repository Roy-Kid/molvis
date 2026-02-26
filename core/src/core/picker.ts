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
  private _pickInProgress = false;
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
    if (this._pickInProgress) {
      return { type: "empty" };
    }
    if (!this.ensureTexture()) {
      return { type: "empty" };
    }
    this.ensurePickingMaterials();
    this._pickInProgress = true;

    try {
      const engine = this.scene.getEngine();
      const canvas = engine.getRenderingCanvas();
      if (!canvas) return { type: "empty" };

      const texture = this.pickingTexture;
      if (!texture) return { type: "empty" };
      const texWidth = texture.getRenderWidth();
      const texHeight = texture.getRenderHeight();

      // Perform render
      this.renderPickingScene();

      // Map input-space coordinates to picking texture coordinates.
      // This keeps picking stable regardless of how canvas/render target sizes are configured.
      const inputRect = engine.getInputElementClientRect?.();
      const inputWidth = inputRect?.width || canvas.clientWidth || texWidth;
      const inputHeight = inputRect?.height || canvas.clientHeight || texHeight;
      if (inputWidth <= 0 || inputHeight <= 0) {
        return { type: "empty" };
      }

      const normX = x / inputWidth;
      const normY = y / inputHeight;
      const glX = Math.min(
        texWidth - 1,
        Math.max(0, Math.floor(normX * texWidth)),
      );
      const glY = Math.min(
        texHeight - 1,
        Math.max(0, texHeight - Math.floor(normY * texHeight) - 1),
      );

      // Async read from the texture
      const rttWrapper = texture.renderTarget;
      if (rttWrapper) {
        engine.bindFramebuffer(rttWrapper);
      }

      const buffer = await engine.readPixels(
        glX,
        glY,
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

      if (meta.type === "atom") {
        return {
          type: "atom",
          mesh,
          thinInstanceIndex: thinId,
          metadata: meta,
        };
      }
      if (meta.type === "bond") {
        return {
          type: "bond",
          mesh,
          thinInstanceIndex: thinId,
          metadata: meta,
        };
      }
      return { type: "empty" };
    } finally {
      this._pickInProgress = false;
    }
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
   * Uses MeshRegistry to get known atom/bond meshes directly.
   */
  private renderPickingScene() {
    if (!this.pickingTexture) return;

    this._pickingEnabled = true;

    const registry = this.app.world.sceneIndex.meshRegistry;
    this.pickingTexture.renderList = [];

    const atomState = registry.getAtomState();
    if (atomState && this.atomPickingMaterial) {
      this.pickingTexture.renderList.push(atomState.mesh);
      this.pickingTexture.setMaterialForRendering(
        atomState.mesh,
        this.atomPickingMaterial,
      );
    }

    const bondState = registry.getBondState();
    if (bondState && this.bondPickingMaterial) {
      this.pickingTexture.renderList.push(bondState.mesh);
      this.pickingTexture.setMaterialForRendering(
        bondState.mesh,
        this.bondPickingMaterial,
      );
    }

    this.pickingTexture.render(false, false);

    this._pickingEnabled = false;
  }

  public get isPicking(): boolean {
    return this._pickingEnabled;
  }

  private findMeshByShortId(id: number): AbstractMesh | undefined {
    const registry = this.app.world.sceneIndex.meshRegistry;

    const atomState = registry.getAtomState();
    if (atomState && (atomState.mesh.uniqueId & MAX_MESH_ID) === id) {
      return atomState.mesh;
    }

    const bondState = registry.getBondState();
    if (bondState && (bondState.mesh.uniqueId & MAX_MESH_ID) === id) {
      return bondState.mesh;
    }

    return undefined;
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
