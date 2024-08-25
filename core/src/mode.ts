import {
  PointerEventTypes,
  PointerInfo,
  AbstractMesh,
  Vector3,
  Scene,
  Matrix,
  Color3,
  RayHelper,
  PointerDragBehavior,
  ExecuteCodeAction,
  ActionManager,
} from "@babylonjs/core";

import { Molvis } from "./app";
import { World } from "./world";
import { System } from "./system";

function highlight_mesh(mesh: AbstractMesh) {
  mesh.renderOutline = !mesh.renderOutline;
}

function get_vec3_from_screen_with_depth(
  scene: Scene,
  x: number,
  y: number,
  depth: number,
  debug: boolean = false
): Vector3 {
  // cast a ray from the camera to xy screen position
  // get the Vector3 of the intersection point with a plane at depth
  const ray = scene.createPickingRay(
    x,
    y,
    Matrix.Identity(),
    scene.activeCamera
  );
  const xyz = ray.origin.add(ray.direction.scale(depth));
  if (debug) {
    const rayHelper = new RayHelper(ray);
    rayHelper.show(scene, new Color3(1, 1, 0.5));
  }
  return xyz;
}

enum ModeType {
  Edit = "edit",
  View = "view",
}

abstract class Mode {
  name: ModeType | undefined;
  protected _app: Molvis;
  protected _world: World;
  protected _system: System;
  protected _scene: Scene;

  protected _pos_on_mouse_down: { x: number; y: number } | undefined;
  protected _mesh_on_mouse_down: AbstractMesh | undefined;

  constructor(name: ModeType, app: Molvis) {
    this.name = name;
    this._app = app;
    this._world = app.world;
    this._system = app.system;
    this._scene = app.world.scene;
    this.register_pointer_events();
    this._pos_on_mouse_down = this.get_pointer_xy();
  }

  private register_pointer_events() {
    this._world.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          this._on_mouse_down(pointerInfo);
          break;
        case PointerEventTypes.POINTERUP:
          this._on_mouse_up(pointerInfo);
          break;
        case PointerEventTypes.POINTERMOVE:
          this._on_mouse_move(pointerInfo);
          break;
        case PointerEventTypes.POINTERWHEEL:
          this._on_mouse_wheel(pointerInfo);
          break;
        case PointerEventTypes.POINTERPICK:
          this._on_mouse_pick(pointerInfo);
          break;
        case PointerEventTypes.POINTERTAP:
          this._on_mouse_tap(pointerInfo);
          break;
        case PointerEventTypes.POINTERDOUBLETAP:
          this._on_mouse_double_tap(pointerInfo);
          break;
      }
    });
  }

  abstract _on_mouse_down(pointerInfo: PointerInfo): void;
  abstract _on_mouse_up(pointerInfo: PointerInfo): void;
  abstract _on_mouse_move(pointerInfo: PointerInfo): void;
  abstract _on_mouse_wheel(pointerInfo: PointerInfo): void;
  abstract _on_mouse_pick(pointerInfo: PointerInfo): void;
  abstract _on_mouse_tap(pointerInfo: PointerInfo): void;
  abstract _on_mouse_double_tap(pointerInfo: PointerInfo): void;

  protected get_pointer_xy(): { x: number; y: number } {
    return { x: this._scene.pointerX, y: this._scene.pointerY };
  }

  get _is_dragging(): boolean {
    return (
      this._pos_on_mouse_down!.x !== this._scene.pointerX ||
      this._pos_on_mouse_down!.y !== this._scene.pointerY
    );
  }

  protected _is_pick_mesh(pointerInfo: PointerInfo): boolean {
    return (
      pointerInfo.pickInfo !== null && pointerInfo.pickInfo.pickedMesh !== null
    );
  }
}

class EditMode extends Mode {
  is_first_move: boolean = false;

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
  }

  override _on_mouse_down(pointerInfo: PointerInfo) {
    this._pos_on_mouse_down = {
      x: this._scene.pointerX,
      y: this._scene.pointerY,
    };

    if (this._is_pick_mesh(pointerInfo)) {
      this._mesh_on_mouse_down = pointerInfo.pickInfo!.pickedMesh!;
    }

    // hit selected mesh
  }

  override _on_mouse_up(pointerInfo: PointerInfo) {
    if (pointerInfo.pickInfo) {
      const picked_mesh = pointerInfo.pickInfo.pickedMesh;

      if (picked_mesh) {
        // click mesh
        if (!this._is_dragging) highlight_mesh(picked_mesh);
        // drag mesh
        else {
        }
      } else {
        // click empty
        if (!this._is_dragging && this._pos_on_mouse_down) {
          const xyz = get_vec3_from_screen_with_depth(
            this._scene,
            this._pos_on_mouse_down.x,
            this._pos_on_mouse_down.y,
            10
          );
          this._app.add_atom(xyz.x, xyz.y, xyz.z, new Map());
        }
        // else: drag empty
      }
    }

    // reset
    this._pos_on_mouse_down = undefined;
    this._mesh_on_mouse_down = undefined;
    this.is_first_move = true;
  }

  _on_mouse_move = (pointerInfo: PointerInfo) => {
    // hit mesh and dragging
    if (this._mesh_on_mouse_down && this._is_dragging) {
      this._world.camera.detachControl();
      // hit selected mesh
      if (this.is_first_move) {
        const atom_mesh = this._mesh_on_mouse_down.clone("drag_atom", null)!;
        const pointer_drag_bahavior = new PointerDragBehavior({
          dragPlaneNormal: this._mesh_on_mouse_down.position.subtract(
            this._world.camera.position
          ),
        });
        this._mesh_on_mouse_down.removeBehavior(
          this._mesh_on_mouse_down.getBehaviorByName(
            pointer_drag_bahavior.name
          )!
        );
        pointer_drag_bahavior.useObjectOrientationForDragging = false;
        atom_mesh.addBehavior(pointer_drag_bahavior);
        pointer_drag_bahavior.startDrag();
        this.is_first_move = false;
      }

      // hit unselected mesh
      this._world.camera.attachControl();
    }
  };

  override _on_mouse_wheel(pointerInfo: PointerInfo) {}

  override _on_mouse_pick(pointerInfo: PointerInfo) {}

  override _on_mouse_tap(pointerInfo: PointerInfo) {}

  override _on_mouse_double_tap(pointerInfo: PointerInfo) {}
}

class ViewMode extends Mode {
  constructor(app: Molvis) {
    super(ModeType.View, app);
  }

  override _on_mouse_down(pointerInfo: PointerInfo) {}

  override _on_mouse_up(pointerInfo: PointerInfo) {}

  override _on_mouse_move(pointerInfo: PointerInfo) {}

  override _on_mouse_wheel(pointerInfo: PointerInfo) {}

  override _on_mouse_pick(pointerInfo: PointerInfo) {}

  override _on_mouse_tap(pointerInfo: PointerInfo) {}

  override _on_mouse_double_tap(pointerInfo: PointerInfo) {}
}

export { EditMode, ViewMode, Mode };
