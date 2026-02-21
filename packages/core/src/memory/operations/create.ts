/**
 * Create memory operation.
 *
 * @module core/memory/operations/create
 */

import type { StorageAdapter } from '@/storage/index.ts';
import { CategoryPath } from '@/category/category-path.ts';
import { Memory, type MemoryData } from '@/memory';
import { ok } from '@/result.ts';
import { memoryError, type MemoryResult } from '../result.ts';


/**
 * Creates a new memory at the specified path.
 *
 * **Breaking Change**: Categories are no longer auto-created. The category
 * must exist before creating a memory. Use `createCategory` first if needed.
 *
 * @param storage - The composed storage adapter
 * @param path - Memory path (e.g., "project/cortex/config") - category must exist
 * @param input - Memory creation input
 * @param now - Current time (defaults to new Date())
 * @returns Result containing the created Memory object on success, or MemoryError on failure
 *
 * @example
 * ```typescript
 * // Ensure category exists first
 * await createCategory(storage.categories, 'project/cortex');
 *
 * // Then create memory
 * const result = await createMemory(storage, 'project/cortex/config', {
 *     content: 'Configuration notes',
 *     source: 'user',
 *     tags: ['config'],
 * });
 * ```
 */
export const createMemory = async (
    storage: StorageAdapter,
    path: string,
    input: MemoryData,
    now?: Date,
): Promise<MemoryResult<Memory>> => {
    // Extract category path from memory path
    const pathSegments = path.split('/');
    if (pathSegments.length < 2) {
        return memoryError('INVALID_PATH',
            `Memory path '${path}' must include at least one category. ` +
            'Example: "category/memory-name"',
            { path });
    }

    const categoryPath = pathSegments.slice(0, -1).join('/');
    const categoryPathResult = CategoryPath.fromString(categoryPath);
    if (!categoryPathResult.ok()) {
        return memoryError('INVALID_PATH',
            `Invalid category in memory path: ${categoryPath}`,
            { path });
    }

    // Check category exists
    const categoryExists = await storage.categories.exists(categoryPathResult.value);
    if (!categoryExists.ok()) {
        return memoryError('STORAGE_ERROR',
            `Failed to check category existence: ${categoryPath}`,
            { path, cause: categoryExists.error });
    }

    if (!categoryExists.value) {
        return memoryError('CATEGORY_NOT_FOUND',
            `Category '${categoryPath}' does not exist. ` +
            `Create it first with 'cortex category create ${categoryPath}' or use the cortex_create_category MCP tool.`,
            { path });
    }

    const timestamp = now ?? new Date();
    const memoryResult = Memory.init(
        path,
        {
            createdAt: timestamp,
            updatedAt: timestamp,
            tags: input.metadata.tags ?? [],
            source: input.metadata.source,
            expiresAt: input.metadata.expiresAt,
            citations: input.metadata.citations ?? [],
        },
        input.content,
    );

    if (!memoryResult.ok()) {
        return memoryResult;
    }

    const memory = memoryResult.value;

    // TODO: Save signature here is not pretty
    const writeResult = await storage.memories.save(memory.path, memory);
    if (!writeResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to write memory: ${path}`, {
            path,
            cause: writeResult.error,
        });
    }

    const indexResult = await storage.indexes.updateAfterMemoryWrite(memory);
    if (!indexResult.ok()) {
        const reason = indexResult.error.message ?? 'Unknown error';
        return memoryError('STORAGE_ERROR',
            `Memory written but index update failed for "${path}": ${reason}. ` +
            'Run "cortex store reindex" to rebuild indexes.',
            {
                path,
                cause: indexResult.error,
            });
    }

    return ok(memory);
};
