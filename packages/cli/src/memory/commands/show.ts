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
import { throwCoreError } from '../../errors.ts';

import {
    defaultTokenizer,
    MemoryPath,
    type CortexContext,
    type StoreClient,
} from '@yeseh/cortex-core';
import { serializeOutput, type OutputMemory, type OutputFormat } from '../../output.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';

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
    /** Pre-resolved store client for testing */
    store?: StoreClient;
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
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
    options: ShowCommandOptions,
    deps: ShowHandlerDeps = {}
): Promise<void> {
    const pathResult = MemoryPath.fromString(path);
    if (!pathResult.ok()) {
        throwCoreError(pathResult.error);
    }

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCoreError(storeResult.error);
    }

    const store = deps.store ?? storeResult.value;

    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCoreError(rootResult.error);
    }

    const categoryResult = rootResult.value.getCategory(pathResult.value.category.toString());
    if (!categoryResult.ok()) {
        throwCoreError(categoryResult.error);
    }

    const memoryClient = categoryResult.value.getMemory(pathResult.value.slug.toString());
    const readResult = await memoryClient.get({
        includeExpired: options.includeExpired ?? false,
        now: ctx.now(),
    });
    if (!readResult.ok()) {
        throwCoreError(readResult.error);
    }

    const memory = readResult.value;
    const tokenEstimateResult = defaultTokenizer.estimateTokens(memory.content);
    const tokenEstimate = tokenEstimateResult.ok() ? tokenEstimateResult.value : undefined;

    const outputMemory: OutputMemory = {
        path: memory.path.toString(),
        metadata: {
            createdAt: memory.metadata.createdAt,
            updatedAt: memory.metadata.updatedAt,
            tags: memory.metadata.tags,
            source: memory.metadata.source,
            tokenEstimate,
            expiresAt: memory.metadata.expiresAt,
        },
        content: memory.content,
    };

    const format = (options.format as OutputFormat) ?? 'yaml';
    const serialized = serializeOutput({ kind: 'memory', value: outputMemory }, format);
    if (!serialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
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
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCoreError(context.error);
        }

        await handleShow(context.value, parentOpts?.store, path, options);
    });
