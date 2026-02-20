/**
 * Memory move command implementation using Commander.js.
 *
 * Moves a memory from one path to another within the same store.
 *
 * @example
 * ```bash
 * # Move a memory to a new location
 * cortex memory move project/old-name project/new-name
 *
 * # Move with explicit store
 * cortex memory --store my-store move project/old project/new
 * ```\n */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { MemoryPath, type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

/**
 * Handler for the memory move command.
 * Exported for direct testing without Commander parsing.
 *
 * @param ctx - CLI context containing Cortex client and streams
 * @param storeName - Optional store name from parent command
 * @param from - Source memory path
 * @param to - Destination memory path
 */
export async function handleMove(
    ctx: CortexContext,
    storeName: string | undefined,
    from: string,
    to: string
): Promise<void> {
    const fromResult = MemoryPath.fromString(from);
    if (!fromResult.ok()) {
        throwCoreError(fromResult.error);
    }

    const toResult = MemoryPath.fromString(to);
    if (!toResult.ok()) {
        throwCoreError(toResult.error);
    }

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCoreError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCoreError(rootResult.error);
    }

    const sourceCategoryResult = rootResult.value.getCategory(fromResult.value.category.toString());
    if (!sourceCategoryResult.ok()) {
        throwCoreError(sourceCategoryResult.error);
    }

    const sourceMemory = sourceCategoryResult.value.getMemory(fromResult.value.slug.toString());
    const moveResult = await sourceMemory.move(toResult.value);
    if (!moveResult.ok()) {
        throwCoreError(moveResult.error);
    }

    const out = ctx.stdout ?? process.stdout;
    out.write(`Moved memory ${fromResult.value.toString()} to ${toResult.value.toString()}.\n`);
}

/**
 * The `memory move` subcommand.
 *
 * Moves a memory from one path to another within the store.
 * Both paths must be valid memory slug paths.
 *
 * The `--store` option is inherited from the parent `memory` command.
 */
export const moveCommand = new Command('move')
    .description('Move a memory to a new path')
    .argument('<from>', 'Source memory path')
    .argument('<to>', 'Destination memory path')
    .action(async (from, to, _options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCoreError(context.error);
        }

        await handleMove(context.value, parentOpts?.store, from, to);
    });
