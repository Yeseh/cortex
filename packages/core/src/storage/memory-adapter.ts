import type { Memory, MemoryPath } from "@/memory";
import type { Result } from "@/result";
import type { StorageAdapterError } from ".";

/**
 * Storage interface for memory file operations.
 *
 * Handles raw memory file I/O without any index management concerns.
 * Implementations should handle file encoding, path resolution, and
 * basic filesystem errors.
 *
 * @example
 * ```typescript
 * const result = await memories.load('project/cortex/architecture');
 * if (result.ok && result.value !== null) {
 *   console.log('Memory contents:', result.value);
 * }
 * ```
 */
export interface MemoryAdapter {
    /**
     * Loads the contents of a memory 
     *
     * @param path - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result with file contents, or null if the memory does not exist
     */
    load(path: MemoryPath): Promise<Result<Memory | null, StorageAdapterError>>;

    /**
     * Updates the contents of a memory.
     *
     * Creates the memory if it does not exist. Overwrites existing content.
     *
     * @param path - Memory identifier path (e.g., "project/cortex/architecture")
     * @param memory - The content to write
     * @returns Result indicating success or failure
     */
    save(path: MemoryPath, memory: Partial<Memory>): Promise<Result<void, StorageAdapterError>>;

    /**
     * Adds a new memory.
     *
     * Fails if a memory already exists at the given path. 
     *
     * @param memory - The memory to add
     * @returns Result indicating success or failure
     */
    add(memory: Memory): Promise<Result<void, StorageAdapterError>>;

    /**
     * Removes a memory.
     *
     * Silently succeeds if the memory does not exist.
     *
     * @param path - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result indicating success or failure
     */
    remove(path: MemoryPath): Promise<Result<void, StorageAdapterError>>;

    /**
     * Moves a memory from one location to another.
     *
     * This is an atomic operation when possible. Creates parent categories for the destination path as needed. 
     * Fails if the source memory does not exist or if a memory already exists at the destination path.  
     *
     * @param sourcePath - Current memory path
     * @param destinationPath - Target memory path
     * @returns Result indicating success or failure
     */
    move(
        sourcePath: MemoryPath,
        destinationPath: MemoryPath
    ): Promise<Result<void, StorageAdapterError>>;
}
