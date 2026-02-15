/**
 * Create memory operation.
 *
 * @module core/memory/operations/create
 */

import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { Memory } from '@/memory';
import { ok } from '@/result.ts';
import { memoryError, type MemoryResult } from '../result.ts';

/** Input for creating a new memory */
export interface CreateMemoryInput {
    /** Memory content (markdown) */
    content: string;
    /** Tags for categorization */
    tags?: string[];
    /** Source identifier (e.g., "cli", "mcp", "user") */
    source: string;
    /** Optional expiration timestamp */
    expiresAt?: Date;
    /**
     * References to source material (file paths, URLs, document identifiers).
     *
     * When omitted or undefined, defaults to an empty array. Each citation must
     * be a non-empty string.
     *
     * @example
     * ```typescript
     * const input: CreateMemoryInput = {
     *     content: 'API design decisions for v2',
     *     source: 'user',
     *     citations: [
     *         'docs/api-spec.md',
     *         'https://github.com/org/repo/issues/123',
     *     ],
     * };
     * ```
     */
    citations?: string[];
}

/**
 * Creates a new memory at the specified path.
 * Auto-creates parent categories as needed.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param path - Memory path (e.g., "project/cortex/config")
 * @param input - Memory creation input
 * @param now - Current time (defaults to new Date())
 * @returns Result indicating success or failure with MemoryError
 *
 * @example
 * ```typescript
 * const result = await create(storage, 'project/cortex/config', {
 *     content: 'Configuration notes',
 *     source: 'user',
 *     tags: ['config'],
 * });
 * ```
 */
export const createMemory = async (
    storage: ScopedStorageAdapter,
    path: string,
    input: CreateMemoryInput,
    now?: Date,
): Promise<MemoryResult<void>> => {
    const timestamp = now ?? new Date();
    const memoryResult = Memory.init(
        path,
        {
            createdAt: timestamp,
            updatedAt: timestamp,
            tags: input.tags ?? [],
            source: input.source,
            expiresAt: input.expiresAt,
            citations: input.citations ?? [],
        },
        input.content,
    );

    if (!memoryResult.ok()) {
        return memoryResult;
    }

    const memory = memoryResult.value;

    const writeResult = await storage.memories.write(memory);
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

    return ok(undefined);
};
