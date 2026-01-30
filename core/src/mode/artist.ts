import { Vector3 } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
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
    app: MolvisApp;
}

/**
 * Artist class - Thin orchestration layer for drawing operations
 *
 * Delegates all mesh creation/deletion to Command objects.
 * Manages undo/redo stacks.
 */
export class Artist {
    private app: MolvisApp;

    // Undo/Redo stacks store Command instances
    private undoStack: Command[];
    private redoStack: Command[];

    constructor(options: ArtistOptions) {
        this.app = options.app;
        this.undoStack = [];
        this.redoStack = [];
    }

    // ============ Drawing Methods ============

    /**
     * Draw an atom at the specified position
     */
    drawAtom(position: Vector3, options: DrawAtomOptions): { atomId: number } {
        const command = new DrawAtomCommand(
            this.app,
            position,
            options
        );

        const result = command.do();
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack on new action

        return result;
    }

    /**
     * Draw a bond between two positions
     */
    drawBond(start: Vector3, end: Vector3, options: DrawBondOptions = {}): { bondId: number } {
        const command = new DrawBondCommand(
            this.app,
            start,
            end,
            options
        );

        const result = command.do();
        this.undoStack.push(command);
        this.redoStack = [];

        return result;
    }

    /**
     * Delete an atom and all connected bonds
     */
    deleteAtom(atomId: number): void {
        const command = new DeleteAtomCommand(this.app, atomId);
        command.do();
        this.undoStack.push(command);
        this.redoStack = [];
    }

    /**
     * Delete a bond
     */
    deleteBond(bondId: number): void {
        const command = new DeleteBondCommand(this.app, bondId);
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
        this.clearHistory();
    }
}
