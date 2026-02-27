/**
 * Store reindex command for rebuilding category indexes.
 *
 * This command rebuilds the category indexes for a store, which can help
 * repair corrupted indexes or synchronize them after manual file changes.
 *
 * @example
 * ```bash
 * # Reindex the default store
 * cortex store reindex
 *
 * # Reindex a specific named store
 * cortex store --store work reindex
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCliError } from '../../errors.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

/**
 * Dependencies for the reindex command handler.
 * Allows injection for testing.
 */
export interface ReindexHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
}

/**
 * Handles the reindex command execution.
 *
 * This function:
 * 1. Resolves the store context (from --store option or default resolution)
 * 2. Gets the root category for the store
 * 3. Rebuilds the category indexes
 * 4. Outputs the result
 *
 * @param ctx - The Cortex context
 * @param storeName - Optional store name from parent --store option
 * @param deps - Optional dependencies for testing
 * @throws {CommanderError} When store resolution or reindexing fails
 */
export async function handleReindex(
    ctx: CortexContext,
    storeName: string | undefined,
    deps: ReindexHandlerDeps = {},
): Promise<void> {
    const stdout = deps.stdout ?? ctx.stdout ?? process.stdout;
    
    // Get store through Cortex client
    const effectiveStoreName = storeName ?? 'global';
    const storeResult = ctx.cortex.getStore(effectiveStoreName);
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    // Use the category's reindex method
    const reindexResult = await rootResult.value.reindex();
    if (!reindexResult.ok()) {
        throwCliError({ code: 'REINDEX_FAILED', message: reindexResult.error.message });
    }

    // Output result
    stdout.write(`Reindexed category indexes for store '${effectiveStoreName}'.\n`);
}

/**
 * The `reindex` subcommand for rebuilding category indexes.
 *
 * Rebuilds the category indexes for a store, which can help repair corrupted
 * indexes or synchronize them after manual file changes.
 *
 * @example
 * ```bash
 * cortex store reindex
 * cortex store --store work reindex
 * ```
 */
export const reindexCommand = new Command('reindex')
    .description('Rebuild category indexes for the store')
    .action(async (_options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }
        await handleReindex(context.value, parentOpts?.store);
    });
