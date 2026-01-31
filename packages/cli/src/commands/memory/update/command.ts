/**
 * Memory update command implementation using Commander.js.
 *
 * Updates an existing memory at the specified path with new content, tags,
 * or expiration date.
 *
 * @example
 * ```bash
 * # Update memory content inline
 * cortex memory update project/tech-stack --content "Updated stack: TypeScript"
 *
 * # Update memory content from a file
 * cortex memory update project/notes --file ./updated-notes.md
 *
 * # Update tags
 * cortex memory update project/tech-stack --tags "typescript,nodejs,updated"
 *
 * # Update expiration date
 * cortex memory update project/temp --expires-at "2026-12-31T00:00:00Z"
 *
 * # Clear expiration date
 * cortex memory update project/temp --clear-expiry
 *
 * # Update from a specific store
 * cortex memory --store work update project/notes --content "New content"
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreAdapter } from '../../../context.ts';
import { validateMemorySlugPath, type Memory } from '@yeseh/cortex-core/memory';
import { parseMemory, serializeMemory } from '@yeseh/cortex-storage-fs';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { resolveMemoryContentInput } from '../../../input.ts';

/** Options parsed by Commander for the update command */
export interface UpdateCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string;
    clearExpiry?: boolean;
}

/** Dependencies injected into the handler for testability */
export interface UpdateHandlerDeps {
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
    now?: Date;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

/**
 * Handler for the memory update command.
 * Exported for direct testing without Commander parsing.
 *
 * @param path - Memory path to update (e.g., "project/tech-stack")
 * @param options - Command options from Commander
 * @param storeName - Optional store name from parent command
 * @param deps - Injectable dependencies for testing
 */
export async function handleUpdate(
    path: string,
    options: UpdateCommandOptions,
    storeName: string | undefined,
    deps: UpdateHandlerDeps = {},
): Promise<void> {
    // 1. Validate mutually exclusive options
    if (options.expiresAt && options.clearExpiry) {
        mapCoreError({
            code: 'INVALID_ARGUMENTS',
            message: 'Use either --expires-at or --clear-expiry, not both.',
        });
    }

    // 2. Resolve store context
    const storeResult = await resolveStoreAdapter(storeName);
    if (!storeResult.ok) {
        mapCoreError(storeResult.error);
    }

    // 3. Validate the memory path
    const pathResult = validateMemorySlugPath(path);
    if (!pathResult.ok) {
        mapCoreError(pathResult.error);
    }

    // 4. Resolve content from --content, --file, or stdin (optional)
    const contentResult = await resolveMemoryContentInput({
        content: options.content,
        filePath: options.file,
        stdin: deps.stdin ?? process.stdin,
        requireStdinFlag: true,
        requireContent: false,
    });
    if (!contentResult.ok) {
        mapCoreError(contentResult.error);
    }

    // 5. Parse tags if provided
    const tags =
        options.tags !== undefined
            ? options.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined;

    // Validate tags are non-empty if provided
    if (options.tags !== undefined && tags) {
        for (const tag of tags) {
            if (!tag) {
                mapCoreError({
                    code: 'INVALID_ARGUMENTS',
                    message: 'Tags must be non-empty strings.',
                });
            }
        }
    }

    // 6. Parse expiration date if provided
    const expiresAt = options.expiresAt ? new Date(options.expiresAt) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        mapCoreError({
            code: 'INVALID_ARGUMENTS',
            message: 'Expiry must be a valid ISO timestamp.',
        });
    }

    // 7. Verify at least one update is provided
    const hasContentUpdate = contentResult.value.content !== null;
    const hasTagsUpdate = tags !== undefined;
    const hasExpiryUpdate = expiresAt !== undefined || options.clearExpiry;

    if (!hasContentUpdate && !hasTagsUpdate && !hasExpiryUpdate) {
        mapCoreError({
            code: 'INVALID_ARGUMENTS',
            message: 'No updates provided. Use --content, --file, --tags, or expiry flags.',
        });
    }

    // 8. Read existing memory
    const adapter = deps.adapter ?? storeResult.value.adapter;
    const readResult = await adapter.memories.read(pathResult.value.slugPath);
    if (!readResult.ok) {
        mapCoreError({ code: 'READ_FAILED', message: readResult.error.message });
    }
    if (!readResult.value) {
        mapCoreError({
            code: 'MEMORY_NOT_FOUND',
            message: `Memory not found at ${pathResult.value.slugPath}.`,
        });
    }

    // 9. Parse existing memory
    const parsedMemory = parseMemory(readResult.value);
    if (!parsedMemory.ok) {
        mapCoreError({ code: 'PARSE_FAILED', message: parsedMemory.error.message });
    }

    // 10. Build updated memory
    const now = deps.now ?? new Date();
    const updatedMemory: Memory = {
        metadata: {
            ...parsedMemory.value.metadata,
            updatedAt: now,
            tags: tags ?? parsedMemory.value.metadata.tags,
            expiresAt: options.clearExpiry
                ? undefined
                : (expiresAt ?? parsedMemory.value.metadata.expiresAt),
        },
        content: contentResult.value.content ?? parsedMemory.value.content,
    };

    // 11. Serialize and write
    const serialized = serializeMemory(updatedMemory);
    if (!serialized.ok) {
        mapCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    const writeResult = await adapter.memories.write(pathResult.value.slugPath, serialized.value);
    if (!writeResult.ok) {
        mapCoreError({ code: 'WRITE_FAILED', message: writeResult.error.message });
    }

    // 12. Output success message
    const out = deps.stdout ?? process.stdout;
    out.write(`Updated memory at ${pathResult.value.slugPath}.\n`);
}

/**
 * The `memory update` subcommand.
 *
 * Updates an existing memory at the specified path. Can update:
 * - Content via `--content` flag for inline text or `--file` to read from a file
 * - Tags via `--tags` flag (replaces existing tags)
 * - Expiration via `--expires-at` or `--clear-expiry`
 *
 * The `--store` option is inherited from the parent `memory` command.
 */
export const updateCommand = new Command('update')
    .description('Update an existing memory')
    .argument('<path>', 'Memory path to update')
    .option('-c, --content <text>', 'New memory content as inline text')
    .option('-f, --file <filepath>', 'Read new content from a file')
    .option('-t, --tags <tags>', 'Comma-separated tags (replaces existing)')
    .option('-e, --expires-at <date>', 'New expiration date (ISO 8601)')
    .option('-E, --clear-expiry', 'Remove expiration date')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handleUpdate(path, options, parentOpts?.store);
    });
