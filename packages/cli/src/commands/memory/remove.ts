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
import { removeMemory, MemoryPath } from '@yeseh/cortex-core/memory';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Handler for the memory remove command.
 *
 * Resolves the target store from {@link CortexContext} and removes the memory
 * via the core {@link removeMemory} operation. Exported for direct testing
 * without Commander parsing.
 *
 * @param ctx - CortexContext with cortex client, stdout, stdin, and now.
 * @param path - Memory path to remove (e.g., "project/tech-stack").
 * @param storeName - Optional store name from parent command.
 * @returns Promise that resolves after the removal output is written.
 *
 * @example
 * ```ts
 * const ctxResult = await createCortexContext();
 * if (ctxResult.ok()) {
 *   await handleRemove(ctxResult.value, 'project/tech-stack', undefined);
 * }
 * ```
 */
export async function handleRemove(
    ctx: CortexContext,
    path: string,
    storeName: string | undefined
): Promise<void> {
    // 1. Resolve store context
    const resolvedStoreName = storeName ?? 'default';
    const adapterResult = ctx.cortex.getStore(resolvedStoreName);
    if (!adapterResult.ok()) {
        throwCoreError(adapterResult.error);
    }
    const adapter = adapterResult.value;

    // 2. Remove the memory file
    const removeResult = await removeMemory(adapter, path);
    if (!removeResult.ok()) {
        throwCoreError(removeResult.error);
    }

    // 3. Output success message with normalized path
    const normalizedPath = MemoryPath.fromString(path);
    const pathDisplay = normalizedPath.ok() ? normalizedPath.value.toString() : path;
    ctx.stdout.write(`Removed memory at ${pathDisplay}.\n`);
}

/**
 * Builds the `memory remove` subcommand.
 *
 * Deletes an existing memory at the specified path.
 *
 * The `--store` option is inherited from the parent `memory` command.
 *
 * @param ctx - CortexContext providing the Cortex client and I/O streams.
 * @returns A configured Commander subcommand for `memory remove`.
 */
export const createRemoveCommand = (ctx: CortexContext) => {
    return new Command('remove')
        .description('Delete a memory')
        .argument('<path>', 'Memory path to remove')
        .action(async (path, _options, command) => {
            const parentOpts = command.parent?.opts() as { store?: string } | undefined;
            await handleRemove(ctx, path, parentOpts?.store);
        });
};
