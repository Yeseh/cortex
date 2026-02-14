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
import { resolveStoreAdapter } from '../../context.ts';

import { createMemory } from '@yeseh/cortex-core/memory';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { resolveMemoryContentInput } from '../../input.ts';

/** Options parsed by Commander for the add command */
export interface AddCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string;
    citation?: string[];
}

/** Dependencies injected into the handler for testability */
export interface AddHandlerDeps {
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
    now?: Date;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

const resolveAdapter = async (
    storeName: string | undefined,
    deps: AddHandlerDeps,
): Promise<ScopedStorageAdapter> => {
    if (deps.adapter) {
        return deps.adapter;
    }

    const adapterResult = await resolveStoreAdapter(storeName);
    if (!adapterResult.ok) {
        throwCoreError(adapterResult.error ?? {
            code: 'STORE_RESOLUTION_FAILED',
            message: 'Failed to resolve store adapter.',
        });
    }

    if (!adapterResult.value) {
        throwCoreError({
            code: 'STORE_RESOLUTION_FAILED',
            message: 'Failed to resolve store adapter.',
        });
    }

    return adapterResult.value.adapter;
};

const resolveContent = async (
    options: AddCommandOptions,
    deps: AddHandlerDeps,
): Promise<{ content: string; source: string }> => {
    const contentResult = await resolveMemoryContentInput({
        content: options.content,
        filePath: options.file,
        stdin: deps.stdin ?? process.stdin,
        requireStdinFlag: false,
        requireContent: true,
    });

    if (!contentResult.ok) {
        throwCoreError(contentResult.error ?? {
            code: 'CONTENT_INPUT_FAILED',
            message: 'Failed to resolve memory content input.',
        });
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

const parseTags = (raw?: string): string[] =>
    raw
        ? raw
            .split(',')
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
    const adapter = await resolveAdapter(storeName, deps);
    const contentInput = await resolveContent(options, deps);
    const tags = parseTags(options.tags);
    const expiresAt = parseExpiresAt(options.expiresAt);
    const citations = options.citation ?? [];
    const now = deps.now ?? new Date();

    const createResult = await createMemory(adapter, path, {
        content: contentInput.content,
        tags,
        source: contentInput.source,
        expiresAt,
        citations,
    }, now);

    if (!createResult.ok()) {
        throwCoreError(createResult.error);
    }

    const out = deps.stdout ?? process.stdout;
    out.write(`Added memory ${path} (${contentInput.source}).\n`);
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
    .option('--citation <value...>', 'Citation references (file paths or URLs)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handleAdd(path, options, parentOpts?.store);
    });
