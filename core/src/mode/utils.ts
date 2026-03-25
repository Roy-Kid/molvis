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
  pointerX: number,
  pointerY: number,
  anchor?: Vector3,
): Vector3 {
  const forward = camera.getDirection(Vector3.Forward());
  const normal = forward.scale(-1).normalize();
  const origin =
    anchor ?? (camera as ArcRotateCamera).target ?? camera.position.add(normal);
  const plane = Plane.FromPositionAndNormal(origin, normal);

  // Use Babylon's picking ray transform path directly.
  // It applies hardware scaling and camera viewport offsets internally.
  const ray = scene.createPickingRay(
    pointerX,
    pointerY,
    Matrix.Identity(),
    camera,
  );
  const hit = ray.intersectsPlane(plane);
  if (!hit) {
    throw new Error("Cannot project point onto screen-aligned plane.");
  }
  return ray.origin.add(ray.direction.scale(hit));
}
