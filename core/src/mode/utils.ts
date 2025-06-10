import { AbstractMesh, Scene, Vector3, Matrix, RayHelper, Color3 } from "@babylonjs/core";

function highlight_mesh(mesh: AbstractMesh) {
  mesh.renderOutline = !mesh.renderOutline;
}

function get_vec3_from_screen_with_depth(
  scene: Scene,
  x: number,
  y: number,
  depth: number,
  debug = false,
): Vector3 {
  const ray = scene.createPickingRay(
    x,
    y,
    Matrix.Identity(),
    scene.activeCamera,
  );
  const xyz = ray.origin.add(ray.direction.scale(depth));
  if (debug) {
    const rayHelper = new RayHelper(ray);
    rayHelper.show(scene, new Color3(1, 1, 0.5));
  }
  return xyz;
}

export { highlight_mesh, get_vec3_from_screen_with_depth };
