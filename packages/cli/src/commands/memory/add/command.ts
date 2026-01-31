/**
 * Memory add command implementation using Commander.js.
 *
 * Creates a new memory at the specified path with content from inline text,
 * a file, or stdin.
 *
 * @example
 * ```bash
 * # Add memory with inline content
 * cortex memory add project/tech-stack --content "Using TypeScript and Node.js"
 *
 * # Add memory from a file
 * cortex memory add project/notes --file ./notes.md
 *
 * # Add memory from stdin
 * echo "My notes" | cortex memory add project/notes
 *
 * # Add memory with tags and expiration
 * cortex memory add project/temp --content "Temporary note" \
 *   --tags "temp,cleanup" --expires-at "2025-12-31T00:00:00Z"
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreAdapter } from '../../../context.ts';

import { validateMemorySlugPath, type Memory } from '@yeseh/cortex-core/memory';
import { serializeMemory } from '@yeseh/cortex-storage-fs';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { resolveMemoryContentInput } from '../../../input.ts';

/** Options parsed by Commander for the add command */
export interface AddCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string;
}

/** Dependencies injected into the handler for testability */
export interface AddHandlerDeps {
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
    now?: Date;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

/**
 * Handler for the memory add command.
 * Exported for direct testing without Commander parsing.
 *
 * @param path - Memory path (e.g., "project/tech-stack")
 * @param options - Command options from Commander
 * @param storeName - Optional store name from parent command
 * @param deps - Injectable dependencies for testing
 */
export async function handleAdd(
    path: string,
    options: AddCommandOptions,
    storeName: string | undefined,
    deps: AddHandlerDeps = {},
): Promise<void> {
    // 1. Resolve store context and adapter
    const storeResult = await resolveStoreAdapter(storeName);
    if (!storeResult.ok) {
        mapCoreError(storeResult.error);
    }

    // 2. Validate the memory path
    const pathResult = validateMemorySlugPath(path);
    if (!pathResult.ok) {
        mapCoreError(pathResult.error);
    }

    // 3. Resolve content from --content, --file, or stdin
    const contentResult = await resolveMemoryContentInput({
        content: options.content,
        filePath: options.file,
        stdin: deps.stdin ?? process.stdin,
        requireStdinFlag: false,
        requireContent: true,
    });
    if (!contentResult.ok) {
        mapCoreError(contentResult.error);
    }

    // 4. Parse tags and expiration
    const tags =
        options.tags
            ?.split(',')
            .map((t) => t.trim())
            .filter(Boolean) ?? [];
    const expiresAt = options.expiresAt ? new Date(options.expiresAt) : undefined;

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        mapCoreError({ code: 'INVALID_ARGUMENTS', message: 'Invalid expiration date format' });
    }

    // 5. Build memory file contents
    const now = deps.now ?? new Date();
    const memory: Memory = {
        metadata: {
            createdAt: now,
            updatedAt: now,
            tags,
            source: contentResult.value.source,
            expiresAt,
        },
        content: contentResult.value.content ?? '',
    };

    // 6. Serialize and write
    const serialized = serializeMemory(memory);
    if (!serialized.ok) {
        mapCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    // Use injected adapter or resolved one
    const adapter = deps.adapter ?? storeResult.value.adapter;

    // Write memory using ScopedStorageAdapter interface
    const writeResult = await adapter.memories.write(pathResult.value.slugPath, serialized.value);
    if (!writeResult.ok) {
        mapCoreError({ code: 'WRITE_FAILED', message: writeResult.error.message });
    }

    // Update indexes after memory write
    const indexResult = await adapter.indexes.updateAfterMemoryWrite(
        pathResult.value.slugPath,
        serialized.value,
        { createWhenMissing: true },
    );
    if (!indexResult.ok) {
        mapCoreError({ code: 'WRITE_FAILED', message: indexResult.error.message });
    }

    // 7. Output success message
    const out = deps.stdout ?? process.stdout;
    out.write(`Added memory ${pathResult.value.slugPath} (${contentResult.value.source}).\n`);
}

/**
 * The `memory add` subcommand.
 *
 * Creates a new memory at the specified path. Content can be provided via:
 * - `--content` flag for inline text
 * - `--file` flag to read from a file
 * - stdin when piped
 *
 * The `--store` option is inherited from the parent `memory` command.
 */
export const addCommand = new Command('add')
    .description('Create a new memory')
    .argument('<path>', 'Memory path (e.g., project/tech-stack)')
    .option('-c, --content <text>', 'Memory content as inline text')
    .option('-f, --file <filepath>', 'Read content from a file')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-e, --expires-at <date>', 'Expiration date (ISO 8601)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handleAdd(path, options, parentOpts?.store);
    });
