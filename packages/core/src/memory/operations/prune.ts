/**
 * Prune expired memories operation.
 *
 * @module core/memory/operations/prune
 */

import { ok, type Result } from '@/result.ts';
import { memoryError } from '@/memory/result.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import type { MemoryError } from '@/memory/result.ts';
import { discoverRootCategories, collectMemoriesFromCategory } from './helpers.ts';
import { type MemoryPath } from '@/memory/memory-path.ts';

/** Options for pruning expired memories */
export interface PruneOptions {
    /** If true, return what would be pruned without deleting */
    dryRun?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** A pruned memory entry */
export interface PrunedMemory {
    /** Path of the pruned memory */
    path: MemoryPath;
    /** When it expired */
    expiresAt: Date;
}

/** Result of prune operation */
export interface PruneResult {
    /** Memories that were (or would be) pruned */
    pruned: PrunedMemory[];
}

/**
 * Finds and optionally deletes all expired memories.
 *
 * Discovers root categories dynamically, collects all expired memories
 * recursively, and either returns a dry-run list or deletes them and
 * reindexes the store.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param options - Prune options (dryRun, now)
 * @returns Result containing PruneResult or MemoryError
 *
 * @example
 * ```typescript
 * // Dry run to see what would be pruned
 * const result = await pruneExpiredMemories(storage, serializer, { dryRun: true });
 *
 * // Actually prune expired memories
 * const result = await pruneExpiredMemories(storage, serializer);
 * ```
 */
export const pruneExpiredMemories = async (
    storage: ScopedStorageAdapter,
    options?: PruneOptions
): Promise<Result<PruneResult, MemoryError>> => {
    const dryRun = options?.dryRun ?? false;
    const now = options?.now ?? new Date();

    // 1. Discover all root categories dynamically from the store's root index
    const rootCategoriesResult = await discoverRootCategories(storage);
    if (!rootCategoriesResult.ok()) {
        return rootCategoriesResult;
    }
    const rootCategories = rootCategoriesResult.value;

    // 2. Collect all expired memories from discovered categories
    const expiredMemories: PrunedMemory[] = [];

    for (const rootCat of rootCategories) {
        const visited = new Set<string>();
        const collectResult = await collectMemoriesFromCategory(
            storage,
            rootCat,
            true, // Include expired
            now,
            visited
        );
        if (collectResult.ok()) {
            for (const memory of collectResult.value) {
                if (memory.isExpired && memory.expiresAt) {
                    expiredMemories.push({
                        path: memory.path,
                        expiresAt: memory.expiresAt,
                    });
                }
            }
        }
    }

    // 2. If dryRun, return list without deleting
    if (dryRun) {
        return ok({ pruned: expiredMemories });
    }

    // 3. Delete each expired memory
    for (const memory of expiredMemories) {
        const removeResult = await storage.memories.remove(memory.path);
        if (!removeResult.ok()) {
            return memoryError('STORAGE_ERROR', `Failed to remove expired memory: ${memory.path}`, {
                path: memory.path.toString(),
                cause: removeResult.error,
            });
        }
    }

    // 4. Reindex if any were deleted
    if (expiredMemories.length > 0) {
        const reindexResult = await storage.indexes.reindex();
        if (!reindexResult.ok()) {
            return memoryError('STORAGE_ERROR', 'Failed to reindex after prune', {
                cause: reindexResult.error,
            });
        }
    }

    // 5. Return list of pruned memories
    return ok({ pruned: expiredMemories });
};
