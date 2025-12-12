import type { Mesh } from "@babylonjs/core";
import type { MolvisApp as Molvis } from "../core/app";
import { command } from "./decorator";

class SelectCommands {
  @command("get_select")
  static get_select(app: Molvis) {
    const subgroup = app.world.meshGroup.getSubgroup("selected");
    const meshes = (subgroup?.getChildren() as Mesh[]) ?? [];
    const entities = meshes
      .map((mesh) => mesh.metadata)
      .filter((entity): entity is any => entity !== undefined);

    return [meshes, entities] as const;
  }
}

export const get_select = SelectCommands.get_select;
