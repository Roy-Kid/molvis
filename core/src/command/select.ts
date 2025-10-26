import type { Mesh } from "@babylonjs/core";
import type { IEntity } from "../structure/base";
import { defineCommand } from "./base";

defineCommand("get_select", (ctx) => {
  const subgroup = ctx.app.world.meshGroup.getSubgroup("selected");
  const meshes = (subgroup?.getChildren() as Mesh[]) ?? [];
  const entities = meshes
    .map((mesh) => mesh.metadata)
    .filter((entity): entity is IEntity => entity !== undefined);

  return [meshes, entities] as const;
});
