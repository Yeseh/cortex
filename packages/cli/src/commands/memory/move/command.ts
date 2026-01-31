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
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreContext } from '../../../context.ts';
import { validateMemorySlugPath } from '@yeseh/cortex-core/memory';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

/** Dependencies injected into the handler for testability */
export interface MoveHandlerDeps {
    stdout?: NodeJS.WritableStream;
}

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
    const contextResult = await resolveStoreContext(storeName);
    if (!contextResult.ok) {
        mapCoreError(contextResult.error);
    }

    // 2. Validate source path
    const sourceResult = validateMemorySlugPath(from);
    if (!sourceResult.ok) {
        mapCoreError({ code: 'INVALID_SOURCE_PATH', message: sourceResult.error.message });
    }

    // 3. Validate destination path
    const destResult = validateMemorySlugPath(to);
    if (!destResult.ok) {
        mapCoreError({ code: 'INVALID_DESTINATION_PATH', message: destResult.error.message });
    }

    // 4. Move the memory file
    const adapter = new FilesystemStorageAdapter({ rootDirectory: contextResult.value.root });
    const moveResult = await adapter.moveMemoryFile(
        sourceResult.value.slugPath,
        destResult.value.slugPath,
    );
    if (!moveResult.ok) {
        mapCoreError({ code: 'MOVE_FAILED', message: moveResult.error.message });
    }

    // 5. Output success message
    const out = deps.stdout ?? process.stdout;
    out.write(`Moved memory from ${sourceResult.value.slugPath} to ${destResult.value.slugPath}.\n`);
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
