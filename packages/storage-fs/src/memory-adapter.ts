/**
 * Filesystem implementation of the MemoryAdapter interface.
 *
 * Provides file-based storage for memory files using the focused
 * MemoryAdapter interface from the ISP refactoring. Memory files
 * are stored as Markdown files (`.md` by default) with content
 * frontmatter for metadata.
 *
 * @module core/storage/filesystem/memory-storage
 * @see {@link MemoryAdapter} - The interface this class implements
 * @see {@link FilesystemIndexStorage} - Related index storage implementation
 */

import { ok, err, Memory, type Result, type MemoryPath, type MemoryData } from '@yeseh/cortex-core';
import type { MemoryAdapter, StorageAdapterError } from '@yeseh/cortex-core/storage';
import type { FilesystemContext } from './types.ts';
import {
    parseMemory,
    readMemory,
    removeMemory,
    moveMemory,
    serializeMemory,
    writeMemory,
} from './memories.ts';

/**
 * Filesystem-based implementation of the MemoryAdapter interface.
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
 * // Add a new memory file
 * const memoryResult = Memory.init('project/cortex/architecture', {
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   tags: ['design', 'overview'],
 *   source: 'user',
 *   citations: [],
 * }, '# Architecture Overview\n');
 * if (memoryResult.ok()) {
 *   await storage.add(memoryResult.value);
 * }
 *
 * // Load a memory file
 * const pathResult = MemoryPath.fromPath('project/cortex/architecture');
 * const result = pathResult.ok() ? await storage.load(pathResult.value) : null;
 * if (result.ok() && result.value !== null) {
 *     console.log('Memory contents:', result.value);
 * }
 *
 * // Save (update) a memory
 * await storage.save(path, { content: 'Updated content', metadata: {...} });
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
 * @see {@link MemoryAdapter} - The interface this class implements
 * @see {@link FilesystemIndexStorage} - Use with index storage for full functionality
 */
export class FilesystemMemoryAdapter implements MemoryAdapter {
    /**
     * Creates a new FilesystemMemoryStorage instance.
     *
     * @param ctx - Filesystem context containing storage root and file extensions
     */
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Loads the contents of a memory file.
     *
     * Resolves the slug path to a filesystem path and reads the file contents.
     * Returns null (not an error) if the memory file does not exist.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result with a Memory object, or null if the memory does not exist
     *
     * @example
     * ```typescript
     * const result = await storage.load('project/cortex/config');
     * if (result.ok()) {
     *     if (result.value !== null) {
     *         console.log('Found memory:', result.value);
     *     } else {
     *         console.log('Memory not found');
     *     }
     * } else {
     *     console.error('Load failed:', result.error.message);
     * }
     * ```
     */
    async load(slugPath: MemoryPath): Promise<Result<Memory | null, StorageAdapterError>> {
        const readResult = await readMemory(this.ctx, slugPath);
        if (!readResult.ok()) {
            return readResult;
        }
        if (!readResult.value) {
            return ok(null);
        }

        const parsed = parseMemory(readResult.value);
        if (!parsed.ok()) {
            return err({
                code: 'IO_READ_ERROR',
                message: `Failed to parse memory file: ${slugPath}.`,
                path: slugPath.toString(),
                cause: parsed.error,
            });
        }

        const memoryResult = Memory.init(slugPath, parsed.value.metadata, parsed.value.content);

        if (!memoryResult.ok()) {
            return err({
                code: 'IO_READ_ERROR',
                message: memoryResult.error.message,
                path: slugPath.toString(),
                cause: memoryResult.error,
            });
        }

        return ok(memoryResult.value);
    }

    /**
     * Saves contents to a memory file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     * Parent directories are created recursively as needed.
     *
     * Note: This method only writes the file. To update category indexes
     * after writing, use {@link FilesystemIndexStorage.updateAfterMemoryWrite}.
     *
     * @param path - Memory identifier path (e.g., "project/cortex/architecture")
     * @param memoryData - The content and metadata to write
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const memoryData: MemoryData = {
     *     content: '# API Reference\nDocumentation for the API...',
     *     metadata: {
     *         createdAt: new Date(),
     *         updatedAt: new Date(),
     *         tags: ['api', 'reference'],
     *         source: 'user',
     *         citations: [],
     *     },
     * };
     *
     * const result = await storage.save('project/cortex/api', memoryData);
     * if (!result.ok()) {
     *     console.error('Save failed:', result.error.message);
     * }
     * ```
     */
    async save(
        path: MemoryPath,
        memoryData: MemoryData,
    ): Promise<Result<void, StorageAdapterError>> {
        const memoryResult = Memory.init(path, memoryData.metadata, memoryData.content);
        if (!memoryResult.ok()) {
            return err({
                code: 'IO_WRITE_ERROR',
                message: `Failed to create memory: ${memoryResult.error.message}`,
                path: path.toString(),
                cause: memoryResult.error,
            });
        }

        const memory = memoryResult.value;
        const serialized = serializeMemory(memory);
        if (!serialized.ok()) {
            return err({
                code: 'IO_WRITE_ERROR',
                message: `Failed to serialize memory: ${path}.`,
                path: path.toString(),
                cause: serialized.error,
            });
        }
        return writeMemory(this.ctx, path, serialized.value);
    }

    /**
     * Adds a new memory.
     *
     * Fails if a memory already exists at the given path.
     * Parent directories are created recursively as needed.
     *
     * @param memory - The Memory object to add
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const memoryResult = Memory.init('project/cortex/architecture', {
     *     createdAt: new Date(),
     *     updatedAt: new Date(),
     *     tags: ['design', 'overview'],
     *     source: 'user',
     *     citations: [],
     * }, '# Architecture Overview\n');
     *
     * if (memoryResult.ok()) {
     *     const result = await storage.add(memoryResult.value);
     *     if (!result.ok()) {
     *         console.error('Add failed:', result.error.message);
     *     }
     * }
     * ```
     */
    async add(memory: Memory): Promise<Result<void, StorageAdapterError>> {
        // Check if memory already exists
        const existingResult = await readMemory(this.ctx, memory.path);
        if (!existingResult.ok()) {
            return existingResult;
        }
        if (existingResult.value !== null) {
            return err({
                code: 'IO_WRITE_ERROR',
                message: `Memory already exists at path: ${memory.path}. Use save() to update existing memories.`,
                path: memory.path.toString(),
            });
        }

        const serialized = serializeMemory(memory);
        if (!serialized.ok()) {
            return err({
                code: 'IO_WRITE_ERROR',
                message: `Failed to serialize memory: ${memory.path}.`,
                path: memory.path.toString(),
                cause: serialized.error,
            });
        }
        return writeMemory(this.ctx, memory.path, serialized.value);
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
     * if (!result.ok()) {
     *     console.error('Remove failed:', result.error.message);
     * }
     * ```
     */
    async remove(slugPath: MemoryPath): Promise<Result<void, StorageAdapterError>> {
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
     * if (!result.ok()) {
     *     console.error('Move failed:', result.error.message);
     * }
     * ```
     */
    async move(
        sourceSlugPath: MemoryPath,
        destinationSlugPath: MemoryPath,
    ): Promise<Result<void, StorageAdapterError>> {
        return moveMemory(this.ctx, sourceSlugPath, destinationSlugPath);
    }
}
