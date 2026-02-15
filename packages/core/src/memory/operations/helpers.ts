/**
 * Shared internal helpers for memory operations.
 *
 * These functions are used across multiple operation modules but are not
 * part of the public API. They handle common patterns like error creation,
 * index reading, category discovery, and recursive memory collection.
 *
 * @module core/memory/operations/_helpers
 * @internal
 */

import type { Result } from '@/result.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import type { Category } from '@/category/types.ts';
import { memoryError, type MemoryError, type MemoryResult } from '@/memory/result.ts';
import { ok } from '@/result.ts';
import type { ListedMemory, ListedSubcategory } from './list.ts';
import { CategoryPath } from '@/category/category-path.ts';

/**
 * Reads a category index from storage.
 *
 * @param storage - The scoped storage adapter
 * @param categoryPath - The category path to read the index for
 * @returns Result containing the index or null if not found, or a MemoryError on failure
 *
 * @example
 * ```typescript
 * const result = await readCategoryIndex(storage, 'project/cortex');
 * if (result.ok && result.value) {
 *     console.log('Memories:', result.value.memories.length);
 * }
 * ```
 */
export const readCategoryIndex = async (
    storage: ScopedStorageAdapter,
    categoryPath: CategoryPath,
): Promise<Result<Category | null, MemoryError>> => {
    const result = await storage.indexes.read(categoryPath);
    if (!result.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to read index: ${categoryPath}`, {
            cause: result.error,
        });
    }

    return ok(result.value);
};

/**
 * Discovers all root categories by reading the store's root index.
 * Returns the category paths from the subcategories array.
 *
 * This enables dynamic discovery of categories instead of relying on
 * a hardcoded list, allowing stores to have any root-level categories.
 *
 * @param storage - The scoped storage adapter
 * @returns Result containing an array of root category paths, or a MemoryError on failure
 *
 * @example
 * ```typescript
 * const result = await discoverRootCategories(storage);
 * if (result.ok()) {
 *     console.log('Root categories:', result.value); // ['project', 'human', 'standards']
 * }
 * ```
 */
export const discoverRootCategories = async (
    storage: ScopedStorageAdapter,
): Promise<Result<CategoryPath[], MemoryError>> => {
    const indexResult = await storage.indexes.read(CategoryPath.root());
    if (!indexResult.ok()) {
        return memoryError('STORAGE_ERROR', 'Failed to read index: root', {
            cause: indexResult.error,
        });
    }

    if (!indexResult.value) {
        // No root index exists, return empty list
        return ok([]);
    }

    // Extract category paths from subcategories
    const categoryPaths = indexResult.value.subcategories.map((sub) => sub.path);
    return ok(categoryPaths);
};

/**
 * Collects memories recursively from a category and its subcategories.
 *
 * Walks the category tree, reading each memory file, parsing it with the
 * serializer, and filtering based on expiration. Uses a visited set to
 * prevent cycles.
 *
 * @param storage - The scoped storage adapter
 * @param serializer - Memory serializer for parsing memory files
 * @param categoryPath - The category path to collect from
 * @param includeExpired - Whether to include expired memories
 * @param now - Current time for expiration checks
 * @param visited - Set of already-visited category paths (cycle prevention)
 * @returns Result containing an array of listed memories, or a MemoryError on failure
 *
 * @example
 * ```typescript
 * const visited = new Set<string>();
 * const result = await collectMemoriesFromCategory(
 *     storage, serializer, 'project', false, new Date(), visited
 * );
 * ```
 */
export const collectMemoriesFromCategory = async (
    storage: ScopedStorageAdapter,
    categoryPath: CategoryPath,
    includeExpired: boolean,
    now: Date,
    visited: Set<string>,
): Promise<MemoryResult<ListedMemory[]>> => {
    // Prevent cycles
    if (visited.has(categoryPath.toString())) return ok([]);
    visited.add(categoryPath.toString());

    // Read index
    const indexResult = await storage.indexes.read(categoryPath);
    if (!indexResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to read index: ${categoryPath}`, {
            cause: indexResult.error,
        });
    }

    const index = indexResult.value;
    if (!index) {
        return ok([]);
    }

    const memories: ListedMemory[] = [];

    // Process memories in this category
    for (const entry of index.memories) {
        if (entry.path.category.toString() !== categoryPath.toString()) {
            continue;
        }

        const readResult = await storage.memories.read(entry.path);
        if (!readResult.ok()) {
            // Skip memories that can't be read
            continue;
        }
        if (!readResult.value) {
            // Memory file doesn't exist
            continue;
        }

        const memory = readResult.value;
        const memoryExpired = memory.isExpired(now);

        // Filter based on includeExpired
        if (!includeExpired && memoryExpired) {
            continue;
        }

        memories.push({
            path: entry.path,
            tokenEstimate: entry.tokenEstimate,
            summary: entry.summary,
            expiresAt: memory.metadata.expiresAt,
            isExpired: memoryExpired,
            updatedAt: entry.updatedAt,
        });
    }

    // Recurse into subcategories
    for (const subcategory of index.subcategories) {
        const subResult = await collectMemoriesFromCategory(
            storage,
            subcategory.path,
            includeExpired,
            now,
            visited,
        );
        if (subResult.ok()) {
            memories.push(...subResult.value);
        }
    }

    return ok(memories);
};

/**
 * Collects direct subcategories from a category index.
 *
 * @param storage - The scoped storage adapter
 * @param categoryPath - The category path to read subcategories from
 * @returns Result containing an array of listed subcategories, or a MemoryError on failure
 *
 * @example
 * ```typescript
 * const result = await collectDirectSubcategories(storage, 'project');
 * if (result.ok) {
 *     for (const sub of result.value) {
 *         console.log(`${sub.path}: ${sub.memoryCount} memories`);
 *     }
 * }
 * ```
 */
export const collectDirectSubcategories = async (
    storage: ScopedStorageAdapter,
    categoryPath: CategoryPath,
): Promise<Result<ListedSubcategory[], MemoryError>> => {
    const indexResult = await storage.indexes.read(categoryPath);
    if (!indexResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to read index: ${categoryPath}`, {
            cause: indexResult.error,
        });
    }

    const index = indexResult.value;
    if (!index) {
        return ok([]);
    }

    return ok(
        index.subcategories.map((subcategory) => ({
            path: subcategory.path,
            memoryCount: subcategory.memoryCount,
            description: subcategory.description,
        })),
    );
};

/**
 * Extracts the category path from a slug path by removing the last segment.
 *
 * @param slugPath - Full memory slug path (e.g., "project/cortex/config")
 * @returns The category portion of the path (e.g., "project/cortex")
 *
 * @example
 * ```typescript
 * getCategoryFromSlugPath('project/cortex/config'); // 'project/cortex'
 * getCategoryFromSlugPath('notes/todo'); // 'notes'
 * ```
 */
export const getCategoryFromSlugPath = (slugPath: string): string => {
    const parts = slugPath.split('/');
    return parts.slice(0, -1).join('/');
};
