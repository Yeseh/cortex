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
import { throwCoreError } from '../../errors.ts';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Handles the reindex command execution.
 *
 * This function:
 * 1. Resolves the store adapter from CortexContext
 * 2. Rebuilds the category indexes
 * 3. Outputs the result
 *
 * @param ctx - CortexContext providing store resolution and I/O streams.
 * @param storeName - Optional store name from parent --store option;
 *   when `undefined`, uses the default store resolution.
 * @returns Promise that resolves after output is written.
 * @throws {CommanderError} When store resolution or reindexing fails.
 */
export async function handleReindex(
    ctx: CortexContext,
    storeName: string | undefined
): Promise<void> {
    // 1. Resolve store adapter from context
    const resolvedStoreName = storeName ?? 'default';
    const adapterResult = ctx.cortex.getStore(resolvedStoreName);
    if (!adapterResult.ok()) {
        throwCoreError(adapterResult.error);
    }
    const adapter = adapterResult.value;

    const out = ctx.stdout;

    // 2. Reindex
    const reindexResult = await adapter.indexes.reindex();
    if (!reindexResult.ok()) {
        throwCoreError({ code: 'REINDEX_FAILED', message: reindexResult.error.message });
    }

    // 3. Output result
    out.write(`Reindexed category indexes for ${resolvedStoreName}.\n`);
}

/**
 * Builds the `reindex` subcommand for rebuilding category indexes.
 *
 * Rebuilds the category indexes for a store, which can help repair corrupted
 * indexes or synchronize them after manual file changes.
 *
 * @param ctx - CortexContext providing the Cortex client and output stream.
 * @returns A configured Commander subcommand for `store reindex`.
 *
 * @example
 * ```bash
 * cortex store reindex
 * cortex store --store work reindex
 * ```
 */
export const createReindexCommand = (ctx: CortexContext) => {
    return new Command('reindex')
        .description('Rebuild category indexes for the store')
        .action(async (_options, command) => {
            const parentOpts = command.parent?.opts() as { store?: string } | undefined;
            await handleReindex(ctx, parentOpts?.store);
        });
};
