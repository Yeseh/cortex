/**
 * Storage adapter interface for memory persistence
 */

import type { MemorySlugPath, Result } from '../types.ts';

export type StorageIndexName = string;

export type StorageAdapterErrorCode = 'READ_FAILED' | 'WRITE_FAILED' | 'INDEX_UPDATE_FAILED';

export interface StorageAdapterError {
    code: StorageAdapterErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

export interface StorageAdapter {
    /**
     * Returns ok(null) when the memory file is missing.
     */
    readMemoryFile(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>>;
    writeMemoryFile(
        slugPath: MemorySlugPath,
        contents: string,
        options?: { allowIndexCreate?: boolean; allowIndexUpdate?: boolean }
    ): Promise<Result<void, StorageAdapterError>>;
    removeMemoryFile(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>>;
    moveMemoryFile(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>>;
    /**
     * Returns ok(null) when the index file is missing.
     */
    readIndexFile(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>>;
    writeIndexFile(
        name: StorageIndexName,
        contents: string
    ): Promise<Result<void, StorageAdapterError>>;
    reindexCategoryIndexes(): Promise<Result<void, StorageAdapterError>>;
}
