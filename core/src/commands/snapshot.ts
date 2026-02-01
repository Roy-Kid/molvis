import { type MolvisApp } from "../core/app";
import { Command, command } from "./base";
import * as BABYLON from "@babylonjs/core";

/**
 * Command to take a snapshot of the current view.
 */
@command("take_snapshot")
export class TakeSnapshotCommand extends Command<{ data: string }> {

    constructor(app: MolvisApp, args: any) {
        super(app);
    }

    async do(): Promise<{ data: string }> {
        return new Promise((resolve, reject) => {
            try {
                const scene = this.app.world.scene;
                BABYLON.Tools.CreateScreenshot(
                    scene.getEngine(),
                    scene.activeCamera!,
                    { width: scene.getEngine().getRenderWidth(), height: scene.getEngine().getRenderHeight() },
                    (data) => {
                        // data is a base64 string
                        resolve({ data });
                    }
                );
            } catch (e) {
                reject(e);
            }
        });
    }

    undo(): Command {
        return this;
    }
}
