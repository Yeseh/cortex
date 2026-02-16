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
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { moveMemory, MemoryPath } from '@yeseh/cortex-core/memory';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Handler for the memory move command.
 *
 * Resolves the target store from {@link CortexContext} and moves the memory
 * via the core {@link moveMemory} operation. Exported for direct testing
 * without Commander parsing.
 *
 * @param ctx - CortexContext with cortex client, stdout, stdin, and now.
 * @param from - Source memory path.
 * @param to - Destination memory path.
 * @param storeName - Optional store name from parent command.
 * @returns Promise that resolves after the move output is written.
 *
 * @example
 * ```ts
 * const ctxResult = await createCortexContext();
 * if (ctxResult.ok()) {
 *   await handleMove(ctxResult.value, 'project/old', 'project/new', undefined);
 * }
 * ```
 */
export async function handleMove(
    ctx: CortexContext,
    from: string,
    to: string,
    storeName: string | undefined
): Promise<void> {
    // 1. Resolve store context
    const resolvedStoreName = storeName ?? 'default';
    const adapterResult = ctx.cortex.getStore(resolvedStoreName);
    if (!adapterResult.ok()) {
        throwCoreError(adapterResult.error);
    }
    const adapter = adapterResult.value;

    // 2. Move the memory file
    const moveResult = await moveMemory(adapter, from, to);
    if (!moveResult.ok()) {
        throwCoreError(moveResult.error);
    }

    // 3. Output success message with normalized paths
    // The paths were already validated by moveMemory, so these will succeed
    const normalizedFrom = MemoryPath.fromString(from);
    const normalizedTo = MemoryPath.fromString(to);

    // Use normalized paths if parsing succeeded, fall back to original
    const fromDisplay = normalizedFrom.ok() ? normalizedFrom.value.toString() : from;
    const toDisplay = normalizedTo.ok() ? normalizedTo.value.toString() : to;
    ctx.stdout.write(`Moved memory from ${fromDisplay} to ${toDisplay}.\n`);
}

/**
 * Builds the `memory move` subcommand.
 *
 * Moves a memory from one path to another within the store.
 * Both paths must be valid memory slug paths.
 *
 * The `--store` option is inherited from the parent `memory` command.
 *
 * @param ctx - CortexContext providing the Cortex client and I/O streams.
 * @returns A configured Commander subcommand for `memory move`.
 */
export const createMoveCommand = (ctx: CortexContext) => {
    return new Command('move')
        .description('Move a memory to a new path')
        .argument('<from>', 'Source memory path')
        .argument('<to>', 'Destination memory path')
        .action(async (from, to, _options, command) => {
            const parentOpts = command.parent?.opts() as { store?: string } | undefined;
            await handleMove(ctx, from, to, parentOpts?.store);
        });
};
