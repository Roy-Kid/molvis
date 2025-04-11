import type { Mesh } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import { IEntity } from "../system/base";

const modifierRegistry = new Map<string, ModifierConstructor>();
const registerModifier = (name: string) => {
    return (target: ModifierConstructor) => {
        console.log(`Registering modifier: ${name}`);
        modifierRegistry.set(name, target);
    }
}

interface IModifier {
    modify(app: Molvis, selected: Mesh[], entities: IEntity[]): [Mesh[], IEntity[]];
}

interface ModifierConstructor {
    new(...args: any[]): IModifier;
}


class Pipeline {

    private _modifiers: IModifier[] = [];

    public append = (name: string, args: {}) => {
        const Modifier = modifierRegistry.get(name);
        if (Modifier) {
            this._modifiers.push(new Modifier(...Object.values(args)));
        }
        else {
            throw new Error(`Modifier ${name} not found`);
        }
    };

    public modify = (app: Molvis, selected: Mesh[], entity: IEntity[]) => {
        for (let i = 0; i < this._modifiers.length; i++) {
            const modifier = this._modifiers[i];
            [selected, entity] = modifier.modify(app, selected, entity);
        }
        return selected;
    };

}

export { Pipeline, registerModifier };
export type { IModifier, ModifierConstructor };