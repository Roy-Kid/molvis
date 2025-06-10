import { PointerInfo, MeshBuilder, StandardMaterial, Color3, type Mesh } from "@babylonjs/core";
import { get_vec3_from_screen_with_depth } from "./utils";
import { BaseMode, ModeType } from "./base";
import type { Molvis, Atom } from "@molvis/core";
import { draw_atom, draw_bond } from "../artist";
import { System } from "../system";

class EditMode extends BaseMode {
  private _startAtom: Atom | null = null;
  private _previewAtom: Mesh | null = null;
  private _previewBond: Mesh | null = null;

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
  }

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);
    if (pointerInfo.event.button === 0) {
      const mesh = this.pick_mesh();
      if (mesh && mesh.name.startsWith("atom:")) {
        const name = mesh.name.substring(5);
        this._startAtom =
          this.system.current_frame.atoms.find((a) => a.name === name) || null;
        // disable camera control when start dragging from an atom
        this.world.camera.detachControl(
          this.world.scene.getEngine().getRenderingCanvas(),
        );
      } else {
        const xyz = get_vec3_from_screen_with_depth(
          this.world.scene,
          pointerInfo.event.clientX,
          pointerInfo.event.clientY,
          10,
        );
        const atomName = `a_${System.random_atom_id()}`;
        const atom = this.system.current_frame.add_atom(
          atomName,
          xyz.x,
          xyz.y,
          xyz.z,
          { type: "C" },
        );
        draw_atom(this.app, atom, {});
      }
    }
  }

  override _on_pointer_move(pointerInfo: PointerInfo) {
    super._on_pointer_move(pointerInfo);
    if (this._startAtom && pointerInfo.event.buttons === 1) {
      const xyz = get_vec3_from_screen_with_depth(
        this.world.scene,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY,
        10,
      );

      if (!this._previewAtom) {
        this._previewAtom = MeshBuilder.CreateSphere(
          "preview_atom",
          { diameter: 0.5 },
          this.world.scene,
        );
        const mat = new StandardMaterial("preview_atom_mat", this.world.scene);
        mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
        this._previewAtom.material = mat;

        this._previewBond = MeshBuilder.CreateTube(
          "preview_bond",
          { path: [this._startAtom.xyz, xyz], radius: 0.05, updatable: true },
          this.world.scene,
        );
        const bmat = new StandardMaterial("preview_bond_mat", this.world.scene);
        bmat.diffuseColor = new Color3(0.8, 0.8, 0.8);
        this._previewBond.material = bmat;
      } else {
        this._previewAtom.position = xyz;
        MeshBuilder.CreateTube(
          "preview_bond",
          { path: [this._startAtom.xyz, xyz], instance: this._previewBond },
        );
      }
    }
  }

  override _on_pointer_up(pointerInfo: PointerInfo) {
    super._on_pointer_up(pointerInfo);
    if (pointerInfo.event.button === 0 && this._startAtom) {
      if (this._previewAtom) {
        const xyz = this._previewAtom.position;
        const type = this._startAtom.get("type") as string | undefined;
        const newAtom = this.system.current_frame.add_atom(
          `a_${System.random_atom_id()}`,
          xyz.x,
          xyz.y,
          xyz.z,
          { type },
        );
        draw_atom(this.app, newAtom, {});
        const bond = this.system.current_frame.add_bond(
          this._startAtom,
          newAtom,
        );
        draw_bond(this.app, bond, {});
      }

      if (this._previewAtom) {
        this._previewAtom.dispose();
        this._previewAtom = null;
      }
      if (this._previewBond) {
        this._previewBond.dispose();
        this._previewBond = null;
      }

      this.world.camera.attachControl(
        this.world.scene.getEngine().getRenderingCanvas(),
        false,
      );

      this._startAtom = null;
    } else if (pointerInfo.event.button === 2) {
      if (!this._is_dragging) {
        const mesh = this.pick_mesh();
        if (mesh && mesh.name.startsWith("atom:")) {
          const name = mesh.name.substring(5);
          const atom = this.system.current_frame.atoms.find(
            (a) => a.name === name,
          );
          if (atom) {
            this.system.current_frame.remove_atom(atom);
            for (const m of this.world.scene.meshes.slice()) {
              if (
                m.name === mesh.name ||
                (m.name.startsWith("bond:") && m.name.includes(name))
              ) {
                m.dispose();
              }
            }
          }
        }
      }
    }
  }
}

export { EditMode };
