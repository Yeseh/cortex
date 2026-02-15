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

import { type CortexContext } from '@yeseh/cortex-core';
import { createListCommand } from './list.ts';
import { createAddCommand } from './add.ts';
import { createRemoveCommand } from './remove.ts';
import { createInitCommand } from './init.ts';
import { createPruneCommand } from './prune.ts';
import { createReindexCommand } from './reindexs.ts';

/**
 * Store command group.
 *
 * The `--store` option is inherited by all subcommands, allowing operations
 * to target a specific named store rather than using automatic store resolution.
 *
 * Edge case: This function only composes subcommands; runtime errors are
 * reported by the individual command handlers.
 *
 * @module commands/store
 * @param ctx - Shared CLI context used to resolve adapters and I/O streams.
 * @returns The configured Commander command for the `store` group.
 *
 * @example
 * ```ts
 * const storeCommand = createStoreCommand(ctx);
 * program.addCommand(storeCommand);
 * ```
 */
export const createStoreCommand = (ctx: CortexContext) => {
    const storeCommand = new Command('store')
        .description('Store management')
        .option('-s, --store <name>', 'Use a specific named store');

    storeCommand.addCommand(createListCommand(ctx));
    storeCommand.addCommand(createAddCommand(ctx));
    storeCommand.addCommand(createRemoveCommand(ctx));
    storeCommand.addCommand(createInitCommand(ctx));
    storeCommand.addCommand(createPruneCommand(ctx));
    storeCommand.addCommand(createReindexCommand(ctx));

    return storeCommand;
};
