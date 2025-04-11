import { IArtist, registerArtist } from "./artist";
import { Scene } from "@babylonjs/core";
import type { AbstractMesh } from "@babylonjs/core";
import { Atom } from "@molvis/core/system";

@registerArtist("draw_atom")
class DrawAtom implements IArtist {

    private _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    public draw(atom: Atom): AbstractMesh[] {
        const elem = atom.get("element") as string ?? "";
        const name = atom.get("name") as string ?? "";
        let identifier: string = elem;
        if (elem === "") {
            identifier = name;
        }
        const color = realAtomPalette.getAtomColor(identifier as string);
        const radius = realAtomPalette.getAtomRadius(identifier as string);
        const sphere = MeshBuilder.CreateSphere(
            `atom:${atom.name}`,
            { diameter: radius },
            this._scene,
        );
        const material = new StandardMaterial("atom", this._scene);
        material.diffuseColor = Color3.FromHexString(color);
        sphere.material = material;
        sphere.position = atom.xyz;
        sphere.enablePointerMoveEvents = true;
        return [sphere];
    }
}