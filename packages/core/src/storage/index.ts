/**
 * Storage adapter interfaces for memory persistence.
 *
 * This module defines focused, single-responsibility storage interfaces
 * following the Interface Segregation Principle (ISP). Each interface
 * handles a specific concern:
 *
 * - {@link MemoryAdapter} - Raw memory file operations
 * - {@link IndexAdapter} - Index file operations and reindexing
 * - {@link StoreAdapter} - Store metadata persistence
 * - {@link CategoryStorage} - Category operations
 *
 * @module core/storage/adapter
 */

import type { ErrorDetails, Result } from '@/result.ts';
import type { StoreAdapter } from './store-adapter.ts';
import type { IndexAdapter, ReindexResult } from './index-adapter.ts';
import type { MemoryAdapter } from './memory-adapter.ts';
import type { CategoryAdapter } from './category-adapter.ts';
import type { ConfigAdapter } from './config-adapter.ts';

// Type aliases for backward compatibility and clearer naming
export type MemoryStorage = MemoryAdapter;
export type IndexStorage = IndexAdapter;
export type CategoryStorage = CategoryAdapter;

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
 * store's context, plus store configuration operations.
 *
 * @example
 * ```typescript
 * // Read a memory
 * const memory = await adapter.memories.read('category/my-memory');
 *
 * // Reindex the store
 * await adapter.indexes.reindex();
 *
 * // List categories
 * const categories = await adapter.categories.list('');
 * ```
 */
export interface StorageAdapter {
    /** Memory file operations (read, write, remove, move) */
    memories: MemoryAdapter;
    /** Index file operations and reindexing */
    indexes: IndexAdapter;
    /** Category operations (list, create, delete) */
    categories: CategoryAdapter;
    /** Store configuration operations */
    config: ConfigAdapter;
}

export {
    type MemoryAdapter,
    type CategoryAdapter,
    type IndexAdapter,
    type StoreAdapter,
    type ReindexResult,
    type ConfigAdapter,
};
