/**
 * Get memory operation.
 *
 * @module core/memory/operations/get
 */

import type { ScopedStorageAdapter } from '@/storage/adapter.ts';

import { MemoryPath } from '../memory-path.ts';
import { memoryError, type MemoryResult } from '../result.ts';
import type { Memory } from '../memory.ts';
import { ok } from '@/result.ts';

/** Options for retrieving a memory */
export interface GetMemoryOptions {
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/**
 * Retrieves a memory with optional expiration filtering.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param path - Memory path (e.g., "project/cortex/config")
 * @param options - Retrieval options (includeExpired, now)
 * @returns Result containing Memory or MemoryError
 *
 * @example
 * ```typescript
 * const result = await getMemory(storage, serializer, 'project/cortex/config');
 * if (result.ok) {
 *     console.log(result.value.content);
 * }
 * ```
 */
export const getMemory = async (
    storage: ScopedStorageAdapter,
    path: string,
    options?: GetMemoryOptions,
): Promise<MemoryResult<Memory>> => {
    const pathResult = MemoryPath.fromPath(path); 
    if (!pathResult.ok()) {
        return memoryError('INVALID_PATH', pathResult.error.message, {
            path: path,
        });
    }

    const memoryPath = pathResult.value;
    const readResult = await storage.memories.read(memoryPath);
    if (!readResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to read memory: ${path}`, {
            path: path,
            cause: readResult.error,
        });
    }

    const memory = readResult.value;
    if (!memory) {
        return memoryError('MEMORY_NOT_FOUND', `Memory not found: ${path}`, {
            path: path,
        });
    }

    const now = options?.now ?? new Date();
    const includeExpired = options?.includeExpired ?? false;
    if (!includeExpired && memory.isExpired(now)) {
        return memoryError('MEMORY_EXPIRED', `Memory has expired: ${path}`, {
            path: path,
        }); 
    }

    return ok(memory);
};
