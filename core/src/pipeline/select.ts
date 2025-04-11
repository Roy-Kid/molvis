import { IEntity } from '../system/base';
import { IModifier, registerModifier } from './base';
import { Mesh, Color3, HighlightLayer } from '@babylonjs/core';
import type { Molvis } from '@molvis/core';

@registerModifier("type_select")
class TypeSelect implements IModifier {

    private _type: string;
    private _highlight: boolean;

    constructor(type: string, hightlight: boolean = false) {
        this._type = type;
        this._highlight = hightlight;
        
    }

    public modify(app: Molvis, selected: Mesh[], entities: IEntity[]): [Mesh[], IEntity[]] {

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
            const _highlight_layer = new HighlightLayer("highlight_type_select", app.scene);
            for (const mesh of new_selected) {
                _highlight_layer.addMesh(mesh as Mesh, Color3.Red());
            }
        }
        return [new_selected, new_items];
    }

}

export { TypeSelect };