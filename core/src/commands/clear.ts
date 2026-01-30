import * as BABYLON from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { Command, command } from "./base";

/**
 * Command to clear all rendering meshes from the scene
 */
@command("clear_scene")
export class ClearSceneCommand extends Command<void> {
    constructor(app: MolvisApp) {
        super(app);
    }

    do(): void {
        const scene = this.app.world.scene;

        // Clear existing atom/bond/box meshes
        const meshesToDispose: BABYLON.AbstractMesh[] = [];
        scene.meshes.forEach((mesh) => {
            // Check if mesh is registered (atom, bond, or box meshes have names)
            if (mesh.name === "atom_base" || mesh.name === "bond_base" || mesh.name === "edit_atom_base" || mesh.name === "edit_bond_base" || mesh.name === "manip_atom_base" || mesh.name === "manip_bond_base" || mesh.name === "sim_box") {
                meshesToDispose.push(mesh);
            }
        });

        meshesToDispose.forEach((m) => {
            this.app.world.sceneIndex.unregister(m.uniqueId);
            m.dispose();
        });
    }

    undo(): Command {
        // Cannot undo a clear operation easily
        // Would need to store all mesh data and recreate
        return this;
    }
}
