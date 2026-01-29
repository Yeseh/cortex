/**
 * Filesystem implementation of the MemoryStorage interface.
 *
 * Provides file-based storage for memory files using the focused
 * MemoryStorage interface from the ISP refactoring. Memory files
 * are stored as Markdown files (`.md` by default) with content
 * frontmatter for metadata.
 *
 * @module core/storage/filesystem/memory-storage
 * @see {@link MemoryStorage} - The interface this class implements
 * @see {@link FilesystemIndexStorage} - Related index storage implementation
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
 * management concerns. This separation allows consumers to depend only
 * on memory operations without pulling in index dependencies.
 *
 * Memory files are stored using the following conventions:
 * - Path: `{storeRoot}/{category/path}/{slug}.md`
 * - Encoding: UTF-8
 * - Format: Markdown with optional YAML frontmatter for metadata
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
 * // Write a memory file
 * await storage.write('project/cortex/architecture', `---
 * tags: [design, overview]
 * ---
 * # Architecture Overview
 * This document describes the system architecture...
 * `);
 *
 * // Read a memory file
 * const result = await storage.read('project/cortex/architecture');
 * if (result.ok && result.value !== null) {
 *     console.log('Memory contents:', result.value);
 * }
 *
 * // Move a memory to a new location
 * await storage.move(
 *     'project/cortex/architecture',
 *     'project/cortex/docs/architecture'
 * );
 *
 * // Remove a memory
 * await storage.remove('project/cortex/deprecated-doc');
 * ```
 *
 * @see {@link MemoryStorage} - The interface this class implements
 * @see {@link FilesystemIndexStorage} - Use with index storage for full functionality
 */
export class FilesystemMemoryStorage implements MemoryStorage {
    /**
     * Creates a new FilesystemMemoryStorage instance.
     *
     * @param ctx - Filesystem context containing storage root and file extensions
     */
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Reads the contents of a memory file.
     *
     * Resolves the slug path to a filesystem path and reads the file contents.
     * Returns null (not an error) if the memory file does not exist.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result with file contents as a string, or null if the memory does not exist
     *
     * @example
     * ```typescript
     * const result = await storage.read('project/cortex/config');
     * if (result.ok) {
     *     if (result.value !== null) {
     *         console.log('Found memory:', result.value);
     *     } else {
     *         console.log('Memory not found');
     *     }
     * } else {
     *     console.error('Read failed:', result.error.message);
     * }
     * ```
     */
    async read(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>> {
        return readMemory(this.ctx, slugPath);
    }

    /**
     * Writes contents to a memory file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     * Parent directories are created recursively as needed.
     *
     * Note: This method only writes the file. To update category indexes
     * after writing, use {@link FilesystemIndexStorage.updateAfterMemoryWrite}.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @param contents - The content to write (typically Markdown with optional frontmatter)
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const content = `---
     * tags: [api, reference]
     * ---
     * # API Reference
     * Documentation for the API...
     * `;
     *
     * const result = await storage.write('project/cortex/api', content);
     * if (!result.ok) {
     *     console.error('Write failed:', result.error.message);
     * }
     * ```
     */
    async write(
        slugPath: MemorySlugPath,
        contents: string,
    ): Promise<Result<void, StorageAdapterError>> {
        return writeMemory(this.ctx, slugPath, contents);
    }

    /**
     * Removes a memory file from the filesystem.
     *
     * Silently succeeds if the file does not exist (idempotent operation).
     * Does not remove empty parent directories.
     *
     * Note: This method only removes the file. Category indexes should be
     * updated separately if needed.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Remove a memory (succeeds even if it doesn't exist)
     * const result = await storage.remove('project/cortex/old-doc');
     * if (!result.ok) {
     *     console.error('Remove failed:', result.error.message);
     * }
     * ```
     */
    async remove(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>> {
        return removeMemory(this.ctx, slugPath);
    }

    /**
     * Moves a memory file from one location to another.
     *
     * Performs an atomic rename operation when possible (same filesystem).
     * Falls back to copy+delete for cross-filesystem moves.
     * Destination parent directories are created as needed.
     *
     * Note: This method only moves the file. Category indexes for both
     * source and destination categories should be updated separately.
     *
     * @param sourceSlugPath - Current memory path (e.g., "project/old/doc")
     * @param destinationSlugPath - Target memory path (e.g., "project/new/doc")
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Move a memory to a new category
     * const result = await storage.move(
     *     'project/cortex/overview',
     *     'project/cortex/docs/overview'
     * );
     * if (!result.ok) {
     *     console.error('Move failed:', result.error.message);
     * }
     * ```
     */
    async move(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath,
    ): Promise<Result<void, StorageAdapterError>> {
        return moveMemory(this.ctx, sourceSlugPath, destinationSlugPath);
    }
}
