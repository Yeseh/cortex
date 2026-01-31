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
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreAdapter } from '../../../context.ts';
import { validateMemorySlugPath } from '../../../../core/memory/validation.ts';
import type { ScopedStorageAdapter } from '../../../../core/storage/adapter.ts';

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
    if (!storeResult.ok) {
        mapCoreError(storeResult.error);
    }

    // 2. Validate the memory path
    const pathResult = validateMemorySlugPath(path);
    if (!pathResult.ok) {
        mapCoreError(pathResult.error);
    }

    // 3. Remove the memory file
    const adapter = deps.adapter ?? storeResult.value.adapter;
    const removeResult = await adapter.memories.remove(pathResult.value.slugPath);
    if (!removeResult.ok) {
        mapCoreError({ code: 'REMOVE_FAILED', message: removeResult.error.message });
    }

    // 4. Output success message
    const out = deps.stdout ?? process.stdout;
    out.write(`Removed memory at ${pathResult.value.slugPath}.\n`);
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
