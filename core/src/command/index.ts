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

    public execute = (cmd: string, args: Record<string, unknown>) => {
        const Cmd = classRegistry.get(cmd);
        if (Cmd) {
            const command = new Cmd(this._app);
            console.log("command", command);
            return command.do(args);
        }
        throw new Error(`Command ${cmd} not found`);
    }
    
}

export { Executor };