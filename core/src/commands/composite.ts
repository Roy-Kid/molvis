import { Command } from "./base";
import { MolvisApp } from "../core/app";

/**
 * CompositeCommand allows grouping multiple commands into a single atomic action.
 * Useful for operations that involve multiple steps (e.g., creating an atom AND a bond).
 */
export class CompositeCommand extends Command<void> {
    private commands: Command<any>[];

    constructor(app: MolvisApp, commands: Command<any>[]) {
        super(app);
        this.commands = commands;
    }

    async do(): Promise<void> {
        for (const cmd of this.commands) {
            await cmd.do();
        }
    }

    async undo(): Promise<Command> {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            await this.commands[i].undo();
        }
        return this;
    }
}
