import { Scene, MeshBuilder, Vector3 } from "@babylonjs/core";
import { Atom, Bond } from "./system";

class Artist {

    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public draw_atom(atom: Atom) {
        const sphere = MeshBuilder.CreateSphere("atom", { diameter: 1 }, this._scene);
        sphere.position = atom.position;
        
        return sphere;
    }

    public draw_bond(bond: Bond) {
        const height = Vector3.Distance(bond.itom.position, bond.jtom.position);
        const cylinder = MeshBuilder.CreateCylinder("bond", { diameter: 0.1, height: height }, this._scene);
        cylinder.position = bond.itom.position.add(bond.jtom.position).scale(0.5);
        cylinder.lookAt(bond.jtom.position);
        cylinder.rotation.x = Math.PI / 2;


        return cylinder;
    }

}

export { Artist };