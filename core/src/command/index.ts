import { classRegistry } from "./base";
import "./draw";
import type { Molvis } from "@molvis/core";

class Executor {

    private _app: Molvis;
    // private _commands: ICommand[] = [];

    constructor(app: Molvis) {
        this._app = app;
    }

    public list() {
        return classRegistry.keys();
    }

    public execute = (cmd: string, args: object) => {
        const Cmd = classRegistry.get(cmd);
        if (Cmd) {
            const command = new Cmd(args);
            return command.do(this._app);
        }
        throw new Error(`Command ${cmd} not found`);
    }
    
}

export { Executor };