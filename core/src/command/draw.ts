import { Vector3, MeshBuilder, Mesh } from "@babylonjs/core";
import { StandardMaterial, Color3 } from "@babylonjs/core";
import { registerCommand } from "./base";
import type { ICommand } from "./base";
import { Molvis } from "@molvis/core";
import { realAtomPalette } from "../artist";
import type { IEntity } from "@molvis/core";

@registerCommand("draw_atom")
class DrawAtom implements ICommand {

    public x: number;
    public y: number;
    public z: number;
    public name: string;
    public props: Record<string, any>;

    constructor(x: number, y: number, z: number, name: string, props: Record<string, any> = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.name = name;
        this.props = props;
    }

    public do(app: Molvis) {
        const atom = app.system.current_frame.add_atom(
            this.name,
            new Vector3(this.x, this.y, this.z),
            this.props
        );

        const atype = atom.get("type") || atom.get("element");
        const name = atom.get("name") as string ?? "";
        let identifier = atype;
        if (atype === "") {
            identifier = name;
        }
        const color = realAtomPalette.getAtomColor(identifier as string);
        const radius = realAtomPalette.getAtomRadius(identifier as string);
        const sphere = MeshBuilder.CreateSphere(
            `atom:${atom.name}`,
            { diameter: radius },
            app.scene,
        );
        const material = new StandardMaterial("atom", app.scene);
        material.diffuseColor = Color3.FromHexString(color);
        sphere.material = material;
        sphere.position = atom.xyz;
        sphere.enablePointerMoveEvents = true;
        return [[sphere], [atom]] as [Mesh[], IEntity[]];
    }

    public undo(app: Molvis) {
        // const atom = app.system.current_frame.get_atom(this.name);
        // if (atom) {
        //     app.artist.do("remove_atom", atom);
        //     app.system.current_frame.remove_atom(atom);
        // }
        // return atom;
    }
}

export { DrawAtom };