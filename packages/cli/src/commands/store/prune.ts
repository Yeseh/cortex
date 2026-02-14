/**
 * Store prune command for removing expired memories.
 *
 * This command removes expired memories from the current store or a specified
 * store. It supports a dry-run mode to preview what would be deleted.
 *
 * @module cli/commands/store/prune
 *
 * @example
 * ```bash
 * # Prune expired memories from the current store
 * cortex store prune
 *
 * # Preview what would be pruned (dry-run)
 * cortex store prune --dry-run
 *
 * # Prune from a specific store
 * cortex --store work store prune
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { resolveStoreAdapter } from '../../context.ts';
import {
    pruneExpiredMemories,
} from '@yeseh/cortex-core/memory';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';

/**
 * Options for the prune command.
 */
export interface PruneCommandOptions {
    /** Show what would be pruned without actually deleting */
    dryRun?: boolean;
}

/**
 * Dependencies for the prune command handler.
 * Allows injection for testing.
 */
export interface PruneHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Current time for expiry checks (defaults to new Date()) */
    now?: Date;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

/**
 * Handles the prune command execution.
 *
 * Thin CLI handler that delegates all business logic to the core
 * {@link pruneExpiredMemories} operation. This handler is responsible
 * only for:
 * 1. Resolving the store adapter (from `storeName` or the default store)
 * 2. Calling the core prune operation with the appropriate serializer
 * 3. Formatting output for the CLI (dry-run preview vs. deletion summary)
 *
 * After pruning, the core operation automatically triggers a reindex to
 * clean up category indexes for removed memories.
 *
 * @module cli/commands/store/prune
 *
 * @param options - Command options controlling pruning behavior
 * @param options.dryRun - When `true`, lists expired memories without deleting
 * @param storeName - Optional store name from the parent `--store` flag;
 *   when `undefined`, resolves the default store
 * @param deps - Optional injected dependencies for testing
 * @throws {InvalidArgumentError} When the store cannot be resolved
 *   (e.g., store name does not exist)
 * @throws {CommanderError} When the core prune operation fails
 *   (e.g., I/O errors, serialization failures)
 *
 * @example
 * ```typescript
 * // Direct invocation in tests
 * const out = new PassThrough();
 * await handlePrune({ dryRun: true }, 'my-store', {
 *   stdout: out,
 *   now: new Date('2025-01-01'),
 *   adapter: mockAdapter,
 * });
 * ```
 */
export async function handlePrune(
    options: PruneCommandOptions,
    storeName: string | undefined,
    deps: PruneHandlerDeps = {},
): Promise<void> {
    // 1. Resolve store adapter
    const now = deps.now ?? new Date();
    let adapter: ScopedStorageAdapter;

    if (deps.adapter) {
        adapter = deps.adapter;
    }
    else {
        const storeResult = await resolveStoreAdapter(storeName);
        if (!storeResult.ok()) {
            throwCoreError(storeResult.error);
        }
        adapter = storeResult.value.adapter;
    }

    // 2. Delegate to core operation
    const result = await pruneExpiredMemories(adapter, {
        dryRun: options.dryRun,
        now,
    });

    if (!result.ok()) {
        throwCoreError(result.error);
    }

    const pruned = result.value.pruned;
    const out = deps.stdout ?? process.stdout;

    // 3. Format output
    if (pruned.length === 0) {
        out.write('No expired memories found.\n');
        return;
    }

    const paths = pruned.map((entry) => entry.path).join('\n  ');
    if (options.dryRun) {
        out.write(`Would prune ${pruned.length} expired memories:\n  ${paths}\n`);
    }
    else {
        out.write(`Pruned ${pruned.length} expired memories:\n  ${paths}\n`);
    }
}

/**
 * The `prune` subcommand for removing expired memories.
 *
 * Removes all expired memories from the store. Use --dry-run to preview
 * what would be deleted without actually removing anything.
 *
 * @example
 * ```bash
 * cortex store prune
 * cortex store prune --dry-run
 * ```
 */
export const pruneCommand = new Command('prune')
    .description('Remove expired memories from the store')
    .option('--dry-run', 'Show what would be pruned without deleting')
    .action(async (options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handlePrune(options, parentOpts?.store);
    });
