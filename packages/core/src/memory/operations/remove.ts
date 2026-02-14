/**
 * Remove memory operation.
 *
 * @module core/memory/operations/remove
 */

import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { ok, type Result } from '@/result.ts';
import { MemoryPath } from '../memory-path.ts';
import { memoryError, type MemoryError } from '../result.ts';

/**
 * Removes a memory and updates indexes.
 *
 * Validates the path, checks the memory exists, removes it, and
 * performs a full reindex to update all category indexes.
 *
 * @param storage - The composed storage adapter
 * @param slugPath - Memory path to remove
 * @returns Result indicating success or failure with MemoryError
 *
 * @example
 * ```typescript
 * const result = await removeMemory(storage, 'project/cortex/old-config');
 * ```
 */
export const removeMemory = async (
    storage: ScopedStorageAdapter,
    slugPath: string,
): Promise<Result<void, MemoryError>> => {
    // 1. Validate path
    const pathResult = MemoryPath.fromString(slugPath);    
    if (!pathResult.ok()) {
        return memoryError('INVALID_PATH', pathResult.error.message, {
            path: slugPath,
        });
    }

    // 2. Check memory exists
    const path = pathResult.value;
    const checkResult = await storage.memories.read(path);
    if (!checkResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to read memory: ${slugPath}`, {
            path: slugPath,
            cause: checkResult.error,
        });
    }

    if (!checkResult.value) {
        return memoryError('MEMORY_NOT_FOUND', `Memory not found: ${slugPath}`, {
            path: slugPath,
        });
    }

    // 3. Remove using storage.memories.remove()
    const removeResult = await storage.memories.remove(path);
    if (!removeResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to remove memory: ${slugPath}`, {
            path: slugPath,
            cause: removeResult.error, 
        });
    }

    // 4. Reindex using storage.indexes.reindex()
    const reindexResult = await storage.indexes.reindex();
    if (!reindexResult.ok()) {
        return memoryError('STORAGE_ERROR', 'Failed to reindex after remove', {
            cause: reindexResult.error,
        });
    }

    return ok(undefined);
};
