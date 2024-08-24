import { World } from './world';
import { System } from './system';
import { EditMode, Mode, ViewMode } from './mode';

interface JsonRpcRequest {
    jsonrpc: string;
    method: string;
    params?: object;
    id?: string | number | null;
}


class Molvis {

    private _world: World;
    private _system: System;
    private _mode: Mode;
    private _canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
        this._world = new World(canvas);
        this._system = new System();
        this._mode = this.switch_mode('edit');
    }

    get world(): World {
        return this._world;
    }

    get system(): System {
        return this._system;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    public switch_mode = (mode: string): Mode => {
        switch (mode) {
            case 'edit':
                this._mode = new EditMode(this);
                break;
            case 'view':
                this._mode = new ViewMode(this);
                break;
            default:
                throw new Error("Invalid mode");
        }
        return this._mode;
    }

    public add_atom = (x: number, y: number, z: number, props: Map<string, any>) => {
        const atom = this._system.current_frame.add_atom(x, y, z, props);
        this._world.artist.draw_atom(atom);
    }

    public exec_cmd = (request: JsonRpcRequest, buffers: DataView[]) => {
        const { jsonrpc, method, params, id } = request;
        if (jsonrpc !== "2.0") {
            return {
                jsonrpc: "2.0",
                error: { code: -32600, message: "Invalid JSON-RPC version" },
                id: id || null,
            };
        }

        const func = (this as any)[method];
        if (!func) {
            return {
                jsonrpc: "2.0",
                error: { code: -32601, message: "Method not found" },
                id: id || null,
            };
        }

        try {
            console.log("start exec", method, " with ", params);
            const result = func(...Object.values(params || {}));
            console.log("exec_cmd result", result);
            return {
                jsonrpc: "2.0",
                result,
                id: id || null,
            }
        } catch (error: any) {
            return {
                jsonrpc: "2.0",
                error: { code: -32603, message: error.message, data: error.stack },
                id: id || null,
            };
        }
    }

    public render = () => {
        this._world.render();
    }

}

export { Molvis };