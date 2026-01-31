/**
 * Commander.js program setup for Cortex CLI.
 *
 * This module sets up the main Commander program and wires together
 * all command groups. It serves as the entry point for the CLI.
 *
 * @module cli/program
 */

import { Command } from '@commander-js/extra-typings';

import { memoryCommand } from './commands/memory/index.ts';
import { storeCommand } from './commands/store/index.ts';
import { initCommand } from './commands/init/command.ts';

/**
 * The main Commander program instance for Cortex CLI.
 *
 * Configured with:
 * - Name: cortex
 * - Description: Memory system for AI agents
 * - Version: 0.1.0
 *
 * @example
 * ```ts
 * import { program } from './program.ts';
 * await program.parseAsync(process.argv);
 * ```
 */
const program = new Command()
    .name('cortex')
    .description('Memory system for AI agents')
    .version('0.1.0');

program.addCommand(memoryCommand);
program.addCommand(storeCommand);
program.addCommand(initCommand);

export { program };

/**
 * Runs the CLI program by parsing command-line arguments.
 *
 * This function handles errors gracefully and sets the appropriate
 * exit code on failure.
 *
 * @returns A promise that resolves when the program completes
 *
 * @example
 * ```ts
 * import { runProgram } from './program.ts';
 * await runProgram();
 * ```
 */
export const runProgram = async (): Promise<void> => {
    try {
        await program.parseAsync(process.argv);
    }
    catch (error) {
        // Commander.js handles most errors by writing to stderr and exiting.
        // This catch handles any unexpected errors that slip through.
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        }
        else {
            console.error('An unexpected error occurred');
        }
        process.exitCode = 1;
    }
};
