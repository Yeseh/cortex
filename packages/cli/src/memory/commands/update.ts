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
import { MemoryPath, type CortexContext, type UpdateMemoryInput } from '@yeseh/cortex-core';
import { resolveInput as resolveCliContent } from '../../input.ts';
import { parseExpiresAt, parseTags } from '../parsing.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';

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

const parseUpdateExpiresAt = (raw?: string | false): Date | null | undefined => {
    if (raw === false) {
        return null;
    }

    if (!raw) {
        return undefined;
    }

    return parseExpiresAt(raw);
};

const resolveUpdateContent = async (
    ctx: CortexContext,
    options: UpdateCommandOptions,
): Promise<string | null> => {
    if (options.content === undefined && options.file === undefined) {
        return null;
    }

    const content = await resolveCliContent({
        content: options.content,
        filePath: options.file,
        stream: ctx.stdin,
    });

    if (!content.ok()) {
        throwCoreError(content.error);
    }

    if (!content.value.content) {
        throwCoreError({
            code: 'MISSING_CONTENT',
            message: 'Memory content is required via --content or --file.',
        });
    }

    return content.value.content;
};

const buildUpdates = (
    content: string | null,
    tags: string[] | undefined,
    expiresAt: Date | null | undefined,
    citations: string[] | undefined,
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
 * Exported for direct testing without Commander parsing.
 *
 * @param ctx - CLI context containing Cortex client and streams
 * @param storeName - Optional store name from parent command
 * @param path - Memory path to update (e.g., "project/tech-stack")
 * @param options - Command options from Commander
 */
export async function handleUpdate(
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
    options: UpdateCommandOptions,
): Promise<void> {
    const pathResult = MemoryPath.fromString(path);
    if (!pathResult.ok()) {
        throwCoreError(pathResult.error);
    }

    const content = await resolveUpdateContent(ctx, options);
    const tags = options.tags === undefined ? undefined : parseTags(options.tags);
    const expiresAt = parseUpdateExpiresAt(options.expiresAt);
    const updates = buildUpdates(content, tags, expiresAt, options.citation);

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCoreError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCoreError(rootResult.error);
    }

    const categoryResult = pathResult.value.category.isRoot
        ? rootResult
        : rootResult.value.getCategory(pathResult.value.category.toString());
    if (!categoryResult.ok()) {
        throwCoreError(categoryResult.error);
    }

    const memoryClient = categoryResult.value.getMemory(pathResult.value.slug.toString());
    const updateResult = await memoryClient.update(updates);
    if (!updateResult.ok()) {
        throwCoreError(updateResult.error);
    }

    const memory = updateResult.value;
    const stdout = ctx.stdout ?? process.stdout;
    stdout.write(`Updated memory ${memory.path.toString()}.\n`);
}

/**
 * The `memory update` subcommand.
 *
 * Updates an existing memory at the specified path. Can update:
 * - Content via `--content` flag for inline text or `--file` to read from a file
 * - Tags via `--tags` flag (replaces existing tags)
 * - Expiration via `--expires-at` or `--no-expires-at`
 *
 * The `--store` option is inherited from the parent `memory` command.
 */
export const updateCommand = new Command('update')
    .description('Update an existing memory')
    .argument('<path>', 'Memory path to update')
    .option('-c, --content <text>', 'New memory content as inline text')
    .option('-f, --file <filepath>', 'Read new content from a file')
    .option('-t, --tags <value...>', 'Tags (can be repeated or comma-separated, replaces existing)')
    .option('-e, --expires-at <date>', 'New expiration date (ISO 8601)')
    .option('--no-expires-at', 'Remove expiration date')
    .option('--citation <value...>', 'Citation references (replaces existing)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCoreError(context.error);
        }

        await handleUpdate(context.value, parentOpts?.store, path, options);
    });
