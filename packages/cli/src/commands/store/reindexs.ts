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
import { resolveStoreAdapter } from '../../context.ts';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Dependencies for the reindex command handler.
 * Allows injection for testing.
 */
export interface ReindexHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
    /** CortexContext for store resolution (preferred) */
    ctx?: CortexContext;
}

/**
 * Handles the reindex command execution.
 *
 * This function:
 * 1. Resolves the store context (from --store option or default resolution)
 * 2. Creates a filesystem adapter for the store
 * 3. Rebuilds the category indexes
 * 4. Outputs the result
 *
 * @param storeName - Optional store name from parent --store option
 * @param deps - Optional dependencies for testing
 * @throws {CommanderError} When store resolution or reindexing fails
 */
export async function handleReindex(
    storeName: string | undefined,
    deps: ReindexHandlerDeps = {},
): Promise<void> {
    // 1. Resolve store adapter
    let adapter: ScopedStorageAdapter;
    let storeRoot: string;

    // Use pre-resolved adapter if provided (testing)
    if (deps.adapter) {
        adapter = deps.adapter;
        storeRoot = storeName ?? 'test-store';
    }
    // Use CortexContext if provided with store name
    else if (deps.ctx && storeName) {
        const result = deps.ctx.cortex.getStore(storeName);
        if (!result.ok()) {
            throwCoreError(result.error);
        }
        adapter = result.value;
        storeRoot = storeName;
    }
    // Fall back to legacy resolveStoreAdapter
    else {
        const storeResult = await resolveStoreAdapter(storeName);
        if (!storeResult.ok()) {
            throwCoreError(storeResult.error);
        }
        adapter = storeResult.value.adapter;
        storeRoot = storeResult.value.context.root;
    }

    // 2. Reindex
    const reindexResult = await adapter.indexes.reindex();
    if (!reindexResult.ok()) {
        throwCoreError({ code: 'REINDEX_FAILED', message: reindexResult.error.message });
    }

    // 3. Output result
    const out = deps.stdout ?? process.stdout;
    out.write(`Reindexed category indexes for ${storeRoot}.\n`);
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
        await handleReindex(parentOpts?.store);
    });
