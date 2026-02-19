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

import { addCommand } from './add.ts';
import { showCommand } from './show.ts';
import { updateCommand } from './update.ts';
import { removeCommand } from './remove.ts';
import { moveCommand } from './move.ts';
import { listCommand } from './list.ts';

/**
 * The `memory` command group.
 *
 * Provides memory management operations. The `--store` option allows
 * targeting a specific named store instead of the default store.
 * This option is inherited by all subcommands.
 */
export const memoryCommand = new Command('memory')
    .description('Memory operations')
    .option('-s, --store <name>', 'Use a specific named store');

memoryCommand.addCommand(addCommand);
memoryCommand.addCommand(showCommand);
memoryCommand.addCommand(updateCommand);
memoryCommand.addCommand(removeCommand);
memoryCommand.addCommand(moveCommand);
memoryCommand.addCommand(listCommand);
