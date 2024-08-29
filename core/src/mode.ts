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
  MeshBuilder,
  Observer,
  KeyboardEventTypes,
  KeyboardInfo,
} from "@babylonjs/core";

import { Molvis } from "./app";
import { World } from "./world";
import { System, Bond, Atom } from "./system";

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
  Select = "select",
  Manupulate = "manupulate",
}

abstract class Mode {
  name: ModeType | undefined;
  protected _app: Molvis;
  protected _world: World;
  protected _system: System;
  protected _scene: Scene;
  private _pointer_observer: Observer<PointerInfo>;
  private _kb_observer: Observer<KeyboardInfo>;

  protected _pos_on_mouse_down: { x: number; y: number } | undefined;
  protected _mesh_on_mouse_down: AbstractMesh | undefined;

  constructor(name: ModeType, app: Molvis) {
    this.name = name;
    this._app = app;
    this._world = app.world;
    this._system = app.system;
    this._scene = app.world.scene;
    this._pointer_observer = this.register_pointer_events();
    this._kb_observer = this.register_keyboard_events();

    this._pos_on_mouse_down = this.get_pointer_xy();
  }

  public finish() {
    this.unregister_pointer_events();
  }

  private unregister_pointer_events = () => {
    let is_successful = this._scene.onPointerObservable.remove(this._pointer_observer);
    if (!is_successful) {
    }
  };

  private register_pointer_events() {
    return this._scene.onPointerObservable.add((pointerInfo) => {
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

  };

  private register_keyboard_events = () => {
    return this._scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "ArrowRight":
              console.log("ArrowRight");
              break;
          }
          break;
      }
    });

  };

  _on_mouse_down(pointerInfo: PointerInfo): void {}
  _on_mouse_up(pointerInfo: PointerInfo): void {}
  _on_mouse_move(pointerInfo: PointerInfo): void {}
  _on_mouse_wheel(pointerInfo: PointerInfo): void {}
  _on_mouse_pick(pointerInfo: PointerInfo): void {}
  _on_mouse_tap(pointerInfo: PointerInfo): void {}
  _on_mouse_double_tap(pointerInfo: PointerInfo): void {}

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
  private is_first_move: boolean = true;

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
        // if (!this._is_dragging)
        // drag mesh
      } else {
        // click empty
        if (!this._is_dragging && this._pos_on_mouse_down) {
          const xyz = get_vec3_from_screen_with_depth(
            this._scene,
            this._pos_on_mouse_down.x,
            this._pos_on_mouse_down.y,
            10
          );
          this._app.add_atom(
            System.random_atom_id(),
            xyz.x,
            xyz.y,
            xyz.z,
            new Map()
          );
        }
        // else: drag empty
      }

      // concretet dragging atom and bond
      if (this._is_dragging && this._mesh_on_mouse_down) {
        const drag_on_atom = this._system.current_frame.get_atom_by_name(
          this._mesh_on_mouse_down.name.substring(4)
        );
        const dragging_atom_mesh = this._scene.getMeshByName("_dragging_atom");
        const dragging_bond_mesh =
          this._scene.getMeshByName("bond_on_dragging");
        dragging_atom_mesh!.name = `atom${System.random_atom_id()}`;
        const dragging_atom = this._system.current_frame.add_atom(
          dragging_atom_mesh!.name,
          dragging_atom_mesh!.position.x,
          dragging_atom_mesh!.position.y,
          dragging_atom_mesh!.position.z,
          drag_on_atom?.props
        );
        const dragging_bond = this._system.current_frame.add_bond(
          drag_on_atom!,
          dragging_atom,
          new Map()
        );
        dragging_bond_mesh!.name = dragging_bond.name;
      }
    }

    // reset
    this._pos_on_mouse_down = undefined;
    this._mesh_on_mouse_down = undefined;
    this.is_first_move = true;

    // concrete dragging atom and bond
  }

  _on_mouse_move = (pointerInfo: PointerInfo) => {
    // hit mesh and dragging
    if (this._mesh_on_mouse_down && this._is_dragging) {
      this._world.camera.detachControl();
      // hit selected mesh
      if (
        this.is_first_move &&
        this._mesh_on_mouse_down.name.startsWith("atom")
      ) {
        const atom_mesh_on_dragging = this._mesh_on_mouse_down.clone(
          `_dragging_atom`,
          null
        )!;
        const on_drag_start_position = atom_mesh_on_dragging.position.clone();

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

        const bond_raidus = 0.1;
        let bond_mesh_on_dragging = MeshBuilder.CreateTube(
          `bond_on_dragging`,
          {
            path: [on_drag_start_position, on_drag_start_position],
            radius: bond_raidus,
            updatable: true,
          },
          this._scene
        );
        pointer_drag_bahavior.useObjectOrientationForDragging = false;

        pointer_drag_bahavior.onDragObservable.add((event) => {
          bond_mesh_on_dragging = MeshBuilder.CreateTube(`bond_on_dragging`, {
            path: [on_drag_start_position, atom_mesh_on_dragging.position],
            radius: bond_raidus,
            instance: bond_mesh_on_dragging,
            updatable: true,
          });
        });
        atom_mesh_on_dragging.addBehavior(pointer_drag_bahavior);
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

class SelectMode extends Mode {
  private selected: AbstractMesh[] = [];

  constructor(app: Molvis) {
    super(ModeType.Select, app);
  }

  _on_mouse_pick(pointerInfo: PointerInfo): void {
    const picked_mesh = pointerInfo.pickInfo!.pickedMesh!;
    if (picked_mesh) {
      this.selected.push(picked_mesh);
      highlight_mesh(picked_mesh);
    }
  }
}

class ManupulateMode extends Mode {
  constructor(app: Molvis) {
    super(ModeType.Manupulate, app);
  }

  override _on_mouse_down(pointerInfo: PointerInfo) {}

  override _on_mouse_up(pointerInfo: PointerInfo) {}

  override _on_mouse_move(pointerInfo: PointerInfo) {}

  override _on_mouse_wheel(pointerInfo: PointerInfo) {}

  override _on_mouse_pick(pointerInfo: PointerInfo) {}

  override _on_mouse_tap(pointerInfo: PointerInfo) {}

  override _on_mouse_double_tap(pointerInfo: PointerInfo) {}
}

export { EditMode, ViewMode, Mode, ModeType, SelectMode, ManupulateMode };
