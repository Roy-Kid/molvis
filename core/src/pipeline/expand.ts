import { Vector3, Color3, HighlightLayer } from "@babylonjs/core";
import type { Mesh } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import type { IEntity } from "../system/base";
import { Atom } from "../system";
import type { IModifier } from "./base";
import { registerModifier } from "./base";

@registerModifier("expand")
class Expand implements IModifier {
  private _radius: number;
  private _highlight: boolean;

  constructor(args: { radius: number; highlight?: boolean }) {
    this._radius = args.radius;
    this._highlight = args.highlight ?? true;
  }

  public modify(
    app: Molvis,
    selected: Mesh[],
    entities: IEntity[],
  ): [Mesh[], IEntity[]] {
    const newEntities: IEntity[] = [];
    const newMeshes: Mesh[] = [];
    const visited = new Set<IEntity>();
    const atoms = app.system.current_frame.atoms;

    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (!(ent instanceof Atom)) {
        continue;
      }
      for (const atom of atoms) {
        if (visited.has(atom)) {
          continue;
        }
        const dist = Vector3.Distance(ent.xyz, atom.xyz);
        if (dist <= this._radius) {
          visited.add(atom);
          newEntities.push(atom);
          const mesh = app.scene.getMeshByName(`atom:${atom.name}`);
          if (mesh) {
            newMeshes.push(mesh as Mesh);
          }
        }
      }
    }

    if (this._highlight && newMeshes.length > 0) {
      const layer = new HighlightLayer("highlight_expand", app.scene);
      for (const mesh of newMeshes) {
        layer.addMesh(mesh as Mesh, Color3.Blue());
      }
    }

    return [newMeshes, newEntities];
  }
}

export { Expand };
