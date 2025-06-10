import { PointerInfo, MeshBuilder, Mesh, Vector3 } from "@babylonjs/core";
import { BaseMode, ModeType } from "./base";
import { Molvis } from "@molvis/core";
import { Atom } from "../system";
import { get_vec3_from_screen_with_depth } from "./utils";

class EditMode extends BaseMode {
  private _startAtom: Atom | null = null;
  private _preview: Mesh | null = null;

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
  }

  override _on_pointer_down(pi: PointerInfo) {
    if (pi.event.button === 0) {
      const mesh = this.pick_mesh();
      if (mesh && mesh.name.startsWith("atom:")) {
        const name = mesh.name.split(":")[1];
        this._startAtom = this.system.get_atom(a => a.name === name) || null;
      } else {
        const pos = get_vec3_from_screen_with_depth(this.world.scene, pi.event.clientX, pi.event.clientY, 10);
        this._startAtom = this.app.draw_atom(new Map([
          ["name", `atom_${Date.now()}`],
          ["x", pos.x],
          ["y", pos.y],
          ["z", pos.z],
          ["type", "C"],
        ]));
      }
    } else if (pi.event.button === 2) {
      const pick = pi.pickInfo?.pickedMesh;
      if (pick && pick.name.startsWith("atom:")) {
        const name = pick.name.split(":")[1];
        const atom = this.system.get_atom(a => a.name === name);
        if (atom) this.app.remove_atom(atom);
      }
    }
  }

  override _on_pointer_move(pi: PointerInfo) {
    if (pi.event.buttons === 1 && this._startAtom) {
      const pos = get_vec3_from_screen_with_depth(this.world.scene, pi.event.clientX, pi.event.clientY, 10);
      if (!this._preview) {
        this._preview = MeshBuilder.CreateSphere("preview", { diameter: 0.2 }, this.world.scene);
        this._preview.isPickable = false;
      }
      this._preview.position.copyFrom(pos);
    } else if (pi.event.buttons === 2) {
      this.world.camera.target.addInPlace(new Vector3(-pi.event.movementX * 0.01, pi.event.movementY * 0.01, 0));
    }
  }

  override _on_pointer_up(pi: PointerInfo) {
    if (pi.event.button === 0 && this._startAtom && this._preview) {
      const pos = this._preview.position.clone();
      const newAtom = this.app.draw_atom(new Map([
        ["name", `atom_${Date.now()}`],
        ["x", pos.x],
        ["y", pos.y],
        ["z", pos.z],
        ["type", "C"],
      ]));
      this.app.draw_bond(this._startAtom, newAtom);
    }
    if (this._preview) {
      this._preview.dispose();
      this._preview = null;
    }
    this._startAtom = null;
  }
}

export { EditMode };
