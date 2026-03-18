import {
  Engine,
  type Mesh,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "@babylonjs/core";
import type { MolvisApp } from "../app";

// Module-level scratch vector for lighting uniform updates.
// Avoids allocating a new Vector3 on every onBind callback (~120/sec at 60fps).
const TMP_LIGHT_DIR = new Vector3();

/**
 * Create the impostor shader material for atom or bond rendering.
 */
export function createImpostorMaterial(
  name: string,
  scene: Scene,
  app: MolvisApp,
): ShaderMaterial {
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

  material.backFaceCulling = false;
  material.alphaMode = Engine.ALPHA_COMBINE;
  material.disableDepthWrite = false;
  material.forceDepthWrite = true;

  applyLightingUniforms(material, app);

  material.onBindObservable.add(() => {
    if (!material) return;
    material.setMatrix("view", scene.getViewMatrix());
    material.setMatrix("projection", scene.getProjectionMatrix());
    material.setFloat(
      "uPickingEnabled",
      app.world.picker?.isPicking ? 1.0 : 0.0,
    );
    applyLightingUniforms(material, app);
  });

  return material;
}

function applyLightingUniforms(material: ShaderMaterial, app: MolvisApp): void {
  const lighting = app.settings.getLighting();
  const zDir = app.config.useRightHandedSystem
    ? -lighting.lightDir[2]
    : lighting.lightDir[2];

  TMP_LIGHT_DIR.set(lighting.lightDir[0], lighting.lightDir[1], zDir);

  material.setVector3("lightDir", TMP_LIGHT_DIR);
  material.setFloat("lightAmbient", lighting.ambient);
  material.setFloat("lightDiffuse", lighting.diffuse);
  material.setFloat("lightSpecular", lighting.specular);
  material.setFloat("lightSpecularPower", lighting.specularPower);
  material.setFloat("uPickingEnabled", 0.0);
}

/**
 * Compile a shader material against a mesh, ensuring the instanced variant is ready.
 */
export async function compileShaderMaterial(
  mesh: Mesh,
  material: ShaderMaterial | null,
  label: string,
): Promise<void> {
  if (!material) {
    throw new Error(`Missing shader material for ${label}`);
  }
  if (material.isReady(mesh, true)) return;

  await material.forceCompilationAsync(mesh, { useInstances: true });

  if (!material.isReady(mesh, true)) {
    throw new Error(
      `Shader material "${material.name}" for ${label} is not ready after compilation`,
    );
  }
}
