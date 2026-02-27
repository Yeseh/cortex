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
import { throwCliError } from '../../errors.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { resolveInput as resolveCliContent } from '../../input.ts';
import { parseExpiresAt, parseTags } from '../parsing.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';
import { serializeOutput, type OutputFormat } from '../../output.ts';

/** Options parsed by Commander for the add command */
export interface AddCommandOptions {
    content?: string;
    file?: string;
    tags?: string[];
    expiresAt?: string;
    citations?: string[];
    format?: string;
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
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
    options: AddCommandOptions
): Promise<void> {
    const content = await resolveCliContent({
        content: options.content,
        filePath: options.file,
        stream: ctx.stdin,
        // `memory add` accepts stdin by default (when piped).
        stdinRequested: options.content === undefined && options.file === undefined,
    });

    if (!content.ok()) {
        throwCliError(content.error);
    }

    if (!content.value.content) {
        throwCliError({
            code: 'MISSING_CONTENT',
            message: 'Memory content is required via --content, --file, or stdin.',
        });
    }

    const { content: memoryContent, source } = content.value;
    const tags = parseTags(options.tags);
    const expiresAt = parseExpiresAt(options.expiresAt);
    const citations = options.citations ?? [];

    const storeResult = ctx.cortex.getStore(storeName ?? 'global');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const timestamp = ctx.now() ?? new Date();
    const memoryClient = store.getMemory(path);
    const memoryResult = await memoryClient.create({
        content: memoryContent!,
        metadata: {
            tags,
            source,
            createdAt: timestamp,
            updatedAt: timestamp,
            expiresAt,
            citations,
        },
    });

    if (!memoryResult.ok()) {
        throwCliError(memoryResult.error);
    }

    const memory = memoryResult.value;
    const out = ctx.stdout ?? process.stdout;

    const rawFormat = options.format;
    if (!rawFormat) {
        out.write(`Added memory ${memory.path} (${source}).\n`);
    } else {
        const format = rawFormat as OutputFormat;
        const serialized = serializeOutput(
            {
                kind: 'memory',
                value: {
                    path: memory.path.toString(),
                    metadata: memory.metadata,
                    content: memory.content,
                },
            },
            format
        );
        if (!serialized.ok()) {
            throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
        }
        out.write(serialized.value + '\n');
    }
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
    .option('-t, --tags <value...>', 'Tags (can be repeated or comma-separated)')
    .option('-e, --expires-at <date>', 'Expiration date (ISO 8601)')
    .option('--citation <value...>', 'Citation references (file paths or URLs)')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }

        await handleAdd(context.value, parentOpts?.store, path, options);
    });
