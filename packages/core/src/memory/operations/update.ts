/**
 * Update memory operation.
 *
 * @module core/memory/operations/update
 */

import type { Result } from '@/result.ts';
import type { StorageAdapter } from '@/storage';
import { Memory } from '@/memory/memory.ts';
import type { MemoryError } from '@/memory/result.ts';
import { memoryError } from '@/memory/result.ts';
import { ok } from '@/result.ts';
import { MemoryPath } from '@/memory/memory-path.ts';

/** Input for updating an existing memory */
export interface UpdateMemoryInput {
    /** New content (undefined = keep existing) */
    content?: string;
    /** New tags (undefined = keep existing) */
    tags?: string[];
    /**
     * New expiration date.
     * - `Date` — set expiration to this date
     * - `null` — explicitly clear (remove) the expiration
     * - `undefined` (omitted) — keep the existing value unchanged
     */
    expiresAt?: Date | null;
    /**
     * References to source material (file paths, URLs, document identifiers).
     *
     * **Update semantics:** When provided, completely replaces the existing
     * citations array. To add citations, retrieve the current memory, merge
     * the arrays, and pass the combined result. When omitted or undefined,
     * existing citations are preserved unchanged.
     *
     * @example
     * ```typescript
     * // Replace all citations
     * const update: UpdateMemoryInput = {
     *     citations: ['new-source.md', 'https://example.com/updated'],
     * };
     *
     * // Clear all citations by providing an empty array
     * const clearCitations: UpdateMemoryInput = {
     *     citations: [],
     * };
     *
     * // Keep existing citations by omitting the field
     * const keepCitations: UpdateMemoryInput = {
     *     content: 'Updated content only',
     *     // citations: undefined - existing citations preserved
     * };
     * ```
     */
    citations?: string[];
}

/**
 * Updates an existing memory's content or metadata.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param slugPath - Memory path (e.g., "project/cortex/config")
 * @param updates - Update input (content, tags, expiresAt). Pass expiresAt as null to clear expiration.
 * @param now - Current time (defaults to new Date())
 * @returns Result containing updated Memory or MemoryError
 *
 * @example
 * ```typescript
 * const result = await updateMemory(storage, serializer, 'project/cortex/config', {
 *     content: 'Updated configuration notes',
 *     tags: ['config', 'updated'],
 * });
 * ```
 */
export const updateMemory = async (
    storage: StorageAdapter,
    slugPath: string,
    updates: UpdateMemoryInput,
    now?: Date,
): Promise<Result<Memory, MemoryError>> => {
    // 1. Validate path
    const pathResult = MemoryPath.fromString(slugPath);
    if (!pathResult.ok()) {
        return memoryError('INVALID_PATH', pathResult.error.message, {
            path: slugPath,
        });
    }

    // 2. Check if any updates provided
    const hasUpdates =
        updates.content !== undefined ||
        updates.tags !== undefined ||
        updates.expiresAt !== undefined ||
        updates.citations !== undefined;
    if (!hasUpdates) {
        return memoryError('INVALID_INPUT', 'No updates provided', {
            path: slugPath,
        });
    }

    // 3. Read existing memory
    const readResult = await storage.memories.load(pathResult.value);
    if (!readResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to read memory: ${slugPath}`, {
            path: slugPath,
            cause: readResult.error,
        });
    }
    if (!readResult.value) {
        return memoryError('MEMORY_NOT_FOUND', `Memory not found: ${slugPath}`, {
            path: slugPath,
        });
    }

    const existing = readResult.value;

    // 4. Merge updates
    const timestamp = now ?? new Date();
    const updatedMetadata = {
        createdAt: existing.metadata.createdAt,
        updatedAt: timestamp,
        tags: updates.tags ?? existing.metadata.tags,
        source: existing.metadata.source,
        expiresAt:
            updates.expiresAt === null
                ? undefined
                : (updates.expiresAt ?? existing.metadata.expiresAt),
        citations: updates.citations ?? existing.metadata.citations,
    };

    const updatedResult = Memory.init(
        slugPath,
        updatedMetadata,
        updates.content ?? existing.content,
    );
    if (!updatedResult.ok()) {
        return updatedResult;
    }

    const updatedMemory = updatedResult.value;

    // 5. Write updated memory
    const writeResult = await storage.memories.save(updatedMemory);
    if (!writeResult.ok()) {
        return memoryError('STORAGE_ERROR', `Failed to write memory: ${slugPath}`, {
            path: slugPath,
            cause: writeResult.error,
        });
    }

    // 6. Update indexes
    const indexResult = await storage.indexes.updateAfterMemoryWrite(updatedMemory);
    if (!indexResult.ok()) {
        const reason = indexResult.error.message ?? 'Unknown error';
        return memoryError('STORAGE_ERROR',
            `Memory updated but index update failed for "${slugPath}": ${reason}. ` +
            'Run "cortex store reindex" to rebuild indexes.',
            {
                path: slugPath,
                cause: indexResult.error,
            });
    }

    // 7. Return updated memory
    return ok(updatedMemory);
};
