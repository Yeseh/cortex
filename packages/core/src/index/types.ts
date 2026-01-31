/**
 * Index types for category indexes.
 *
 * This module defines the data structures for category index files,
 * which track memories and subcategories within each category directory.
 * Index files enable efficient listing operations without scanning
 * the filesystem.
 *
 * @module core/index/types
 */

/**
 * Entry for a memory within a category index.
 *
 * Each memory file in a category is tracked with its path and
 * estimated token count. The token estimate helps AI agents
 * decide which memories to load based on context window limits.
 *
 * @example
 * ```typescript
 * const entry: IndexMemoryEntry = {
 *   path: 'project/cortex/tech-stack',
 *   tokenEstimate: 150,
 *   summary: 'TypeScript project using Bun runtime'
 * };
 * ```
 */
export interface IndexMemoryEntry {
    /** Full path to the memory (e.g., "project/cortex/conventions") */
    path: string;
    /** Estimated token count for the memory content */
    tokenEstimate: number;
    /** Optional brief summary of memory contents (for listing displays) */
    summary?: string;
}

/**
 * Entry for a subcategory within a category index.
 *
 * Subcategories are nested category directories. Each entry tracks
 * the total memory count for efficient hierarchy browsing without
 * recursively scanning the filesystem.
 *
 * @example
 * ```typescript
 * const entry: IndexSubcategoryEntry = {
 *   path: 'project/cortex',
 *   memoryCount: 5,
 *   description: 'Cortex memory system project knowledge'
 * };
 * ```
 */
export interface IndexSubcategoryEntry {
    /** Full path to the subcategory (e.g., "project/cortex") */
    path: string;
    /** Total number of memories in this subcategory */
    memoryCount: number;
    /** Optional description (max 500 chars) for the subcategory */
    description?: string;
}

/**
 * Complete index structure for a category directory.
 *
 * Each category directory contains an `index.yaml` file with this
 * structure, listing all direct memories and subcategories. The
 * index is maintained automatically when memories are written or
 * deleted, and can be rebuilt via the `reindex` command.
 *
 * @example
 * ```typescript
 * const index: CategoryIndex = {
 *   memories: [
 *     { path: 'project/tech-stack', tokenEstimate: 150 },
 *     { path: 'project/conventions', tokenEstimate: 200 }
 *   ],
 *   subcategories: [
 *     { path: 'project/cortex', memoryCount: 5 }
 *   ]
 * };
 * ```
 */
export interface CategoryIndex {
    /** List of memory entries in this category */
    memories: IndexMemoryEntry[];
    /** List of subcategory entries in this category */
    subcategories: IndexSubcategoryEntry[];
}

/**
 * Error codes for index parsing failures.
 *
 * These codes enable programmatic error handling:
 * - `INVALID_FORMAT` - The index file structure is malformed (not valid YAML-like format)
 * - `INVALID_SECTION` - Entry appears outside a valid section (memories/subcategories)
 * - `INVALID_ENTRY` - Entry has invalid structure or unexpected fields
 * - `MISSING_FIELD` - Required field (path, token_estimate, memory_count) is missing
 * - `INVALID_NUMBER` - Numeric field (token_estimate, memory_count) has invalid value
 */
export type IndexParseErrorCode =
    | 'INVALID_FORMAT'
    | 'INVALID_SECTION'
    | 'INVALID_ENTRY'
    | 'MISSING_FIELD'
    | 'INVALID_NUMBER';

/**
 * Error details for index parsing failures.
 *
 * Provides structured error information including the error code,
 * human-readable message, and optional context about the failing
 * line or field.
 */
export interface IndexParseError {
    /** Machine-readable error code for programmatic handling */
    code: IndexParseErrorCode;
    /** Human-readable error message */
    message: string;
    /** Line number where the error occurred (1-based) */
    line?: number;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

/**
 * Error codes for index serialization failures.
 *
 * These codes enable programmatic error handling:
 * - `INVALID_ENTRY` - Entry has missing or empty required fields (path)
 * - `INVALID_NUMBER` - Numeric field is not a valid finite non-negative number
 */
export type IndexSerializeErrorCode = 'INVALID_ENTRY' | 'INVALID_NUMBER';

/**
 * Error details for index serialization failures.
 *
 * Provides structured error information for failures during
 * index-to-string conversion.
 */
export interface IndexSerializeError {
    /** Machine-readable error code for programmatic handling */
    code: IndexSerializeErrorCode;
    /** Human-readable error message */
    message: string;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

/**
 * Standard filename for category index files.
 *
 * Each category directory contains an index file with this name,
 * storing the {@link CategoryIndex} structure in YAML format.
 */
export const INDEX_FILE_NAME = 'index.yaml';
