import { Vector3 } from "@babylonjs/core";
import { Command, registerCommand } from "./base";
import { System, World } from "@molvis/core";

@registerCommand("draw_atom")
class DrawAtom implements Command {

    public x: number;
    public y: number;
    public z: number;
    public name: string;
    public element: string;

    constructor(x: number, y: number, z: number, name: string, element: string) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.name = name;
        this.element = element;
        console.log(`DrawAtom: ${this.x}, ${this.y}, ${this.z}, ${this.name}, ${this.element}`);
    }

    public execute(system: System, world: World) {
        const atom = system.current_frame.add_atom(
            this.name,
            new Vector3(this.x, this.y, this.z),
            this.element
        );
        world.artist.draw_atom(atom);
        return atom;
    }
}

export { DrawAtom };