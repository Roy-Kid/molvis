import type { IEntity } from "../system/base";
import type { IModifier } from "./base";
import { registerModifier } from "./base";
import type { Mesh } from "@babylonjs/core";
import { Color3, HighlightLayer } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";

@registerModifier("type_select")
class TypeSelect implements IModifier {
  private _type: string;
  private _highlight: boolean;

  constructor(args: {type: string, hightlight: boolean}) {
    const type = args.type;
    let hightlight = args.hightlight;
    if (hightlight === undefined) {
      hightlight = true;
    }
    this._type = type;
    this._highlight = hightlight;
  }

  public modify(
    app: Molvis,
    selected: Mesh[],
    entities: IEntity[],
  ): [Mesh[], IEntity[]] {
    const new_selected = [];
    const new_items = [];
    for (let i = 0; i < selected.length; i++) {
      const item = entities[i];
      if (item.get("type") === this._type) {
        new_selected.push(selected[i]);
        new_items.push(item);
      }
    }
    if (this._highlight) {
      const _highlight_layer = new HighlightLayer(
        "highlight_type_select",
        app.scene,
      );
      for (const mesh of new_selected) {
        _highlight_layer.addMesh(mesh as Mesh, Color3.Red());
      }
    }
    return [new_selected, new_items];
  }
}

export { TypeSelect };
