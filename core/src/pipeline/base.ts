import type { Mesh } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import type { IEntity } from "../system/base";

const modifierRegistry = new Map<string, ModifierConstructor>();
const registerModifier = (name: string) => {
  return (target: ModifierConstructor) => {
    modifierRegistry.set(name, target);
  };
};

interface IModifier {
  modify(
    app: Molvis,
    selected: Mesh[],
    entities: IEntity[],
  ): [Mesh[], IEntity[]];
}

interface ModifierConstructor {
  new (...args: any[]): IModifier;
}

class Pipeline {
  private _modifiers: IModifier[] = [];

  public append = (name: string, args: object) => {
    const Modifier = modifierRegistry.get(name);
    if (Modifier) {
      this._modifiers.push(new Modifier(args));
    } else {
      throw new Error(`Modifier ${name} not found`);
    }
  };

  public modify = (
    app: Molvis,
    selected: Mesh[],
    entity: IEntity[],
  ): [Mesh[], IEntity[]] => {
    let upstream_selected = selected;
    let upstream_entity = entity;
    for (let i = 0; i < this._modifiers.length; i++) {
      const modifier = this._modifiers[i];
      [upstream_selected, upstream_entity] = modifier.modify(
        app,
        upstream_selected,
        upstream_entity,
      );
    }
    return [upstream_selected, upstream_entity];
  };
}

export { Pipeline, registerModifier };
export type { IModifier, ModifierConstructor };
