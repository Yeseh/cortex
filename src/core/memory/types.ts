/**
 * Memory module types.
 *
 * This module defines the core types for memory operations including
 * metadata, content structures, and error handling. These types are
 * storage-agnostic and can be used with any storage backend implementation.
 *
 * @module core/memory/types
 */

/**
 * Metadata associated with a memory entry.
 *
 * Contains timestamps, categorization tags, source information,
 * and optional expiration for automatic cleanup.
 */
export type MemoryMetadata = {
    /** When the memory was created */
    createdAt: Date;
    /** When the memory was last updated */
    updatedAt: Date;
    /** Tags for categorization and discovery */
    tags: string[];
    /** Source of the memory (e.g., "user", "system", "mcp") */
    source: string;
    /** Optional expiration timestamp for automatic cleanup */
    expiresAt?: Date;
};

/**
 * A memory entry combining metadata and content.
 *
 * Represents a single piece of stored knowledge with its
 * associated metadata for tracking and organization.
 */
export type Memory = {
    /** Metadata associated with this memory */
    metadata: MemoryMetadata;
    /** The memory content as a string */
    content: string;
};

/**
 * Error codes for memory parsing and validation operations.
 *
 * These codes enable programmatic error handling by consumers:
 * - `MISSING_FRONTMATTER` - The memory file lacks required YAML frontmatter
 * - `INVALID_FRONTMATTER` - The frontmatter YAML is malformed or unparseable
 * - `MISSING_FIELD` - A required field is missing from the frontmatter
 * - `INVALID_TIMESTAMP` - A timestamp field contains an invalid date value
 * - `INVALID_TAGS` - The tags field is not a valid string array
 * - `INVALID_SOURCE` - The source field is missing or not a string
 * - `MEMORY_NOT_FOUND` - The specified memory does not exist in the store
 * - `STORAGE_ERROR` - Underlying storage operation failed (filesystem, network, etc.)
 * - `INVALID_PATH` - Memory path is malformed or doesn't conform to the expected format
 * - `MEMORY_EXPIRED` - The requested memory exists but has passed its expiration date
 * - `INVALID_INPUT` - No updates provided, or invalid arguments
 * - `DESTINATION_EXISTS` - Move destination already exists
 */
export type MemoryErrorCode =
    // Parsing/validation errors
    | 'MISSING_FRONTMATTER'
    | 'INVALID_FRONTMATTER'
    | 'MISSING_FIELD'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TAGS'
    | 'INVALID_SOURCE'
    // Operational errors
    | 'MEMORY_NOT_FOUND'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH'
    | 'MEMORY_EXPIRED'
    | 'INVALID_INPUT'
    | 'DESTINATION_EXISTS';

/**
 * Error details for memory parsing and validation operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the specific field or line that caused the error.
 */
export type MemoryError = {
    /** Machine-readable error code for programmatic handling */
    code: MemoryErrorCode;
    /** Human-readable error message */
    message: string;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Line number where the error occurred (for parse errors) */
    line?: number;
    /** Memory path that caused the error (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
};


