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

import type { Memory } from '@/memory/memory';
import type { Result } from '@/result.ts';
import type { CategoryIndex } from '../index/types.ts';
import type { CategoryStorage } from '../category/types.ts';
import type {
    Registry as RegistryData,
    StoreRegistry,
    StoreRegistryLoadError,
    StoreRegistrySaveError,
} from '../store/registry.ts';
import type { CortexSettings } from '../config.ts';
import type { MemoryPath } from '@/memory/memory-path.ts';
import type { CategoryPath } from '@/category/category-path.ts';

/**
 * Error codes for storage adapter operations.
 *
 * - `IO_READ_ERROR` - Unable to read from storage
 * - `IO_WRITE_ERROR` - Unable to write to storage
 * - `INDEX_ERROR` - Index operation failed
 */
export type StorageAdapterErrorCode = 'IO_READ_ERROR' | 'IO_WRITE_ERROR' | 'INDEX_ERROR';

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
    read(slugPath: MemoryPath): Promise<Result<Memory | null, StorageAdapterError>>;

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
    write(contents: Memory): Promise<Result<void, StorageAdapterError>>;

    /**
     * Removes a memory file.
     *
     * Silently succeeds if the file does not exist.
     *
     * @param slugPath - Memory identifier path (e.g., "project/cortex/architecture")
     * @returns Result indicating success or failure
     */
    remove(slugPath: MemoryPath): Promise<Result<void, StorageAdapterError>>;

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
        sourceSlugPath: MemoryPath,
        destinationSlugPath: MemoryPath
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
 * const indexResult = await storage.read('project/cortex');
 * if (indexResult.ok && indexResult.value) {
 *   const updatedIndex: CategoryIndex = {
 *     ...indexResult.value,
 *     memories: [...indexResult.value.memories],
 *   };
 *   await storage.write('project/cortex', updatedIndex);
 * }
 * ```
 */
export interface IndexStorage {
    /**
     * Reads the contents of an index file.
     *
     * @param path - Index identifier (category path, or empty string for root)
     * @returns Result with file contents, or null if the index does not exist
     *
     * @example
     * ```typescript
     * const rootIndex = await storage.read('');
     * const categoryIndex = await storage.read('standards/typescript');
     * ```
     *
     * @edgeCases
     * - Passing an empty string reads the root index.
     * - When the index file is missing, the result is `ok(null)` rather than an error.
     */
    read(category: CategoryPath): Promise<Result<CategoryIndex | null, StorageAdapterError>>;

    /**
     * Writes contents to an index file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     *
     * @param path - Index identifier (category path, or empty string for root)
     * @param contents - The content to write
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.write('', { memories: [], subcategories: [] });
     * ```
     *
     * @edgeCases
     * - Writing to the root index uses an empty string as the path.
     * - Serialization failures (e.g., invalid paths or counts) surface as `INDEX_ERROR`.
     */
    write(path: CategoryPath, contents: CategoryIndex
    ): Promise<Result<void, StorageAdapterError>>;

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
     *
     * @example
     * ```typescript
     * const result = await storage.reindex();
     * if (result.ok) {
     *   console.log(result.value.warnings);
     * }
     * ```
     *
     * @edgeCases
     * - Empty or missing directories return `ok({ warnings: [] })`.
     * - Slug collisions are resolved automatically and reported in `warnings`.
     */
    reindex(): Promise<Result<ReindexResult, StorageAdapterError>>;

    /**
     * Updates indexes after a memory write operation.
     *
     * This method handles incremental index updates when a memory file
     * is created or modified, avoiding full reindex operations.
     *
     * @param slugPath - Memory identifier path that was written
     * @param memory - The memory that was written
     * @param options - Optional settings for index behavior
     * @param options.createWhenMissing - Create index entries for new categories (default: true)
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.updateAfterMemoryWrite(
     *   'standards/typescript/formatting',
     *   '---\ncreated_at: 2024-01-01T00:00:00.000Z\n---\nUse Prettier.'
     * );
     * ```
     *
     * @edgeCases
     * - Invalid slug paths return `INDEX_ERROR` without updating any indexes.
     * - If `createWhenMissing` is false, missing category indexes may prevent updates.
     */
    updateAfterMemoryWrite(
        memory: Memory,
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
// Registry Interface (New Abstraction)
// ============================================================================

/**
 * Error codes for registry operations.
 *
 * - `REGISTRY_MISSING` - Registry file does not exist at the expected path
 * - `REGISTRY_READ_FAILED` - Unable to read registry file (permissions, I/O error)
 * - `REGISTRY_WRITE_FAILED` - Unable to write registry file (permissions, disk full)
 * - `REGISTRY_PARSE_FAILED` - Registry file exists but contains invalid YAML/data
 */
export type RegistryErrorCode =
    | 'REGISTRY_MISSING'
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_WRITE_FAILED'
    | 'REGISTRY_PARSE_FAILED';

/**
 * Error details for registry operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the failing path or underlying cause.
 *
 * @example
 * ```typescript
 * const result = await registry.load();
 * if (!result.ok) {
 *   switch (result.error.code) {
 *     case 'REGISTRY_MISSING':
 *       console.log('Run "cortex init" to create a registry');
 *       break;
 *     case 'REGISTRY_PARSE_FAILED':
 *       console.log('Registry file is corrupted:', result.error.cause);
 *       break;
 *   }
 * }
 * ```
 */
export interface RegistryError {
    /** Machine-readable error code for programmatic handling */
    code: RegistryErrorCode;
    /** Human-readable error message describing what went wrong */
    message: string;
    /** Filesystem path to the registry file (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

/**
 * Error returned when a store is not found in the registry.
 *
 * This error is returned by {@link Registry.getStore} when the requested
 * store name does not exist in the loaded registry data.
 *
 * @example
 * ```typescript
 * const result = registry.getStore('nonexistent');
 * if (!result.ok && result.error.code === 'STORE_NOT_FOUND') {
 *   console.log(`Store '${result.error.store}' not found`);
 * }
 * ```
 */
export interface StoreNotFoundError {
    /** Error code, always `'STORE_NOT_FOUND'` for this error type */
    code: 'STORE_NOT_FOUND';
    /** Human-readable error message */
    message: string;
    /** The store name that was not found */
    store: string;
}

/**
 * Storage adapter scoped to a specific store.
 *
 * Provides access to memory, index, and category operations within a single
 * store's context. Does not include store/registry operations since those
 * are handled at the registry level.
 *
 * This interface is returned by {@link Registry.getStore} for performing
 * store-specific operations.
 *
 * @example
 * ```typescript
 * const adapter = registry.getStore('my-project');
 * if (adapter.ok) {
 *   // Read a memory
 *   const result = await adapter.value.memories.read('category/my-memory');
 *
 *   // Reindex the store
 *   await adapter.value.indexes.reindex();
 *
 *   // List categories
 *   const categories = await adapter.value.categories.list('');
 * }
 * ```
 */
export interface ScopedStorageAdapter {
    /** Memory file operations (read, write, remove, move) */
    memories: MemoryStorage;
    /** Index file operations and reindexing */
    indexes: IndexStorage;
    /** Category operations (list, create, delete) */
    categories: CategoryStorage;
}

/**
 * Factory function for creating scoped storage adapters.
 *
 * Used for dependency injection - production code uses the default
 * FilesystemStorageAdapter, tests can inject mock adapters.
 *
 * @param storePath - Absolute path to the store root directory
 * @returns A scoped storage adapter for the store
 */
export type AdapterFactory = (storePath: string) => ScopedStorageAdapter;

/**
 * Options for programmatic Cortex creation via Cortex.init().
 */
export interface CortexOptions {
    /** Path to the config directory (e.g., ~/.config/cortex) */
    rootDirectory: string;
    /** Settings override (merged with defaults) */
    settings?: Partial<CortexSettings>;
    /** Store definitions (default: empty) */
    registry?: RegistryData;
    /** Custom adapter factory for testing (default: filesystem) */
    adapterFactory?: AdapterFactory;
}

/**
 * Context object passed to CLI and MCP handlers.
 * Provides access to the root Cortex client.
 *
 * The Cortex type is imported from cortex module when available.
 * For now, use a forward reference pattern.
 */
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: {
        rootDirectory: string;
        settings: CortexSettings;
        registry: RegistryData;
        getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;
    };
}

/**
 * Registry service interface for managing store configurations.
 *
 * The registry is a central configuration file that maps store names to their
 * filesystem paths. Implementations cache loaded data internally, enabling
 * synchronous {@link getStore} calls after {@link load}.
 *
 * The registry serves as a factory for obtaining storage adapters scoped to
 * specific stores, ensuring each store's operations are isolated.
 *
 * **Typical usage pattern:**
 * 1. Call {@link initialize} once during first-time setup
 * 2. Call {@link load} to read and cache registry data
 * 3. Call {@link getStore} synchronously to get store-specific adapters
 * 4. Call {@link save} when registry changes (e.g., adding new stores)
 *
 * @example
 * ```typescript
 * // Setup and usage
 * const registry = new FilesystemRegistry('/path/to/stores.yaml');
 * await registry.load();
 *
 * const adapter = registry.getStore('my-project');
 * if (adapter.ok) {
 *   const content = await adapter.value.memories.read('category/memory');
 *   console.log(content.value);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // First-time initialization
 * const registry = new FilesystemRegistry('/path/to/stores.yaml');
 * await registry.initialize();  // Creates file if missing
 * const result = await registry.load();
 * if (result.ok) {
 *   console.log('Registered stores:', Object.keys(result.value));
 * }
 * ```
 */
export interface RegistryService {
    /**
     * First-time registry setup.
     *
     * Creates the registry file and any necessary parent directories.
     * Safe to call if registry already exists (no-op in that case).
     *
     * @returns Result with void on success, or {@link RegistryError} on failure
     *
     * @example
     * ```typescript
     * const result = await registry.initialize();
     * if (!result.ok) {
     *   console.error('Failed to initialize:', result.error.message);
     * }
     * ```
     */
    initialize(): Promise<Result<void, RegistryError>>;

    /**
     * Load registry data from storage and cache internally.
     *
     * Must be called before {@link getStore} can be used. Subsequent calls
     * refresh the internal cache, which is useful when the registry file
     * may have been modified externally.
     *
     * @returns Result with the parsed {@link StoreRegistry}, or {@link RegistryError} on failure
     *
     * @example
     * ```typescript
     * const result = await registry.load();
     * if (result.ok) {
     *   for (const [name, config] of Object.entries(result.value)) {
     *     console.log(`${name}: ${config.path}`);
     *   }
     * }
     * ```
     */
    load(): Promise<Result<StoreRegistry, RegistryError>>;

    /**
     * Persist registry data to storage.
     *
     * Writes the provided registry data and updates the internal cache.
     * Creates parent directories as needed.
     *
     * @param registry - The complete registry data to persist
     * @returns Result with void on success, or {@link RegistryError} on failure
     *
     * @example
     * ```typescript
     * // Add a new store to the registry
     * const current = await registry.load();
     * if (current.ok) {
     *   const updated = {
     *     ...current.value,
     *     'new-store': { path: '/path/to/store' }
     *   };
     *   await registry.save(updated);
     * }
     * ```
     */
    save(registry: StoreRegistry): Promise<Result<void, RegistryError>>;

    /**
     * Synchronous factory returning a storage adapter scoped to a specific store.
     *
     * Uses the cached registry data from the last {@link load} call.
     * Returns an error if the store is not found in the registry.
     *
     * @param name - The store name to get an adapter for
     * @returns Result with {@link ScopedStorageAdapter} on success, or {@link StoreNotFoundError} if not found
     * @throws Error if {@link load} has not been called
     *
     * @example
     * ```typescript
     * const adapter = registry.getStore('my-project');
     * if (adapter.ok) {
     *   const memory = await adapter.value.memories.read('notes/todo');
     * } else {
     *   console.error(`Store not found: ${adapter.error.store}`);
     * }
     * ```
     */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;
}
