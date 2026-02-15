/**
 * Memory command group for the CLI.
 *
 * This module defines the `memory` command group, which provides operations
 * for managing memories in the Cortex memory system. The `--store` option
 * is defined at the group level and inherited by all subcommands.
 *
 * @example
 * ```bash
 * # Use default store
 * cortex memory add project/notes --content "Hello"
 *
 * # Use specific store
 * cortex memory --store my-store add project/notes --content "Hello"
 * cortex memory -s my-store list
 * ```
 */

import { Command } from '@commander-js/extra-typings';

import { type CortexContext } from '@yeseh/cortex-core';
import { createAddCommand } from './add.ts';
import { createShowCommand } from './show.ts';
import { createUpdateCommand } from './update.ts';
import { createRemoveCommand } from './remove.ts';
import { createMoveCommand } from './move.ts';
import { createListCommand } from './list.ts';

/**
 * The `memory` command group.
 *
 * Provides memory management operations. The `--store` option allows
 * targeting a specific named store instead of the default store.
 * This option is inherited by all subcommands.
 *
 * Edge case: This function only wires subcommands; errors surface when
 * individual command handlers execute.
 *
 * @module commands/memory
 * @param ctx - Shared CLI context used to resolve adapters and I/O streams.
 * @returns The configured Commander command for the `memory` group.
 *
 * @example
 * ```ts
 * const memoryCommand = createMemoryCommand(ctx);
 * program.addCommand(memoryCommand);
 * ```
 */
export const createMemoryCommand = (ctx: CortexContext) => {
    const memoryCommand = new Command('memory')
        .description('Memory operations')
        .option('-s, --store <name>', 'Use a specific named store');

    memoryCommand.addCommand(createAddCommand(ctx));
    memoryCommand.addCommand(createShowCommand(ctx));
    memoryCommand.addCommand(createUpdateCommand(ctx));
    memoryCommand.addCommand(createRemoveCommand(ctx));
    memoryCommand.addCommand(createMoveCommand(ctx));
    memoryCommand.addCommand(createListCommand(ctx));

    return memoryCommand;
};
