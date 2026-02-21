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
import { throwCliError } from '../../errors.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

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
    /** Current time for expiry checks (defaults to ctx.now()) */
    now?: Date;
}

/**
 * Handles the prune command execution.
 *
 * Thin CLI handler that delegates all business logic to the core
 * prune operation via CategoryClient. This handler is responsible
 * only for:
 * 1. Resolving the store via CortexContext
 * 2. Calling the category prune operation
 * 3. Formatting output for the CLI (dry-run preview vs. deletion summary)
 *
 * After pruning, the core operation automatically triggers a reindex to
 * clean up category indexes for removed memories.
 *
 * @module cli/commands/store/prune
 *
 * @param ctx - CortexContext providing access to Cortex client
 * @param storeName - Optional store name from the parent `--store` flag;
 *   when `undefined`, resolves the default store
 * @param options - Command options controlling pruning behavior
 * @param options.dryRun - When `true`, lists expired memories without deleting
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
 * await handlePrune(ctx, 'my-store', { dryRun: true }, {
 *   stdout: out,
 *   now: new Date('2025-01-01'),
 * });
 * ```
 */
export async function handlePrune(
    ctx: CortexContext,
    storeName: string | undefined,
    options: PruneCommandOptions,
    deps: PruneHandlerDeps = {},
): Promise<void> {
    const now = deps.now ?? ctx.now();
    const stdout = deps.stdout ?? ctx.stdout ?? process.stdout;

    // Get store through Cortex client
    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    // Use the category's prune method
    const result = await rootResult.value.prune({
        dryRun: options.dryRun,
        now,
    });

    if (!result.ok()) {
        throwCliError(result.error);
    }

    const pruned = result.value.pruned;

    // Format output
    if (pruned.length === 0) {
        stdout.write('No expired memories found.\n');
        return;
    }

    const paths = pruned.map((entry) => entry.path).join('\n  ');
    if (options.dryRun) {
        stdout.write(`Would prune ${pruned.length} expired memories:\n  ${paths}\n`);
    }
    else {
        stdout.write(`Pruned ${pruned.length} expired memories:\n  ${paths}\n`);
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
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }
        await handlePrune(context.value, parentOpts?.store, options);
    });
