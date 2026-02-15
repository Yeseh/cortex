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
import { resolveStoreAdapter } from '../../context.ts';
import { moveMemory, MemoryPath } from '@yeseh/cortex-core/memory';
import { type ScopedStorageAdapter, type CortexContext } from '@yeseh/cortex-core';

/** Dependencies injected into the handler for testability */
export interface MoveHandlerDeps {
    stdout?: NodeJS.WritableStream;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
    /** CortexContext for store resolution (preferred over direct adapter injection) */
    ctx?: CortexContext;
}

const resolveAdapter = async (
    storeName: string | undefined,
    deps: MoveHandlerDeps,
): Promise<ScopedStorageAdapter> => {
    // Use pre-resolved adapter if provided (for testing)
    if (deps.adapter) {
        return deps.adapter;
    }

    // Use CortexContext if provided (preferred path)
    if (deps.ctx && storeName) {
        const result = deps.ctx.cortex.getStore(storeName);
        if (!result.ok()) {
            throwCoreError(result.error);
        }
        return result.value;
    }

    // Fall back to existing resolution (for backward compatibility)
    const storeResult = await resolveStoreAdapter(storeName);
    if (!storeResult.ok()) {
        throwCoreError(storeResult.error);
    }

    return storeResult.value.adapter;
};

/**
 * Handler for the memory move command.
 * Exported for direct testing without Commander parsing.
 *
 * @param from - Source memory path
 * @param to - Destination memory path
 * @param storeName - Optional store name from parent command
 * @param deps - Injectable dependencies for testing
 */
export async function handleMove(
    from: string,
    to: string,
    storeName: string | undefined,
    deps: MoveHandlerDeps = {},
): Promise<void> {
    // 1. Resolve store context
    const adapter = await resolveAdapter(storeName, deps);

    // 2. Move the memory file
    const moveResult = await moveMemory(adapter, from, to);
    if (!moveResult.ok()) {
        throwCoreError(moveResult.error);
    }

    // 3. Output success message with normalized paths
    // The paths were already validated by moveMemory, so these will succeed
    const normalizedFrom = MemoryPath.fromString(from);
    const normalizedTo = MemoryPath.fromString(to);
    const out = deps.stdout ?? process.stdout;
    
    // Use normalized paths if parsing succeeded, fall back to original
    const fromDisplay = normalizedFrom.ok() ? normalizedFrom.value.toString() : from;
    const toDisplay = normalizedTo.ok() ? normalizedTo.value.toString() : to;
    out.write(`Moved memory from ${fromDisplay} to ${toDisplay}.\n`);
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
        await handleMove(from, to, parentOpts?.store);
    });
