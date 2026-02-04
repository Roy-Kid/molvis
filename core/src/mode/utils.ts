import {
  type ArcRotateCamera,
  type Camera,
  Matrix,
  Plane,
  type Scene,
  Vector3,
} from "@babylonjs/core";

/**
 * Calculate a point on a screen-aligned plane.
 * Used for dragging atoms in 3D space while keeping them on a plane facing the camera.
 */
export function pointOnScreenAlignedPlane(
  scene: Scene,
  camera: Camera,
  clientX: number,
  clientY: number,
  anchor?: Vector3,
): Vector3 {
  const engine = scene.getEngine();
  const canvas = engine.getRenderingCanvas();

  let x = clientX;
  let y = clientY;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    x -= rect.left;
    y -= rect.top;
  }
  const s = engine.getHardwareScalingLevel();
  const rx = x * s;
  const ry = y * s;

  const forward = camera.getDirection(Vector3.Forward());
  const normal = forward.scale(-1).normalize();
  const origin =
    anchor ?? (camera as ArcRotateCamera).target ?? camera.position.add(normal);
  const plane = Plane.FromPositionAndNormal(origin, normal);

  const ray = scene.createPickingRay(rx, ry, Matrix.Identity(), camera);
  const hit = ray.intersectsPlane(plane);
  if (!hit) {
    throw new Error("Cannot project point onto screen-aligned plane.");
  }
  return ray.origin.add(ray.direction.scale(hit));
}
