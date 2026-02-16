/**
 * Filesystem storage adapter types
 *
 * This module defines filesystem-specific types and error codes
 * for the storage adapter implementation.
 *
 * @module core/storage/filesystem/types
 */

import type { Dirent } from 'node:fs';
import type { Result } from '@yeseh/cortex-core';
import type { StorageAdapterError } from '@yeseh/cortex-core/storage';

/**
 * Configuration options for the filesystem storage adapter.
 */
export interface FilesystemStorageAdapterOptions {
    /** Root directory path for the storage */
    rootDirectory: string;
    /** File extension for memory files (default: '.md') */
    memoryExtension?: string;
    /** File extension for index files (default: '.yaml') */
    indexExtension?: string;
}

/**
 * Internal context for filesystem operations.
 *
 * This is passed between internal modules to share common
 * configuration and state.
 */
export interface FilesystemContext {
    /** Resolved absolute path to the storage root */
    storeRoot: string;
    /** Normalized memory file extension (with leading dot) */
    memoryExtension: string;
    /** Normalized index file extension (with leading dot) */
    indexExtension: string;
}

/**
 * Result types for directory entries.
 */
export type DirEntriesResult = Result<Dirent<string | Buffer>[], StorageAdapterError>;

/**
 * Result type for string or null values.
 */
export type StringOrNullResult = Result<string | null, StorageAdapterError>;

export type FileWithMetadata<TMeta> = {
    metadata: TMeta;
    content: string;
};
