import {
    KeyboardEventTypes,
    type KeyboardInfo,
} from "@babylonjs/core";

import { Logger } from "tslog";
import { World, System, GuiManager } from "@molvis/core";

const logger = new Logger({ name: "molvis-core" });

import { ModeType, BaseMode } from "./base";
// import { EditMode } from "./edit";
// import { SelectMode } from "./select";
import { ViewMode } from "./view";

class Mode {

    private _mode: BaseMode;

    private _system: System;
    private _world: World;
    private _gui: GuiManager;

    constructor(system: System, world: World, gui: GuiManager) {
        this._system = system;
        this._world = world;
        this._gui = gui;
        this._mode = this.switch_mode(ModeType.View);
        this._register_keyboard_events();
    }

    private _register_keyboard_events = () => {
        this._world.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) => {
            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    switch (kbInfo.event.key) {
                        case "1":
                            logger.info("view mode");
                            this.switch_mode(ModeType.View);
                            break;
                        // case "2":
                        //     logger.info("select mode");
                        //     this.switch_mode(ModeType.Select);
                        //     break;
                        // case "3":
                        //     logger.info("edit mode");
                        //     this.switch_mode(ModeType.Edit);
                        //     break;
                        // case "4":
                        //   this._mode = this.switch_mode("manupulate");
                    }
                    break;
            }
        });
        // return new ViewMode(this);
    };

    public switch_mode = (mode: ModeType) => {
        if (this._mode)
            this._mode.finish();
        let _mode;
        switch (mode) {
            // case "edit":
            //     this._mode = new EditMode(this._system, this._world);
            //     break;
            case "view":
                _mode = new ViewMode(this._system, this._world, this._gui);
                break;
            // case "select":
            //     this._mode = new SelectMode(this._system, this._world);
            //     break;
            // case "manupulate":

            default:
                throw new Error(`unknown mode: ${mode}`);
        }
        return _mode;
    }
}

export { Mode };


