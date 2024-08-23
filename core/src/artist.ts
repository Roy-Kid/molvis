import { Scene, MeshBuilder } from "@babylonjs/core";
import { Atom } from "./system";

class Artist {
    
    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public draw_atom(atom: Atom) {
        const sphere = MeshBuilder.CreateSphere("atom", { diameter: 1 }, this._scene);
        sphere.position.x = atom.x;
        sphere.position.y = atom.y;
        sphere.position.z = atom.z;
    }
}

export { Artist };