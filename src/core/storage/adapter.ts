/**
 * Storage adapter interfaces for memory persistence.
 *
 * This module defines focused, single-responsibility storage interfaces
 * following the Interface Segregation Principle (ISP). Each interface
 * handles a specific concern:
 *
 * - {@link MemoryStorage} - Raw memory file operations
 * - {@link IndexStorage} - Index file operations and reindexing
 * - {@link StoreStorage} - Store registry persistence
 * - {@link CategoryStorage} - Category operations (imported from category/types)
 *
 * The composed {@link ComposedStorageAdapter} interface aggregates these focused
 * interfaces for implementations that provide all storage capabilities.
 *
 * During the transition period, {@link StorageAdapter} maintains backward
 * compatibility with existing code while new code should use the focused interfaces.
 *
 * @module core/storage/adapter
 */

import type { MemorySlugPath, Result } from '../types.ts';
import type { CategoryStorage } from '../category/types.ts';
import type {
    StoreRegistry,
    StoreRegistryLoadError,
    StoreRegistrySaveError,
} from '../store/registry.ts';

/**
 * Index file identifier type.
 *
 * Used to reference different index files within a store.
 */
export type StorageIndexName = string;

/**
 * Error codes for storage adapter operations.
 *
 * - `READ_FAILED` - Unable to read from storage
 * - `WRITE_FAILED` - Unable to write to storage
 * - `INDEX_UPDATE_FAILED` - Index update operation failed
 */
export type StorageAdapterErrorCode = 'READ_FAILED' | 'WRITE_FAILED' | 'INDEX_UPDATE_FAILED';

/**
 * Error details for storage operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the failing path or underlying cause.
 */
export interface StorageAdapterError {
    /** Machine-readable error code for programmatic handling */
    code: StorageAdapterErrorCode;
    /** Human-readable error message */
    message: string;
    /** Storage path that caused the error (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

/**
 * Result of a reindex operation.
 *
 * Contains warnings about files that could not be indexed normally,
 * such as files with paths that normalize to empty strings or
 * collisions between normalized paths.
 */
export interface ReindexResult {
    /** Warnings about files that were skipped or renamed during indexing */
    warnings: string[];
}

// ============================================================================
// Focused Storage Interfaces (ISP)
// ============================================================================

/**
 * Storage interface for memory file operations.
 *
 * Handles raw memory file I/O without any index management concerns.
 * Implementations should handle file encoding, path resolution, and
 * basic filesystem errors.
 *
 * @example
 * ```typescript
 * const result = await storage.read('project/cortex/architecture');
 * if (result.ok && result.value !== null) {
 *   console.log('Memory contents:', result.value);
 * }
 * ```
 */
export interface MemoryStorage {
    /**
     * Reads the contents of a memory file.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result with file contents, or null if the memory does not exist
     */
    read(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>>;

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
    write(slugPath: MemorySlugPath, contents: string): Promise<Result<void, StorageAdapterError>>;

    /**
     * Removes a memory file.
     *
     * Silently succeeds if the file does not exist.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result indicating success or failure
     */
    remove(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>>;

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
    move(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>>;
}

/**
 * Storage interface for index file operations.
 *
 * Handles index file I/O and reindexing operations. Indexes are used
 * to maintain searchable metadata about memories and categories.
 *
 * @example
 * ```typescript
 * // Read and update an index after memory changes
 * const indexResult = await storage.read('category-index');
 * // ... process and update index ...
 * await storage.write('category-index', updatedContents);
 * ```
 */
export interface IndexStorage {
    /**
     * Reads the contents of an index file.
     *
     * @param name - Index identifier (e.g., "category-index", "search-index")
     * @returns Result with file contents, or null if the index does not exist
     */
    read(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>>;

    /**
     * Writes contents to an index file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     *
     * @param name - Index identifier (e.g., "category-index", "search-index")
     * @param contents - The content to write
     * @returns Result indicating success or failure
     */
    write(name: StorageIndexName, contents: string): Promise<Result<void, StorageAdapterError>>;

    /**
     * Rebuilds all category indexes from the current filesystem state.
     *
     * This is a potentially expensive operation that scans all categories
     * and regenerates their index files. Use sparingly, typically for
     * repair operations or initial setup.
     *
     * During reindexing, file paths are normalized to valid slugs:
     * - Uppercase letters are lowercased
     * - Underscores and spaces become hyphens
     * - Invalid characters are removed
     *
     * Files that normalize to empty paths are skipped with a warning.
     * Collisions (multiple files normalizing to the same path) are
     * resolved by appending numeric suffixes (-2, -3, etc.).
     *
     * @returns Result with warnings array, or error on failure
     */
    reindex(): Promise<Result<ReindexResult, StorageAdapterError>>;

    /**
     * Updates indexes after a memory write operation.
     *
     * This method handles incremental index updates when a memory file
     * is created or modified, avoiding full reindex operations.
     *
     * @param slugPath - Memory identifier path that was written
     * @param contents - The content that was written
     * @param options - Optional settings for index behavior
     * @param options.createWhenMissing - Create index entries for new categories (default: true)
     * @returns Result indicating success or failure
     */
    updateAfterMemoryWrite(
        slugPath: MemorySlugPath,
        contents: string,
        options?: { createWhenMissing?: boolean }
    ): Promise<Result<void, StorageAdapterError>>;
}

/**
 * Storage interface for store registry operations.
 *
 * Handles persistence of the store registry, which maps store names
 * to their filesystem paths.
 *
 * @example
 * ```typescript
 * const result = await storage.load('~/.config/cortex/stores.yml');
 * if (result.ok) {
 *   const defaultStore = result.value['default'];
 *   console.log('Default store path:', defaultStore?.path);
 * }
 * ```
 */
export interface StoreStorage {
    /**
     * Loads the store registry from a file.
     *
     * @param path - Filesystem path to the registry file
     * @param options - Optional loading settings
     * @param options.allowMissing - If true, returns empty registry when file is missing
     * @returns Result with the parsed registry or an error
     */
    load(
        path: string,
        options?: { allowMissing?: boolean }
    ): Promise<Result<StoreRegistry, StoreRegistryLoadError>>;

    /**
     * Saves the store registry to a file.
     *
     * Creates parent directories as needed. Overwrites existing content.
     *
     * @param path - Filesystem path to write the registry
     * @param registry - The registry data to persist
     * @returns Result indicating success or failure
     */
    save(path: string, registry: StoreRegistry): Promise<Result<void, StoreRegistrySaveError>>;

    /**
     * Removes a store registry file.
     *
     * Silently succeeds if the file does not exist.
     *
     * @param path - Filesystem path to the registry file
     * @returns Result indicating success or failure
     */
    remove(path: string): Promise<Result<void, StoreRegistrySaveError>>;
}

// ============================================================================
// Composed Storage Adapter Interface (Target State)
// ============================================================================

/**
 * Composed storage adapter aggregating all focused storage interfaces.
 *
 * This interface provides access to all storage capabilities through
 * focused sub-interfaces. Implementations should compose concrete
 * implementations of each sub-interface.
 *
 * Following the Interface Segregation Principle, consumers should depend
 * on only the specific storage interface they need:
 *
 * @example
 * ```typescript
 * // Good: Depend on specific interface
 * function readMemory(storage: MemoryStorage, path: string) {
 *   return storage.read(path);
 * }
 *
 * // Acceptable: Use composed adapter when multiple capabilities needed
 * function syncStore(adapter: ComposedStorageAdapter) {
 *   const memories = adapter.memories;
 *   const indexes = adapter.indexes;
 *   // ... coordinate operations across storage types
 * }
 * ```
 */
export interface ComposedStorageAdapter {
    /** Memory file operations */
    memories: MemoryStorage;
    /** Index file operations and reindexing */
    indexes: IndexStorage;
    /** Category operations */
    categories: CategoryStorage;
    /** Store registry persistence */
    stores: StoreStorage;
}

// ============================================================================
// Legacy Interface (Current Implementation - Backward Compatibility)
// ============================================================================

/**
 * Storage adapter interface for memory persistence.
 *
 * This is the current interface used by existing implementations.
 * New code should prefer the focused interfaces ({@link MemoryStorage},
 * {@link IndexStorage}, etc.) or {@link ComposedStorageAdapter}.
 *
 * Migration path: Implementations will eventually expose the focused
 * interfaces via the `memories`, `indexes`, `categories`, and `stores`
 * properties while maintaining these methods for backward compatibility.
 */
export interface StorageAdapter {
    /**
     * Reads the contents of a memory file.
     *
     * @param slugPath - Memory identifier path
     * @returns Result with file contents or null if missing
     */
    readMemoryFile(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>>;

    /**
     * Writes contents to a memory file with optional index updates.
     *
     * @param slugPath - Memory identifier path
     * @param contents - The content to write
     * @param options - Optional settings for index behavior
     * @returns Result indicating success or failure
     */
    writeMemoryFile(
        slugPath: MemorySlugPath,
        contents: string,
        options?: { allowIndexCreate?: boolean; allowIndexUpdate?: boolean }
    ): Promise<Result<void, StorageAdapterError>>;

    /**
     * Removes a memory file.
     *
     * @param slugPath - Memory identifier path
     * @returns Result indicating success or failure
     */
    removeMemoryFile(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>>;

    /**
     * Moves a memory file from one location to another.
     *
     * @param sourceSlugPath - Current memory path
     * @param destinationSlugPath - Target memory path
     * @returns Result indicating success or failure
     */
    moveMemoryFile(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>>;

    /**
     * Reads the contents of an index file.
     *
     * @param name - Index identifier
     * @returns Result with file contents or null if missing
     */
    readIndexFile(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>>;

    /**
     * Writes contents to an index file.
     *
     * @param name - Index identifier
     * @param contents - The content to write
     * @returns Result indicating success or failure
     */
    writeIndexFile(
        name: StorageIndexName,
        contents: string
    ): Promise<Result<void, StorageAdapterError>>;

    /**
     * Rebuilds all category indexes from the current filesystem state.
     *
     * @returns Result with warnings array, or error on failure
     */
    reindexCategoryIndexes(): Promise<Result<ReindexResult, StorageAdapterError>>;
}

/**
 * Extended storage adapter that combines legacy methods with the new
 * composed interface for gradual migration.
 *
 * Implementations can adopt this interface to provide both the legacy
 * method-based API and the new composition-based API simultaneously,
 * allowing consumers to migrate incrementally.
 *
 * @example
 * ```typescript
 * class MyAdapter implements LegacyStorageAdapter {
 *   // Legacy methods delegate to focused interfaces
 *   readMemoryFile(path) { return this.memories.read(path); }
 *
 *   // Focused interfaces
 *   memories: MemoryStorage = new MyMemoryStorage();
 *   indexes: IndexStorage = new MyIndexStorage();
 *   categories: CategoryStorage = new MyCategoryStorage();
 *   stores: StoreStorage = new MyStoreStorage();
 * }
 * ```
 */
export interface LegacyStorageAdapter extends StorageAdapter, ComposedStorageAdapter {}
