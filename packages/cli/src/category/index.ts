/**
 * Category command group for the CLI.
 *
 * This module defines the `category` command group, which provides operations
 * for managing categories in the Cortex memory system. The `--store` option
 * is defined at the group level and inherited by all subcommands.
 */

import { Command } from '@commander-js/extra-typings';

import { createCommand } from './commands/create';

/**
 * The `category` command group.
 *
 * Provides category management operations. The `--store` option allows
 * targeting a specific named store instead of the default store.
 * This option is inherited by all subcommands.
 */
export const categoryCommand = new Command('category')
    .description('Category operations')
    .option('-s, --store <name>', 'Use a specific named store');

categoryCommand.addCommand(createCommand);
