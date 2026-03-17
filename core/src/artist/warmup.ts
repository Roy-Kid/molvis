import {
  type Mesh,
  MeshBuilder,
  type Scene,
  type ShaderMaterial,
} from "@babylonjs/core";

/**
 * Create a temporary warmup mesh with minimal instance buffers.
 * Used to trigger shader compilation without polluting the real renderer meshes.
 */
export function createWarmupMesh(
  name: string,
  scene: Scene,
  material: ShaderMaterial,
  target: "atom" | "bond",
): Mesh {
  const mesh = MeshBuilder.CreatePlane(name, { size: 1.0 }, scene);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.isVisible = false;

  const matrix = new Float32Array(16);
  matrix[0] = 1;
  matrix[5] = 1;
  matrix[10] = 1;
  matrix[15] = 1;
  mesh.thinInstanceSetBuffer("matrix", matrix, 16, false);

  if (target === "atom") {
    mesh.thinInstanceSetBuffer(
      "instanceData",
      new Float32Array([0, 0, 0, 0.5]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instanceColor",
      new Float32Array([1, 1, 1, 1]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instancePickingColor",
      new Float32Array([0, 0, 0, 1]),
      4,
      false,
    );
  } else {
    mesh.thinInstanceSetBuffer(
      "instanceData0",
      new Float32Array([0, 0, 0, 0.1]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instanceData1",
      new Float32Array([0, 1, 0, 1]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instanceColor0",
      new Float32Array([1, 1, 1, 1]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instanceColor1",
      new Float32Array([1, 1, 1, 1]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instanceSplit",
      new Float32Array([0, 0, 0, 0]),
      4,
      false,
    );
    mesh.thinInstanceSetBuffer(
      "instancePickingColor",
      new Float32Array([0, 0, 0, 1]),
      4,
      false,
    );
  }

  mesh.thinInstanceCount = 1;
  return mesh;
}
