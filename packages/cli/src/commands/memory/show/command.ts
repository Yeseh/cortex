/**
 * Memory show command for displaying a memory's content and metadata.
 *
 * This command reads a memory from the store and displays it in the
 * specified format. Expired memories are excluded by default unless
 * the `--include-expired` flag is provided.
 *
 * @example
 * ```bash
 * # Show a memory in YAML format (default)
 * cortex memory show project/notes
 *
 * # Show a memory in JSON format
 * cortex memory show project/notes --format json
 *
 * # Include expired memories
 * cortex memory show project/notes --include-expired
 *
 * # Use a specific store
 * cortex memory --store my-store show project/notes
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreAdapter } from '../../../context.ts';

import { validateMemorySlugPath } from '@yeseh/cortex-core/memory';
import { parseMemory } from '@yeseh/cortex-storage-fs';
import { defaultTokenizer } from '@yeseh/cortex-core';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { serializeOutput, type OutputMemory, type OutputFormat } from '../../../output.ts';

/**
 * Options for the show command.
 */
export interface ShowCommandOptions {
    /** Include expired memories in the output */
    includeExpired?: boolean;
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Dependencies for the show command handler.
 * Allows injection for testing.
 */
export interface ShowHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

/**
 * Handles the show command execution.
 *
 * This function:
 * 1. Resolves the store context
 * 2. Validates the memory path
 * 3. Reads the memory file from storage
 * 4. Parses the memory content and frontmatter
 * 5. Checks expiration status (unless --include-expired)
 * 6. Serializes and outputs the result
 *
 * @param path - The memory path to show (e.g., "project/notes")
 * @param options - Command options (includeExpired, format)
 * @param storeName - Optional store name from parent command
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the path is invalid
 * @throws {CommanderError} When the memory is not found or read fails
 */
export async function handleShow(
    path: string,
    options: ShowCommandOptions,
    storeName: string | undefined,
    deps: ShowHandlerDeps = {}
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

    // 3. Read the memory file
    const adapter = deps.adapter ?? storeResult.value.adapter;
    const readResult = await adapter.memories.read(pathResult.value.slugPath);
    if (!readResult.ok) {
        mapCoreError({ code: 'STORAGE_ERROR', message: readResult.error.message });
    }
    if (!readResult.value) {
        mapCoreError({
            code: 'MEMORY_NOT_FOUND',
            message: `Memory not found at ${pathResult.value.slugPath}`,
        });
    }

    // 4. Parse the memory file
    const parsed = parseMemory(readResult.value);
    if (!parsed.ok) {
        mapCoreError({ code: 'PARSE_FAILED', message: parsed.error.message });
    }

    // 5. Check expiration (unless --include-expired)
    if (!options.includeExpired && parsed.value.metadata.expiresAt) {
        const now = new Date();
        if (parsed.value.metadata.expiresAt.getTime() <= now.getTime()) {
            mapCoreError({
                code: 'MEMORY_NOT_FOUND',
                message: `Memory at ${pathResult.value.slugPath} has expired`,
            });
        }
    }

    // 6. Build output
    const tokenEstimateResult = defaultTokenizer.estimateTokens(parsed.value.content);
    const tokenEstimate = tokenEstimateResult.ok ? tokenEstimateResult.value : undefined;

    const outputMemory: OutputMemory = {
        path: pathResult.value.slugPath,
        metadata: {
            createdAt: parsed.value.metadata.createdAt,
            updatedAt: parsed.value.metadata.updatedAt,
            tags: parsed.value.metadata.tags,
            source: parsed.value.metadata.source,
            tokenEstimate,
            expiresAt: parsed.value.metadata.expiresAt,
        },
        content: parsed.value.content,
    };

    // 7. Serialize and output
    const VALID_FORMATS: OutputFormat[] = ['yaml', 'json', 'toon'];
    const requestedFormat = options.format as OutputFormat;
    const format: OutputFormat = VALID_FORMATS.includes(requestedFormat) ? requestedFormat : 'yaml';
    const serialized = serializeOutput({ kind: 'memory', value: outputMemory }, format);
    if (!serialized.ok) {
        mapCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    const out = deps.stdout ?? process.stdout;
    out.write(serialized.value + '\n');
}

/**
 * The `show` subcommand for displaying a memory.
 *
 * Reads a memory from the store and displays its content and metadata
 * in the specified format. By default, expired memories are excluded.
 *
 * @example
 * ```bash
 * cortex memory show project/notes
 * cortex memory show project/notes --format json
 * cortex memory show project/notes --include-expired
 * ```
 */
export const showCommand = new Command('show')
    .description('Display a memory')
    .argument('<path>', 'Memory path to show')
    .option('-x, --include-expired', 'Include expired memories')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handleShow(path, options, parentOpts?.store);
    });
