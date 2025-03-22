import "./draw";
import { classRegistry } from "./base";
import { System, World } from "@molvis/core";

class Executor {

    private _system: System;
    private _world: World;

    constructor(system: System, world: World) {
        this._system = system;
        this._world = world;
    }

    public list() {
        return classRegistry.keys();
    }

    public execute = (cmd: string, args: {}) => {
        const Cmd = classRegistry.get(cmd);
        if (Cmd) {
            const command = new Cmd(...Object.values(args));
            command.execute(this._system, this._world);
        } else {
            throw new Error(`Command ${cmd} not found`);
        }
            
    }
    
}

export { Executor };