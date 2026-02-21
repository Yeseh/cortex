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
import { throwCliError } from '../../errors.ts';
import { MemoryPath, type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

/**
 * Handler for the memory remove command.
 * Exported for direct testing without Commander parsing.
 *
 * @param ctx - CLI context containing Cortex client and streams
 * @param storeName - Optional store name from parent command
 * @param path - Memory path to remove (e.g., "project/tech-stack")
 */
export async function handleRemove(
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
): Promise<void> {
    const pathResult = MemoryPath.fromString(path);
    if (!pathResult.ok()) {
        throwCliError(pathResult.error);
    }

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    const categoryResult = pathResult.value.category.isRoot
        ? rootResult
        : rootResult.value.getCategory(pathResult.value.category.toString());
    if (!categoryResult.ok()) {
        throwCliError(categoryResult.error);
    }

    const memoryClient = categoryResult.value.getMemory(pathResult.value.slug.toString());
    const removeResult = await memoryClient.delete();
    if (!removeResult.ok()) {
        throwCliError(removeResult.error);
    }

    const out = ctx.stdout ?? process.stdout;
    out.write(`Removed memory ${pathResult.value.toString()}.\n`);
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
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }

        await handleRemove(context.value, parentOpts?.store, path);
    });
