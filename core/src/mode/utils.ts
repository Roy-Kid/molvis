import {
  Matrix,
  Scene,
  Vector3,
  StandardMaterial, Color3,
  MeshBuilder,
  Camera,
  Plane,
  Ray
} from "@babylonjs/core";

export const getPositionFromMatrix = (buffer: Float32Array, thinIndex: number): Vector3 => {
  const offset = thinIndex * 16;
  return new Vector3(buffer[offset + 12], buffer[offset + 13], buffer[offset + 14]);
};

export const getScaleFromMatrix = (buffer: Float32Array, thinIndex: number): number => {
  const offset = thinIndex * 16;
  const sx = Math.hypot(buffer[offset], buffer[offset + 1], buffer[offset + 2]);
  const sy = Math.hypot(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6]);
  const sz = Math.hypot(buffer[offset + 8], buffer[offset + 9], buffer[offset + 10]);
  return (sx + sy + sz) / 3;
}

export const highlightAtom = (position: Vector3, radius: number, scene: Scene) => {
  // create a transparent sphere on the atom position
  const highlightSphere = MeshBuilder.CreateSphere("highlightAtom", {
    diameter: radius,
    segments: 16,
  }, scene);
  highlightSphere.position = position;

  const highlightMaterial = new StandardMaterial("highlightMaterial", scene);
  highlightMaterial.diffuseColor = new Color3(1, 1, 0); // yellow color
  highlightMaterial.alpha = 0.5; // semi-transparent
  highlightSphere.material = highlightMaterial;

  return highlightSphere;
}

export function pointOnScreenAlignedPlane(
  scene: Scene,
  camera: Camera,
  clientX: number,
  clientY: number,
  anchor?: Vector3
): Vector3 {
  const engine = scene.getEngine();
  const canvas = engine.getRenderingCanvas();

  let x = clientX, y = clientY;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    x -= rect.left; y -= rect.top;
  }
  const s = engine.getHardwareScalingLevel();
  const rx = x * s, ry = y * s;

  const forward = camera.getForwardRay().direction;
  const normal = forward.scale(-1).normalize();
  const origin = anchor ?? (camera as any).target ?? camera.position.add(normal); // 支持非 ArcRotate
  const plane = Plane.FromPositionAndNormal(origin, normal);

  const ray = scene.createPickingRay(rx, ry, Matrix.Identity(), camera);
  const hit = ray.intersectsPlane(plane);
  if (!hit) {
    throw new Error("Cannot project point onto screen-aligned plane.");
  } else {
    return ray.origin.add(ray.direction.scale(hit));
  }
}