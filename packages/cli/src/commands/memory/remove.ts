/**
 * Memory remove command implementation using Commander.js.
 *
 * Deletes an existing memory at the specified path.
 *
 * @example
 * ```bash
 * # Remove a memory
 * cortex memory remove project/tech-stack
 *
 * # Remove memory from a specific store
 * cortex memory --store work remove project/notes
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { resolveStoreAdapter } from '../../context.ts';
import { removeMemory } from '@yeseh/cortex-core/memory';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';

/** Dependencies injected into the handler for testability */
export interface RemoveHandlerDeps {
    stdout?: NodeJS.WritableStream;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

/**
 * Handler for the memory remove command.
 * Exported for direct testing without Commander parsing.
 *
 * @param path - Memory path to remove (e.g., "project/tech-stack")
 * @param storeName - Optional store name from parent command
 * @param deps - Injectable dependencies for testing
 */
export async function handleRemove(
    path: string,
    storeName: string | undefined,
    deps: RemoveHandlerDeps = {},
): Promise<void> {
    // 1. Resolve store context
    const storeResult = await resolveStoreAdapter(storeName);
    if (!storeResult.ok()) {
        throwCoreError(storeResult.error);
    }

    // 2. Remove the memory file
    const adapter = deps.adapter ?? storeResult.value.adapter;
    const removeResult = await removeMemory(adapter, path);
    if (!removeResult.ok()) {
        throwCoreError(removeResult.error);
    }

    // 3. Output success message
    const out = deps.stdout ?? process.stdout;
    out.write(`Removed memory at ${path}.\n`);
}

/**
 * The `memory remove` subcommand.
 *
 * Deletes an existing memory at the specified path.
 *
 * The `--store` option is inherited from the parent `memory` command.
 */
export const removeCommand = new Command('remove')
    .description('Delete a memory')
    .argument('<path>', 'Memory path to remove')
    .action(async (path, _options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handleRemove(path, parentOpts?.store);
    });
