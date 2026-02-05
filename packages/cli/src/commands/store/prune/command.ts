/**
 * Store prune command for removing expired memories.
 *
 * This command removes expired memories from the current store or a specified
 * store. It supports a dry-run mode to preview what would be deleted.
 *
 * @example
 * ```bash
 * # Prune expired memories from the current store
 * cortex store prune
 *
 * # Preview what would be pruned (dry-run)
 * cortex store prune --dry-run
 *
 * # Prune from a specific store
 * cortex --store work store prune
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreAdapter } from '../../../context.ts';
import type { CategoryIndex } from '@yeseh/cortex-core/index';
import { parseIndex } from '@yeseh/cortex-core';
import { parseMemory } from '@yeseh/cortex-storage-fs';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';

/**
 * Options for the prune command.
 */
export interface PruneCommandOptions {
    /** Show what would be pruned without actually deleting */
    dryRun?: boolean;
}

/**
 * Dependencies for the prune command handler.
 * Allows injection for testing.
 */
export interface PruneHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Current time for expiry checks (defaults to new Date()) */
    now?: Date;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

interface PrunedMemoryEntry {
    path: string;
    expiresAt: Date;
}

interface PruneError {
    code: string;
    message: string;
}

type PruneResult<T> = { ok: true; value: T } | { ok: false; error: PruneError };

const isExpired = (expiresAt: Date | undefined, now: Date): boolean => {
    if (!expiresAt) {
        return false;
    }
    return expiresAt.getTime() <= now.getTime();
};

const loadCategoryIndex = async (
    adapter: ScopedStorageAdapter,
    categoryPath: string
): Promise<PruneResult<CategoryIndex | null>> => {
    const indexContents = await adapter.indexes.read(categoryPath);
    if (!indexContents.ok) {
        return {
            ok: false,
            error: {
                code: 'READ_FAILED',
                message: `Failed to read index for category ${categoryPath}.`,
            },
        };
    }
    if (!indexContents.value) {
        return { ok: true, value: null };
    }
    const parsed = parseIndex(indexContents.value);
    if (!parsed.ok) {
        return {
            ok: false,
            error: {
                code: 'PARSE_FAILED',
                message: `Failed to parse index for category ${categoryPath}.`,
            },
        };
    }
    return { ok: true, value: parsed.value };
};

const checkMemoryExpiry = async (
    adapter: ScopedStorageAdapter,
    slugPath: string,
    now: Date
): Promise<PruneResult<{ expired: boolean; expiresAt?: Date }>> => {
    const contents = await adapter.memories.read(slugPath);
    if (!contents.ok) {
        return {
            ok: false,
            error: {
                code: 'READ_FAILED',
                message: `Failed to read memory file ${slugPath}.`,
            },
        };
    }
    if (!contents.value) {
        return { ok: true, value: { expired: false } };
    }
    const parsed = parseMemory(contents.value);
    if (!parsed.ok) {
        return {
            ok: false,
            error: {
                code: 'PARSE_FAILED',
                message: `Failed to parse memory file ${slugPath}.`,
            },
        };
    }
    const expiresAt = parsed.value.metadata.expiresAt;
    return { ok: true, value: { expired: isExpired(expiresAt, now), expiresAt } };
};

const collectExpiredFromCategory = async (
    adapter: ScopedStorageAdapter,
    categoryPath: string,
    now: Date,
    visited: Set<string>
): Promise<PruneResult<PrunedMemoryEntry[]>> => {
    if (visited.has(categoryPath)) {
        return { ok: true, value: [] };
    }
    visited.add(categoryPath);

    const indexResult = await loadCategoryIndex(adapter, categoryPath);
    if (!indexResult.ok) {
        return indexResult;
    }
    if (!indexResult.value) {
        return { ok: true, value: [] };
    }

    const entries: PrunedMemoryEntry[] = [];

    for (const memory of indexResult.value.memories) {
        const expiryResult = await checkMemoryExpiry(adapter, memory.path, now);
        if (!expiryResult.ok) {
            return expiryResult;
        }
        if (expiryResult.value.expired && expiryResult.value.expiresAt) {
            entries.push({
                path: memory.path,
                expiresAt: expiryResult.value.expiresAt,
            });
        }
    }

    for (const subcategory of indexResult.value.subcategories) {
        const subResult = await collectExpiredFromCategory(adapter, subcategory.path, now, visited);
        if (!subResult.ok) {
            return subResult;
        }
        entries.push(...subResult.value);
    }

    return { ok: true, value: entries };
};

const collectAllExpired = async (
    adapter: ScopedStorageAdapter,
    now: Date
): Promise<PruneResult<PrunedMemoryEntry[]>> => {
    // Dynamically discover root categories from the store's root index
    const rootIndexResult = await loadCategoryIndex(adapter, '');
    if (!rootIndexResult.ok) {
        return rootIndexResult;
    }

    // If no root index, there are no categories to scan
    if (!rootIndexResult.value) {
        return { ok: true, value: [] };
    }

    const rootCategories = rootIndexResult.value.subcategories.map((sub) => sub.path);
    const entries: PrunedMemoryEntry[] = [];
    const visited = new Set<string>();

    for (const category of rootCategories) {
        const result = await collectExpiredFromCategory(adapter, category, now, visited);
        if (!result.ok) {
            return result;
        }
        entries.push(...result.value);
    }

    return { ok: true, value: entries };
};

const deleteExpiredMemories = async (
    adapter: ScopedStorageAdapter,
    entries: PrunedMemoryEntry[]
): Promise<PruneResult<void>> => {
    for (const entry of entries) {
        const removeResult = await adapter.memories.remove(entry.path);
        if (!removeResult.ok) {
            return {
                ok: false,
                error: {
                    code: 'DELETE_FAILED',
                    message: `Failed to delete memory ${entry.path}.`,
                },
            };
        }
    }
    return { ok: true, value: undefined };
};

/**
 * Handles the prune command execution.
 *
 * This function:
 * 1. Resolves the store context from options or environment
 * 2. Collects all expired memories
 * 3. Optionally deletes them (unless dry-run)
 * 4. Outputs the result
 *
 * @param options - Command options (dryRun)
 * @param storeName - Optional store name from parent command
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store cannot be resolved
 * @throws {CommanderError} When the prune operation fails
 */
export async function handlePrune(
    options: PruneCommandOptions,
    storeName: string | undefined,
    deps: PruneHandlerDeps = {}
): Promise<void> {
    // 1. Resolve store adapter
    const now = deps.now ?? new Date();
    let adapter: ScopedStorageAdapter;

    if (deps.adapter) {
        adapter = deps.adapter;
    } else {
        const storeResult = await resolveStoreAdapter(storeName);
        if (!storeResult.ok) {
            mapCoreError(storeResult.error);
        }
        adapter = storeResult.value.adapter;
    }

    // 2. Collect all expired memories
    const expiredResult = await collectAllExpired(adapter, now);
    if (!expiredResult.ok) {
        mapCoreError(expiredResult.error);
    }

    const pruned = expiredResult.value;
    const out = deps.stdout ?? process.stdout;

    // 3. Handle no expired memories
    if (pruned.length === 0) {
        out.write('No expired memories found.\n');
        return;
    }

    // 4. Handle dry-run
    if (options.dryRun) {
        const paths = pruned.map((entry) => entry.path).join('\n  ');
        out.write(`Would prune ${pruned.length} expired memories:\n  ${paths}\n`);
        return;
    }

    // 5. Delete expired memories
    const deleteResult = await deleteExpiredMemories(adapter, pruned);
    if (!deleteResult.ok) {
        mapCoreError(deleteResult.error);
    }

    // 6. Reindex after deletion
    const reindexResult = await adapter.indexes.reindex();
    if (!reindexResult.ok) {
        mapCoreError({ code: 'REINDEX_FAILED', message: 'Failed to reindex after pruning.' });
    }

    const paths = pruned.map((entry) => entry.path).join('\n  ');
    out.write(`Pruned ${pruned.length} expired memories:\n  ${paths}\n`);
}

/**
 * The `prune` subcommand for removing expired memories.
 *
 * Removes all expired memories from the store. Use --dry-run to preview
 * what would be deleted without actually removing anything.
 *
 * @example
 * ```bash
 * cortex store prune
 * cortex store prune --dry-run
 * ```
 */
export const pruneCommand = new Command('prune')
    .description('Remove expired memories from the store')
    .option('--dry-run', 'Show what would be pruned without deleting')
    .action(async (options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        await handlePrune(options, parentOpts?.store);
    });
