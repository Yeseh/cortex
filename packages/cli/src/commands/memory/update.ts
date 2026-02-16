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
 * cortex memory update project/temp --no-expires-at
 *
 * # Update from a specific store
 * cortex memory --store work update project/notes --content "New content"
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { updateMemory, type UpdateMemoryInput } from '@yeseh/cortex-core/memory';
import { type CortexContext } from '@yeseh/cortex-core';
import { resolveMemoryContentInput } from '../../input.ts';

/** Options parsed by Commander for the update command */
export interface UpdateCommandOptions {
    content?: string;
    file?: string;
    tags?: string[];
    /**
     * Expiration date from Commander.js option parsing.
     * - `string` — ISO 8601 date provided via `--expires-at <date>`
     * - `false` — expiration cleared via `--no-expires-at` negation flag
     * - `undefined` (omitted) — keep the existing value unchanged
     */
    expiresAt?: string | false;
    citation?: string[];
}

const resolveContent = async (
    options: UpdateCommandOptions,
    stdin: NodeJS.ReadableStream
): Promise<{ content: string | null }> => {
    // Don't read from stdin for update command - only use explicit --content or --file flags
    // If neither is provided, return null to preserve existing content
    if (options.content === undefined && options.file === undefined) {
        return { content: null };
    }

    const contentResult = await resolveMemoryContentInput({
        content: options.content,
        filePath: options.file,
        stdin,
        requireStdinFlag: true, // Changed from false - require explicit stdin flag
        requireContent: false,
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
        return { content: null };
    }

    const finalContent = contentResult.value.content ?? null;
    return { content: finalContent };
};

const parseTags = (raw?: string[]): string[] | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    const tags = raw
        .flatMap((tag) => tag.split(','))
        .map((tag) => tag.trim())
        .filter(Boolean);

    if (tags.length === 0) {
        throwCoreError({
            code: 'INVALID_ARGUMENTS',
            message: 'Tags must be non-empty strings.',
        });
    }

    return tags;
};

const parseExpiresAt = (raw?: string | false): Date | null | undefined => {
    if (raw === false) {
        return null;
    }

    if (!raw) {
        return undefined;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        throwCoreError({
            code: 'INVALID_ARGUMENTS',
            message: 'Expiry must be a valid ISO timestamp.',
        });
    }

    return parsed;
};

const buildUpdates = (
    content: string | null,
    tags: string[] | undefined,
    expiresAt: Date | null | undefined,
    citations: string[] | undefined
): UpdateMemoryInput => {
    const updates: UpdateMemoryInput = {};
    if (content !== null) {
        updates.content = content;
    }
    if (tags !== undefined) {
        updates.tags = tags;
    }
    if (expiresAt !== undefined) {
        updates.expiresAt = expiresAt;
    }
    if (citations !== undefined) {
        updates.citations = citations;
    }

    if (Object.keys(updates).length === 0) {
        throwCoreError({
            code: 'INVALID_ARGUMENTS',
            message:
                'No updates provided. Use --content, --file, --tags, --citation, or expiry flags.',
        });
    }

    return updates;
};

/**
 * Handler for the memory update command.
 *
 * Resolves the target store from {@link CortexContext} and applies updates
 * via the core {@link updateMemory} operation. Exported for direct testing
 * without Commander parsing.
 *
 * @param ctx - CortexContext with cortex client, stdout, stdin, and now.
 * @param path - Memory path to update (e.g., "project/tech-stack").
 * @param options - Command options from Commander.
 * @param storeName - Optional store name from parent command.
 * @returns Promise that resolves when the update and output complete.
 *
 * @example
 * ```ts
 * const ctxResult = await createCortexContext();
 * if (ctxResult.ok()) {
 *   await handleUpdate(ctxResult.value, 'project/tech-stack', { content: 'New content' }, undefined);
 * }
 * ```
 */
export async function handleUpdate(
    ctx: CortexContext,
    path: string,
    options: UpdateCommandOptions,
    storeName: string | undefined
): Promise<void> {
    // Get adapter from context
    const resolvedStoreName = storeName ?? 'default';
    const adapterResult = ctx.cortex.getStore(resolvedStoreName);
    if (!adapterResult.ok()) {
        throwCoreError(adapterResult.error);
    }
    const adapter = adapterResult.value;

    const contentInput = await resolveContent(options, ctx.stdin);
    const tags = parseTags(options.tags);
    const expiresAt = parseExpiresAt(options.expiresAt);
    const updates = buildUpdates(contentInput.content, tags, expiresAt, options.citation);

    // 1. Update memory
    const now = ctx.now;
    const updateResult = await updateMemory(adapter, path, updates, now);
    if (!updateResult.ok()) {
        throwCoreError(updateResult.error);
    }

    // 2. Output success message with normalized path
    const memory = updateResult.value;
    ctx.stdout.write(`Updated memory at ${memory.path.toString()}.\n`);
}

/**
 * Builds the `memory update` subcommand.
 *
 * Updates an existing memory at the specified path. Can update:
 * - Content via `--content` flag for inline text or `--file` to read from a file
 * - Tags via `--tags` flag (replaces existing tags)
 * - Expiration via `--expires-at` or `--no-expires-at`
 *
 * The `--store` option is inherited from the parent `memory` command.
 *
 * @param ctx - CortexContext providing the Cortex client and I/O streams.
 * @returns A configured Commander subcommand for `memory update`.
 */
export const createUpdateCommand = (ctx: CortexContext) => {
    return new Command('update')
        .description('Update an existing memory')
        .argument('<path>', 'Memory path to update')
        .option('-c, --content <text>', 'New memory content as inline text')
        .option('-f, --file <filepath>', 'Read new content from a file')
        .option(
            '-t, --tags <value...>',
            'Tags (can be repeated or comma-separated, replaces existing)'
        )
        .option('-e, --expires-at <date>', 'New expiration date (ISO 8601)')
        .option('--no-expires-at', 'Remove expiration date')
        .option('--citation <value...>', 'Citation references (replaces existing)')
        .action(async (path, options, command) => {
            const parentOpts = command.parent?.opts() as { store?: string } | undefined;
            await handleUpdate(ctx, path, options, parentOpts?.store);
        });
};
