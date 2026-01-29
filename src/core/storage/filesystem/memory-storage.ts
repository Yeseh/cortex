/**
 * Filesystem implementation of the MemoryStorage interface.
 *
 * Provides file-based storage for memory files using the focused
 * MemoryStorage interface from the ISP refactoring.
 *
 * @module core/storage/filesystem/memory-storage
 */

import type { MemorySlugPath, Result } from '../../types.ts';
import type { MemoryStorage, StorageAdapterError } from '../adapter.ts';
import type { FilesystemContext } from './types.ts';
import { readMemory, writeMemory, removeMemory, moveMemory } from './memories.ts';

/**
 * Filesystem-based implementation of the MemoryStorage interface.
 *
 * Delegates to the existing memory file operations in memories.ts,
 * providing a focused interface for memory file I/O without index
 * management concerns.
 *
 * @example
 * ```typescript
 * const ctx: FilesystemContext = {
 *     storeRoot: '/path/to/storage',
 *     memoryExtension: '.md',
 *     indexExtension: '.yaml',
 * };
 *
 * const storage = new FilesystemMemoryStorage(ctx);
 *
 * // Read a memory file
 * const result = await storage.read('project/cortex/architecture');
 * if (result.ok && result.value !== null) {
 *     console.log('Memory contents:', result.value);
 * }
 * ```
 */
export class FilesystemMemoryStorage implements MemoryStorage {
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Reads the contents of a memory file.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result with file contents, or null if the memory does not exist
     */
    async read(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>> {
        return readMemory(this.ctx, slugPath);
    }

    /**
     * Writes contents to a memory file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     * Parent directories are created as needed.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @param contents - The content to write
     * @returns Result indicating success or failure
     */
    async write(
        slugPath: MemorySlugPath,
        contents: string,
    ): Promise<Result<void, StorageAdapterError>> {
        return writeMemory(this.ctx, slugPath, contents);
    }

    /**
     * Removes a memory file.
     *
     * Silently succeeds if the file does not exist.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result indicating success or failure
     */
    async remove(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>> {
        return removeMemory(this.ctx, slugPath);
    }

    /**
     * Moves a memory file from one location to another.
     *
     * This is an atomic operation when possible. The destination
     * parent directories are created as needed.
     *
     * @param sourceSlugPath - Current memory path
     * @param destinationSlugPath - Target memory path
     * @returns Result indicating success or failure
     */
    async move(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath,
    ): Promise<Result<void, StorageAdapterError>> {
        return moveMemory(this.ctx, sourceSlugPath, destinationSlugPath);
    }
}
