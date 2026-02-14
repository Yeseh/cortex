/**
 * Store command group for the Cortex CLI.
 *
 * Provides store management operations including listing, adding, removing,
 * and initializing memory stores. Also includes maintenance commands for
 * pruning expired memories and reindexing stores.
 *
 * The `--store` option is defined at the group level and inherited by all
 * subcommands, allowing users to specify which store to operate on.
 *
 * @example
 * ```bash
 * cortex store list                 # List all registered stores
 * cortex store add <name> <path>    # Register a store
 * cortex store remove <name>        # Unregister a store
 * cortex store init [path]          # Initialize a new store
 * cortex store prune                # Remove expired memories
 * cortex store reindex              # Rebuild store indexes
 * ```
 */
import { Command } from '@commander-js/extra-typings';

import { listCommand } from './list.ts';
import { addCommand } from './add.ts';
import { removeCommand } from './remove.ts';
import { initCommand } from './init.ts';
import { pruneCommand } from './prune.ts';
import { reindexCommand } from './reindexs.ts';

/**
 * Store command group.
 *
 * The `--store` option is inherited by all subcommands, allowing operations
 * to target a specific named store rather than using automatic store resolution.
 */
export const storeCommand = new Command('store')
    .description('Store management')
    .option('-s, --store <name>', 'Use a specific named store');

storeCommand.addCommand(listCommand);
storeCommand.addCommand(addCommand);
storeCommand.addCommand(removeCommand);
storeCommand.addCommand(initCommand);
storeCommand.addCommand(pruneCommand);
storeCommand.addCommand(reindexCommand);
