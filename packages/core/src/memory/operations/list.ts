/**
 * List memories operation.
 *
 * @module core/memory/operations/list
 */

import type { Result } from '@/result.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import type { MemoryError } from '@/memory/result.ts';
import { ok } from '@/result.ts';
import {
    discoverRootCategories,
    collectMemoriesFromCategory,
    collectDirectSubcategories,
} from './helpers.ts';

/** Options for listing memories */
export interface ListMemoriesOptions {
    /** Category to list (undefined = all root categories) */
    category?: string;
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** A memory entry in list results */
export interface ListedMemory {
    /** Full path to the memory */
    path: string;
    /** Estimated token count */
    tokenEstimate: number;
    /** Brief summary if available */
    summary?: string;
    /** Expiration timestamp if set */
    expiresAt?: Date;
    /** Whether the memory is currently expired */
    isExpired: boolean;
    /** Last updated timestamp (from index entry) */
    updatedAt?: Date;
}

/** A subcategory entry in list results */
export interface ListedSubcategory {
    /** Full path to the subcategory */
    path: string;
    /** Total memories in this subcategory */
    memoryCount: number;
    /** Category description if set */
    description?: string;
}

/** Result of listing memories */
export interface ListMemoriesResult {
    /** Category that was listed (empty string for root) */
    category: string;
    /** Memories found */
    memories: ListedMemory[];
    /** Direct subcategories */
    subcategories: ListedSubcategory[];
}

/**
 * Lists memories in a category or all root categories.
 *
 * When no category is specified, discovers root categories dynamically
 * from the store's root index and collects all memories recursively.
 * When a category is specified, collects memories from that category
 * tree and lists direct subcategories.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param options - List options (category, includeExpired, now)
 * @returns Result containing ListMemoriesResult or MemoryError
 *
 * @example
 * ```typescript
 * // List all memories
 * const result = await listMemories(storage, serializer);
 * if (result.ok()) {
 *     console.log(result.value.memories.length);
 * }
 *
 * // List memories in a specific category
 * const result = await listMemories(storage, serializer, { category: 'project/cortex' });
 * if (result.ok()) {
 *     console.log(result.value.subcategories.length);
 * }
 * ```
 */
export const listMemories = async (
    storage: ScopedStorageAdapter,
    options?: ListMemoriesOptions,
): Promise<Result<ListMemoriesResult, MemoryError>> => {
    const includeExpired = options?.includeExpired ?? false;
    const now = options?.now ?? new Date();
    const category = options?.category ?? '';

    const visited = new Set<string>();
    const memories: ListedMemory[] = [];
    const subcategories: ListedSubcategory[] = [];

    if (!category) {
        // No category specified - discover root categories dynamically
        const rootCategoriesResult = await discoverRootCategories(storage);
        if (!rootCategoriesResult.ok()) {
            return rootCategoriesResult;
        }
        const rootCategories = rootCategoriesResult.value;

        for (const rootCat of rootCategories) {
            const collectResult = await collectMemoriesFromCategory(
                storage,
                rootCat,
                includeExpired,
                now,
                visited,
            );
            if (collectResult.ok()) {
                memories.push(...collectResult.value);
            }

            // Add root category itself as a discoverable subcategory
            const indexResult = await storage.indexes.read(rootCat);
            if (indexResult.ok() && indexResult.value) {
                subcategories.push({
                    path: rootCat,
                    memoryCount: indexResult.value.memories.length,
                    description: undefined,
                });
            }
        }
    }
    else {
        // Specific category requested
        const collectResult = await collectMemoriesFromCategory(
            storage,
            category,
            includeExpired,
            now,
            visited,
        );
        if (!collectResult.ok()) {
            return collectResult;
        }
        memories.push(...collectResult.value);

        const subResult = await collectDirectSubcategories(storage, category);
        if (!subResult.ok()) {
            return subResult;
        }
        subcategories.push(...subResult.value);
    }

    return ok({
        category,
        memories,
        subcategories,
    });
};
