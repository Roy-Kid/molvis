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
    // cast a ray from the camera to xy screen position
    // get the Vector3 of the intersection point with a plane at depth
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