import { Vector3, type Scene, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import type { Palette } from "../commands/palette";
import { Command } from "../commands/base";
import {
    DrawAtomCommand,
    DrawBondCommand,
    DeleteAtomCommand,
    DeleteBondCommand,
    type DrawAtomOptions,
    type DrawBondOptions
} from "../commands/draw";

/**
 * Artist options for initialization
 */
export interface ArtistOptions {
    palette: Palette;
    scene: Scene;
    app: MolvisApp;
}

/**
 * Artist class - Thin orchestration layer for drawing operations
 * 
 * Delegates all mesh creation/deletion to Command objects.
 * Manages undo/redo stacks.
 */
export class Artist {
    private palette: Palette;
    private scene: Scene;
    private app: MolvisApp;
    private materialCache: Map<string, StandardMaterial>;

    // Undo/Redo stacks store Command instances
    private undoStack: Command[];
    private redoStack: Command[];

    constructor(options: ArtistOptions) {
        this.palette = options.palette;
        this.scene = options.scene;
        this.app = options.app;
        this.materialCache = new Map();
        this.undoStack = [];
        this.redoStack = [];
    }

    // ============ Drawing Methods ============

    /**
     * Draw an atom at the specified position
     */
    drawAtom(position: Vector3, options: DrawAtomOptions): Mesh {
        const command = new DrawAtomCommand(
            this.app,
            position,
            options,
            this.palette,
            this.scene,
            this.materialCache
        );

        const mesh = command.do();
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack on new action

        return mesh;
    }

    /**
     * Draw a bond between two positions
     */
    drawBond(start: Vector3, end: Vector3, options: DrawBondOptions = {}): Mesh {
        const command = new DrawBondCommand(
            this.app,
            start,
            end,
            options,
            this.palette,
            this.scene,
            this.materialCache
        );

        const mesh = command.do();
        this.undoStack.push(command);
        this.redoStack = [];

        return mesh;
    }

    /**
     * Delete an atom and all connected bonds
     */
    deleteAtom(mesh: Mesh): void {
        const command = new DeleteAtomCommand(this.app, mesh, this.scene);
        command.do();
        this.undoStack.push(command);
        this.redoStack = [];
    }

    /**
     * Delete a bond
     */
    deleteBond(mesh: Mesh): void {
        const command = new DeleteBondCommand(this.app, mesh);
        command.do();
        this.undoStack.push(command);
        this.redoStack = [];
    }

    // ============ Undo/Redo Management ============

    /**
     * Undo the last operation
     */
    undo(): Command | null {
        if (this.undoStack.length === 0) {
            return null;
        }

        const command = this.undoStack.pop()!;
        command.undo();
        this.redoStack.push(command);

        return command;
    }

    /**
     * Redo the last undone operation
     */
    redo(): Command | null {
        if (this.redoStack.length === 0) {
            return null;
        }

        const command = this.redoStack.pop()!;
        command.do();
        this.undoStack.push(command);

        return command;
    }

    /**
     * Clear undo/redo history
     */
    clearHistory(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    // ============ Cleanup ============

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.materialCache.forEach(mat => mat.dispose());
        this.materialCache.clear();
        this.clearHistory();
    }
}
