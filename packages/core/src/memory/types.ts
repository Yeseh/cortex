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
 * optional expiration for automatic cleanup, and citations to
 * source material.
 *
 * @example
 * ```typescript
 * const metadata: MemoryMetadata = {
 *     createdAt: new Date('2024-01-01T00:00:00.000Z'),
 *     updatedAt: new Date('2024-01-01T00:00:00.000Z'),
 *     tags: ['architecture', 'decisions'],
 *     source: 'user',
 *     expiresAt: undefined,
 *     citations: ['docs/architecture.md', 'https://example.com/spec.html'],
 * };
 * ```
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
    /**
     * References to source material such as file paths, URLs, or document identifiers.
     *
     * Citations provide traceability for memory content by linking to the original
     * sources from which information was extracted. Each citation is a non-empty
     * string that can represent:
     * - Relative file paths (e.g., `"src/config.ts:42"`)
     * - Absolute file paths (e.g., `"/repo/docs/README.md"`)
     * - URLs (e.g., `"https://example.com/api-docs"`)
     * - Document identifiers (e.g., `"RFC-2119"`)
     *
     * An empty array indicates no citations are associated with the memory.
     *
     * @example
     * ```typescript
     * // Memory with multiple citation types
     * const citations = [
     *     'packages/core/src/memory/types.ts:15-30',
     *     'https://github.com/org/repo/blob/main/docs/spec.md',
     *     'ADR-0001: Memory System Design',
     * ];
     * ```
     */
    citations: string[];
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
 * - `INVALID_CITATIONS` - The citations field is not a valid string array (must be
 *   an array of non-empty strings when present)
 * - `MEMORY_NOT_FOUND` - The specified memory does not exist in the store
 * - `STORAGE_ERROR` - Underlying storage operation failed (filesystem, network, etc.)
 * - `INVALID_PATH` - Memory path is malformed or doesn't conform to the expected format
 * - `MEMORY_EXPIRED` - The requested memory exists but has passed its expiration date
 * - `INVALID_INPUT` - No updates provided, or invalid arguments
 * - `DESTINATION_EXISTS` - Move destination already exists
 *
 * @example
 * ```typescript
 * // Handling citation validation errors
 * if (result.error.code === 'INVALID_CITATIONS') {
 *     console.error('Citations must be an array of non-empty strings');
 * }
 * ```
 */
export type MemoryErrorCode =
    // Parsing/validation errors
    | 'MISSING_FRONTMATTER'
    | 'INVALID_FRONTMATTER'
    | 'MISSING_FIELD'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TAGS'
    | 'INVALID_SOURCE'
    | 'INVALID_CITATIONS'
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


