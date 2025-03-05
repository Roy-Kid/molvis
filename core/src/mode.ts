import {
  PointerEventTypes,
  PointerInfo,
  AbstractMesh,
  Mesh,
  Vector3,
  Scene,
  Matrix,
  Color3,
  RayHelper,
  Observer,
  KeyboardEventTypes,
  KeyboardInfo,
} from "@babylonjs/core";

import { Molvis } from "./app";
import { World } from "./world";
import { System, Bond, Atom } from "./system";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-core" });

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
    let is_successful = this._scene.onPointerObservable.remove(
      this._pointer_observer
    );
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
  }

  private register_keyboard_events = () => {
    return this._scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "e":
              this._on_press_e();
              break;
            case "q":
              this._on_press_q();
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
  _on_press_e(): void {}
  _on_press_q(): void {}

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

class ViewMode extends Mode {
  constructor(app: Molvis) {
    super(ModeType.View, app);
    // Initialize by showing frame information
    this._updateFrameInfo();
  }

  override _on_mouse_down(pointerInfo: PointerInfo) {
  }

  override _on_mouse_up(pointerInfo: PointerInfo) {}

  override _on_mouse_move(pointerInfo: PointerInfo) {
    const pick_info = pointerInfo.pickInfo;
    if (pick_info && pick_info.pickedMesh !== null) {
      const picked_mesh = pick_info.pickedMesh;
      const mesh_name = picked_mesh.name;
      const type = mesh_name.split(":")[0];
      const name = mesh_name.split(":")[1];
      let entity = undefined;
      switch (type) {
        case "atom":
          entity = this._system.current_frame.get_atom(
            (atom: Atom) => atom['name'] == name
          );
          break;
        case "bond":
          entity = this._system.current_frame.get_bond(
            (bond: Bond) => bond.name == name
          );
          break;
      }
      if (entity) {
        this._world.update_info_text(`${type}: ${name} (${entity.get('type')})`);
      }
    }
  }

  override _on_mouse_wheel(pointerInfo: PointerInfo) {}

  override _on_mouse_pick(pointerInfo: PointerInfo) {}

  override _on_mouse_tap(pointerInfo: PointerInfo) {}

  override _on_mouse_double_tap(pointerInfo: PointerInfo) {}

  _on_press_e() {
    const frame = this._app.system.next_frame();
    this._app.world.clear();
    this._app.world.artist.draw_frame(frame);
    this._updateFrameInfo();
  }

  _on_press_q() {
    const frame = this._app.system.prev_frame();
    this._app.world.clear();
    this._app.world.artist.draw_frame(frame);
    this._updateFrameInfo();
  }
  
  private _updateFrameInfo() {
    const trajectory = this._app.system.trajectory;
    const currentIndex = trajectory['_current_index']; // We should add a getter for this
    const totalFrames = trajectory.frames.length;
    
    // Update visual frame indicator
    this._world.update_frame_indicator(currentIndex, totalFrames);
    
    logger.debug(`Viewing frame ${currentIndex + 1} of ${totalFrames}`);
  }
  
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

class EditMode extends Mode {
  private _draggingAtomMesh: Mesh | undefined = undefined;
  private _draggingBondMesh: Mesh | undefined = undefined;
  private _startAtom: Atom | undefined = undefined;
  private _draggingAtom: Atom | undefined = undefined;
  private _draggingBond: Bond | undefined = undefined;

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
  }

  override _on_mouse_down(pointerInfo: PointerInfo) {
    if (pointerInfo.event.button !== 0) {
      return;
    }
    this._pos_on_mouse_down = this.get_pointer_xy();

    if (this._is_pick_mesh(pointerInfo)) {
      // 如果点击在已有原子上
      const pickedMesh = pointerInfo.pickInfo!.pickedMesh!;
      if (pickedMesh.name.startsWith("atom:")) {
        const atomName = pickedMesh.name.split(":")[1];
        this._startAtom = this._system.current_frame.get_atom(
          (atom: Atom) => atom.name === atomName
        );
      }
    } else {
      // 点击在空白处，创建新原子
      const xyz = get_vec3_from_screen_with_depth(
        this._scene,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY,
        10
      );
      
      const atomData = new Map<string, any>([
        ["name", `atom_${Date.now()}`],
        ["type", "C"],
        ["x", xyz.x],
        ["y", xyz.y],
        ["z", xyz.z]
      ]);
      
      this._startAtom = this._app.draw_atom(atomData);
    }
  }

  override _on_mouse_move(pointerInfo: PointerInfo) {
    if (!this._startAtom || !this._pos_on_mouse_down) return;

    const xyz = get_vec3_from_screen_with_depth(
      this._scene,
      pointerInfo.event.clientX,
      pointerInfo.event.clientY,
      10
    );

    if (this._is_dragging && !this._draggingAtomMesh) {
      // 首次拖动时创建临时原子和键
      const atomData = new Map<string, any>([
        ["name", `atom_${Date.now()}`],
        ["type", "C"],
        ["x", xyz.x],
        ["y", xyz.y],
        ["z", xyz.z]
      ]);

      // 创建临时原子，但不添加到系统中
      this._draggingAtom = new Atom(atomData);
      this._draggingBond = new Bond(this._draggingAtom, this._startAtom);
      this._draggingAtomMesh = this._world.artist.draw_atom(this._draggingAtom);
      this._draggingBondMesh = this._world.artist.draw_bond(this._draggingBond);
    }

    else if (this._draggingAtomMesh) {
      // 只更新网格位置，不更新系统数据
      this._draggingAtom!.xyz = xyz;
      this._draggingAtomMesh.position = xyz;
      
      // 更新键的位置和方向
      if (this._draggingBondMesh) {
        this._world.artist.draw_bond(
          this._draggingBond!, {
            instance: this._draggingBondMesh
          }
        );
      }
    }
  }

  override _on_mouse_up(pointerInfo: PointerInfo) {
    if (this._draggingAtomMesh && this._draggingAtom) {
      // 鼠标释放时才将数据同步到系统中
      const xyz = this._draggingAtomMesh.position;
      const atomData = new Map<string, any>([
        ["name", this._draggingAtom.name],
        ["type", "C"],
        ["x", xyz.x],
        ["y", xyz.y],
        ["z", xyz.z]
      ]);

      // 添加原子到系统
      const newAtom = this._app.draw_atom(atomData);
      
      // 添加键到系统
      if (this._startAtom) {
        this._app.draw_bond(this._startAtom, newAtom);
      }

      // 清除临时网格
      if (this._draggingBondMesh) {
        this._draggingBondMesh.dispose();
      }
      this._draggingAtomMesh.dispose();
    }

    // 重置所有临时变量
    this._draggingAtomMesh = undefined;
    this._startAtom = undefined;
    this._draggingBondMesh = undefined;
    this._draggingAtom = undefined;
    this._pos_on_mouse_down = undefined;
  }
}

// class ManupulateMode extends Mode {
//   constructor(app: Molvis) {
//     super(ModeType.Manupulate, app);
//   }

//   override _on_mouse_down(pointerInfo: PointerInfo) {}

//   override _on_mouse_up(pointerInfo: PointerInfo) {}

//   override _on_mouse_move(pointerInfo: PointerInfo) {}

//   override _on_mouse_wheel(pointerInfo: PointerInfo) {}

//   override _on_mouse_pick(pointerInfo: PointerInfo) {}

//   override _on_mouse_tap(pointerInfo: PointerInfo) {}

//   override _on_mouse_double_tap(pointerInfo: PointerInfo) {}
// }

export { ViewMode, Mode, ModeType, SelectMode, EditMode };
