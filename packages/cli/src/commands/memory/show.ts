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

import { getMemory } from '@yeseh/cortex-core/memory';
import { defaultTokenizer, type CortexContext } from '@yeseh/cortex-core';
import { serializeOutput, type OutputMemory, type OutputFormat } from '../../output.ts';

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
 * Handles the show command execution.
 *
 * This function:
 * 1. Resolves the store context from {@link CortexContext}
 * 2. Reads the memory file from storage
 * 3. Checks expiration status (unless --include-expired)
 * 4. Serializes and outputs the result
 *
 * @param ctx - CortexContext with cortex client, stdout, stdin, and now.
 * @param path - The memory path to show (e.g., "project/notes").
 * @param options - Command options (includeExpired, format).
 * @param storeName - Optional store name from parent command.
 * @returns Promise that resolves after output is written.
 * @throws {InvalidArgumentError} When the path is invalid.
 * @throws {CommanderError} When the memory is not found or read fails.
 *
 * @example
 * ```ts
 * const ctxResult = await createCortexContext();
 * if (ctxResult.ok()) {
 *   await handleShow(ctxResult.value, 'project/notes', { format: 'json' }, undefined);
 * }
 * ```
 */
export async function handleShow(
    ctx: CortexContext,
    path: string,
    options: ShowCommandOptions,
    storeName: string | undefined
): Promise<void> {
    // 1. Resolve store context
    const resolvedStoreName = storeName ?? 'default';
    const adapterResult = ctx.cortex.getStore(resolvedStoreName);
    if (!adapterResult.ok()) {
        throwCoreError(adapterResult.error);
    }
    const adapter = adapterResult.value;

    // 2. Read the memory
    const readResult = await getMemory(adapter, path, {
        includeExpired: options.includeExpired ?? false,
        now: ctx.now,
    });
    if (!readResult.ok()) {
        throwCoreError(readResult.error);
    }

    // 3. Build output
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

    // 4. Serialize and output
    const VALID_FORMATS: OutputFormat[] = ['yaml', 'json', 'toon'];
    const requestedFormat = options.format as OutputFormat;
    const format: OutputFormat = VALID_FORMATS.includes(requestedFormat) ? requestedFormat : 'yaml';
    const serialized = serializeOutput({ kind: 'memory', value: outputMemory }, format);
    if (!serialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    ctx.stdout.write(serialized.value + '\n');
}

/**
 * Builds the `show` subcommand for displaying a memory.
 *
 * Reads a memory from the store and displays its content and metadata
 * in the specified format. By default, expired memories are excluded.
 *
 * @param ctx - CortexContext providing the Cortex client and I/O streams.
 * @returns A configured Commander subcommand for `memory show`.
 *
 * @example
 * ```bash
 * cortex memory show project/notes
 * cortex memory show project/notes --format json
 * cortex memory show project/notes --include-expired
 * ```
 */
export const createShowCommand = (ctx: CortexContext) => {
    return new Command('show')
        .description('Display a memory')
        .argument('<path>', 'Memory path to show')
        .option('-x, --include-expired', 'Include expired memories')
        .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
        .action(async (path, options, command) => {
            const parentOpts = command.parent?.opts() as { store?: string } | undefined;
            await handleShow(ctx, path, options, parentOpts?.store);
        });
};
