import { classRegistry } from "./base";
import "./draw";
import { Molvis } from "@molvis/core";

class Executor {

    private _app: Molvis;
    // private _commands: ICommand[] = [];

    constructor(app: Molvis) {
        this._app = app;
    }

    public list() {
        return classRegistry.keys();
    }

    public execute = (cmd: string, args: { [key: string]: any }) => {
        const Cmd = classRegistry.get(cmd);
        if (Cmd) {
            const { x, y, z, name, ...options } = args; // 假设位置参数为 x, y, z, name
            const command = new Cmd(x, y, z, name, options);
            return command.do(this._app);
            // this._commands.push(command);
        } else {
            throw new Error(`Command ${cmd} not found`);
        }
    }
    
}

export { Executor };