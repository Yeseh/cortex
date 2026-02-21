/**
 * Storage adapter interfaces for memory persistence.
 *
 * This module defines focused, single-responsibility storage interfaces
 * following the Interface Segregation Principle (ISP). Each interface
 * handles a specific concern:
 *
 * - {@link IndexAdapter} - Raw memory file operations
 * - {@link IndexAdapter} - Index file operations and reindexing
 * - {@link StoreAdapter} - Store registry persistence
 * - {@link CategoryStorage} - Category operations (imported from category/types)
 *
 * @module core/storage/adapter
 */

import type { ErrorDetails, Result } from '@/result.ts';
import type { StoreAdapter } from './store-adapter.ts';
import type { IndexAdapter, ReindexResult } from './index-adapter.ts';
import type { MemoryAdapter } from './memory-adapter.ts';
import type { CategoryAdapter } from './category-adapter.ts';
import type { ConfigAdapter } from './config-adapter.ts';

/**
 * Error codes for storage adapter operations.
 *
 * - `IO_READ_ERROR` - Unable to read from storage
 * - `IO_WRITE_ERROR` - Unable to write to storage
 * - `INDEX_ERROR` - Index operation failed
 */
export type StorageAdapterErrorCode = 
    'IO_READ_ERROR' 
    | 'IO_WRITE_ERROR' 
    | 'INDEX_ERROR';

export type StorageAdapterError = ErrorDetails<StorageAdapterErrorCode>;
export type StorageAdapterResult<T> = Result<T, StorageAdapterError>;


// ============================================================================
// Focused Storage Interfaces (ISP)
// ============================================================================

/**
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
export interface StorageAdapter {
    /** Memory file operations (read, write, remove, move) */
    memories: MemoryAdapter;
    /** Index file operations and reindexing */
    indexes: IndexAdapter;
    /** Category operations (list, create, delete) */
    categories: CategoryAdapter;
    /** Store operations */
    stores: StoreAdapter;
    /** Configuration operations */
    config: ConfigAdapter
}

export {
    type MemoryAdapter,
    type CategoryAdapter,
    type IndexAdapter,
    type StoreAdapter,
    type ReindexResult,
};

export {
    type RegistryAdapter,
    type RegistryError,
    type RegistryResult,
} from './registry-adapter.ts';
