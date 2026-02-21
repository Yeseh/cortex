/**
 * Get recent memories operation.
 *
 * @module core/memory/operations/recent
 */

import type { StorageAdapter } from '@/storage/index.ts';
import { ok, type Result } from '@/result.ts';
import { discoverRootCategories } from './helpers.ts';
import { type MemoryPath } from '../memory-path.ts';
import { CategoryPath } from '@/category/category-path.ts';
import { memoryError, type MemoryError } from '../result.ts';

/** Options for retrieving recent memories */
export interface GetRecentMemoriesOptions {
    /** Category to scope retrieval (undefined = all categories) */
    category?: string;
    /** Maximum number of memories to return (default: 5) */
    limit?: number;
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** A recent memory entry with full content */
export interface RecentMemory {
    /** Full path to the memory */
    path: string;
    /** Memory content */
    content: string;
    /** When the memory was last updated */
    updatedAt: Date | null;
    /** Estimated token count */
    tokenEstimate: number;
    /** Tags for categorization */
    tags: string[];
}

/** Result of getRecentMemories operation */
export interface GetRecentMemoriesResult {
    /** Category that was queried ("all" or the specified category path) */
    category: string;
    /** Number of memories returned */
    count: number;
    /** Recent memories with full content */
    memories: RecentMemory[];
}

/**
 * Retrieves the most recently updated memories across the store or within a category.
 *
 * Walks all categories (or the specified category tree), collects index entries with
 * updatedAt timestamps, filters expired memories unless requested, sorts by recency
 * (newest first), and returns the top N with full content.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param options - Retrieval options (category, limit, includeExpired, now)
 * @returns Result containing GetRecentMemoriesResult or MemoryError
 *
 * @example
 * ```typescript
 * // Get 5 most recent memories across the entire store
 * const result = await getRecentMemories(storage, serializer);
 *
 * // Get 10 most recent from a specific category
 * const result = await getRecentMemories(storage, serializer, {
 *   category: 'project/cortex',
 *   limit: 10
 * });
 * ```
 */
export const getRecentMemories = async (
    storage: StorageAdapter,
    options?: GetRecentMemoriesOptions,
): Promise<Result<GetRecentMemoriesResult, MemoryError>> => {
    const limit = options?.limit ?? 5;
    const includeExpired = options?.includeExpired ?? false;
    const now = options?.now ?? new Date();
    const category = options?.category;

    // 1. Collect all index entries from the category tree
    type IndexEntryWithCategory = {
        entry: { path: MemoryPath; updatedAt?: Date; tokenEstimate: number; summary?: string };
        categoryPath: CategoryPath;
    };

    const allEntries: IndexEntryWithCategory[] = [];

    const collectEntriesFromCategory = async (
        catPath: CategoryPath,
    ): Promise<Result<void, MemoryError>> => {
        const indexResult = await storage.indexes.load(catPath);
        if (!indexResult.ok()) {
            return memoryError('STORAGE_ERROR', `Failed to read index: ${catPath}`, {
                cause: indexResult.error,
            });
        }
        if (!indexResult.value) {
            return ok(undefined);
        }

        const index = indexResult.value;

        // Collect memory entries from this category
        for (const entry of index.memories) {
            allEntries.push({ 
                entry,
                categoryPath: catPath});
        }

        // Recurse into subcategories
        for (const subcategory of index.subcategories) {
            const recurseResult = await collectEntriesFromCategory(subcategory.path);
            if (!recurseResult.ok()) {
                return recurseResult;
            }
        }

        return ok(undefined);
    };

    // Determine which categories to walk
    if (category) {
        const categoryPathResult = CategoryPath.fromString(category);
        if (!categoryPathResult.ok()) {
            return memoryError('INVALID_PATH', `Invalid category path: ${category}`, {
                path: category,
                cause: categoryPathResult.error,
            });
        }

        // Specific category requested
        const collectResult = await collectEntriesFromCategory(categoryPathResult.value);
        if (!collectResult.ok()) {
            return collectResult;
        }
    }
    else {
        // Walk all root categories
        const rootCategoriesResult = await discoverRootCategories(storage);
        if (!rootCategoriesResult.ok()) {
            return rootCategoriesResult;
        }
        const rootCategories = rootCategoriesResult.value;

        for (const rootCat of rootCategories) {
            const collectResult = await collectEntriesFromCategory(rootCat);
            if (!collectResult.ok()) {
                return collectResult;
            }
        }
    }

    // 2. Sort by updatedAt descending (nulls last) - no I/O
    allEntries.sort((a, b) => {
        const aDate = a.entry.updatedAt;
        const bDate = b.entry.updatedAt;

        // Nulls sort last
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;

        // Descending order (newest first)
        return bDate.getTime() - aDate.getTime();
    });

    // 3. Read and filter incrementally until we have enough valid memories
    const memories: RecentMemory[] = [];

    for (const entryWithCat of allEntries) {
        // Stop once we have enough memories
        if (memories.length >= limit) break;

        // Read the memory to check expiration and get content
        const readResult = await storage.memories.load(
            entryWithCat.entry.path,
        );

        if (!readResult.ok() || !readResult.value) {
            // Skip memories that can't be read
            continue;
        }


        const memory = readResult.value;
        const memoryExpired = memory.isExpired(now);
        if (!includeExpired && memoryExpired) {
            continue;
        }

        // Add to results
        memories.push({
            path: entryWithCat.entry.path.toString(),
            content: memory.content,
            updatedAt: entryWithCat.entry.updatedAt ?? null,
            tokenEstimate: entryWithCat.entry.tokenEstimate,
            tags: memory.metadata.tags,
        });
    }

    // 4. Return result
    return ok({
        category: category ?? 'all',
        count: memories.length,
        memories,
    });
};
