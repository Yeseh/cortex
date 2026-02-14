/**
 * Move memory operation.
 *
 * @module core/memory/operations/move
 */

import { type Result, ok } from '@/result.ts';
import { memoryError } from '../result.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import type { MemoryError } from '@/memory/result.ts';
import { MemoryPath } from '@/memory/memory-path.ts';
import { getCategoryFromSlugPath } from './helpers.ts';

/**
 * Moves a memory to a new path with pre-flight checks.
 *
 * Validates both source and destination paths, ensures the source exists
 * and the destination does not, creates the destination category, performs
 * the move, and reindexes.
 *
 * @param storage - The composed storage adapter
 * @param fromPath - Source memory path
 * @param toPath - Destination memory path
 * @returns Result indicating success or failure with MemoryError
 *
 * @example
 * ```typescript
 * const result = await moveMemory(storage, 'project/old/memory', 'project/new/memory');
 * if (result.ok()) {
 *     console.log('Move completed');
 * }
 * ```
 */
export const moveMemory = async (
    storage: ScopedStorageAdapter,
    fromPath: string,
    toPath: string,
): Promise<Result<void, MemoryError>> => {
    // 1. Validate both paths
    const fromResult = MemoryPath.fromPath(fromPath);
    if (!fromResult.ok()) {
        return memoryError('INVALID_PATH', fromResult.error.message, {
            path: fromPath,
        });
    }

    const toResult = MemoryPath.fromPath(toPath);
    if (!toResult.ok()) {
        return memoryError('INVALID_PATH', toResult.error.message, {
            path: toPath,
        });
    }

    // Check for same-path move (no-op)
    if (fromPath === toPath) {
        return ok(undefined);
    }

    // 2. Check source exists
    const sourceCheck = await storage.memories.read(fromResult.value);
    if (!sourceCheck.ok()) {
        return  memoryError('STORAGE_ERROR', `Failed to read source memory: ${fromPath}`, {
            path: fromPath,
            cause: sourceCheck.error,
        });
    }

    if (!sourceCheck.value) {
        return memoryError('MEMORY_NOT_FOUND', `Source memory not found: ${fromPath}`, {
            path: fromPath,
        });
    }

    // 3. Check destination doesn't exist
    const destCheck = await storage.memories.read(toResult.value);
    if (!destCheck.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to check destination: ${toPath}`, {
            path: toPath,
            cause: destCheck.error,
        });
    }

    if (destCheck.value) {
        return memoryError('DESTINATION_EXISTS', `Destination already exists: ${toPath}`, {
            path: toPath,
        });
    }

    // 4. Create destination category
    const destCategory = getCategoryFromSlugPath(toPath);
    const ensureResult = await storage.categories.ensure(destCategory);
    if (!ensureResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to create destination category: ${destCategory}`, {
            cause: ensureResult.error,
        });
    }

    // 5. Move using storage.memories.move()
    const moveResult = await storage.memories.move(fromResult.value, toResult.value);
    if (!moveResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to move memory from ${fromPath} to ${toPath}`, {
            cause: moveResult.error,
        });
    }

    // 6. Reindex using storage.indexes.reindex()
    const reindexResult = await storage.indexes.reindex();
    if (!reindexResult.ok()) {
        return memoryError('STORAGE_ERROR', 'Failed to reindex after move', {
            cause: reindexResult.error,
        });
    }

    return ok(undefined);
};
