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
import { throwCoreError } from '../../errors.ts';
import { resolveDefaultStoreName } from '../../context.ts';

import { createMemory, type CortexContext } from '@yeseh/cortex-core';
import { resolveMemoryContentInput } from '../../input.ts';

/** Options parsed by Commander for the add command */
export interface AddCommandOptions extends Record<string, unknown> {
    content?: string;
    file?: string;
    tags?: string[];
    expiresAt?: string;
    citation?: string[];
}

const resolveContent = async (
    options: AddCommandOptions,
    stdin: NodeJS.ReadableStream
): Promise<{ content: string; source: string }> => {
    const contentResult = await resolveMemoryContentInput({
        content: options.content,
        filePath: options.file,
        stdin,
        requireStdinFlag: false,
        requireContent: true,
    });

    if (!contentResult.ok()) {
        throwCoreError(
            contentResult.error ?? {
                code: 'CONTENT_INPUT_FAILED',
                message: 'Failed to resolve memory content input.',
            }
        );
    }

    if (!contentResult.value) {
        throwCoreError({
            code: 'MISSING_CONTENT',
            message: 'Content is required via --content, --file, or stdin.',
        });
    }

    return {
        content: contentResult.value.content ?? '',
        source: contentResult.value.source,
    };
};

const parseTags = (raw?: string[]): string[] =>
    raw
        ? raw
              .flatMap((tag) => tag.split(','))
              .map((tag) => tag.trim())
              .filter(Boolean)
        : [];

const parseExpiresAt = (raw?: string): Date | undefined => {
    if (!raw) {
        return undefined;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        throwCoreError({ code: 'INVALID_ARGUMENTS', message: 'Invalid expiration date format' });
    }

    return parsed;
};

/**
 * Handler for the memory add command.
 *
 * Resolves the target store via {@link CortexContext} and writes a new memory
 * using the core {@link createMemory} operation. Exported for direct testing
 * without Commander parsing.
 *
 * Edge cases:
 * - Throws when no content is provided via flags or stdin.
 * - Throws when expiration or store name is invalid.
 *
 * @module cli/commands/memory/add
 * @param ctx - CortexContext with cortex client, stdout, stdin, and now.
 * @param path - Memory path (e.g., "project/tech-stack").
 * @param options - Command options from Commander.
 * @param storeName - Optional store name from parent command.
 * @returns Promise that resolves when the memory is created and output is written.
 *
 * @example
 * ```ts
 * const ctxResult = await createCortexContext();
 * if (ctxResult.ok()) {
 *   await handleAdd(ctxResult.value, 'project/tech-stack', { content: 'Notes' }, undefined);
 * }
 * ```
 */
export async function handleAdd(
    ctx: CortexContext,
    path: string,
    options: AddCommandOptions,
    storeName: string | undefined
): Promise<void> {
    // Get adapter from context
    const resolvedStoreName = resolveDefaultStoreName(storeName, ctx.cortex);
    const adapterResult = ctx.cortex.getStore(resolvedStoreName);
    if (!adapterResult.ok()) {
        throwCoreError(adapterResult.error);
    }
    const adapter = adapterResult.value;

    const contentInput = await resolveContent(options, ctx.stdin);
    const tags = parseTags(options.tags);
    const expiresAt = parseExpiresAt(options.expiresAt);
    const citations = options.citation ?? [];
    const now = ctx.now;

    const createResult = await createMemory(
        adapter,
        path,
        {
            content: contentInput.content,
            tags,
            source: contentInput.source,
            expiresAt,
            citations,
        },
        now
    );

    if (!createResult.ok()) {
        throwCoreError(createResult.error);
    }

    const memory = createResult.value;
    ctx.stdout.write(`Added memory ${memory.path.toString()} (${contentInput.source}).\n`);
}

/**
 * Builds the `memory add` subcommand.
 *
 * Creates a new memory at the specified path. Content can be provided via:
 * - `--content` flag for inline text
 * - `--file` flag to read from a file
 * - stdin when piped
 *
 * The `--store` option is inherited from the parent `memory` command.
 *
 * @param ctx - CortexContext that supplies the Cortex client and I/O streams.
 * @returns A configured Commander subcommand for `memory add`.
 *
 * @example
 * ```ts
 * const ctxResult = await createCortexContext();
 * if (ctxResult.ok()) {
 *   program.addCommand(createAddCommand(ctxResult.value));
 * }
 * ```
 */
export const createAddCommand = (ctx: CortexContext) => {
    return new Command('add')
        .description('Create a new memory')
        .argument('<path>', 'Memory path (e.g., project/tech-stack)')
        .option('-c, --content <text>', 'Memory content as inline text')
        .option('-f, --file <filepath>', 'Read content from a file')
        .option('-t, --tags <value...>', 'Tags (can be repeated or comma-separated)')
        .option('-e, --expires-at <date>', 'Expiration date (ISO 8601)')
        .option('--citation <value...>', 'Citation references (file paths or URLs)')
        .action(async (path, options, command) => {
            const parentOpts = command.parent?.opts() as { store?: string } | undefined;
            await handleAdd(ctx, path, options, parentOpts?.store);
        });
};
