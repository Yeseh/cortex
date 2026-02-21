/**
 * Category module types and storage port interface.
 *
 * This module defines the core types for category operations including
 * error handling, operation results, and the storage port interface
 * that abstracts over different storage backends.
 *
 * @module core/category/types
 */

import type { ErrorDetails, Result } from '../result.ts';
import type { CategoryPath } from './category-path.ts';
import type { CategoryMode } from '../config/config.ts';
import type { ConfigCategories } from '@/config/types.ts';
import type { MemoryPath } from '@/memory/memory-path.ts';

/**
 * Context for category mode enforcement.
 *
 * When provided to category operations, enables mode-based
 * permission checks and config-defined category protection.
 *
 * @example
 * ```typescript
 * const modeContext: CategoryModeContext = {
 *     mode: 'subcategories',
 *     configCategories: {
 *         standards: { subcategories: { architecture: {} } },
 *         projects: {},
 *     },
 * };
 *
 * // In subcategories mode, new root categories are rejected
 * const result = await createCategory(storage, 'legacy/notes', modeContext);
 * // Returns error: ROOT_CATEGORY_NOT_ALLOWED
 * ```
 */
export interface CategoryModeContext {
    /** Category creation/deletion mode */
    mode: CategoryMode;
    /** Config-defined category hierarchy (for protection checks) */
    configCategories?: ConfigCategories;
}

/**
 * Error codes for category operations.
 *
 * These codes enable programmatic error handling by consumers:
 * - `CATEGORY_NOT_FOUND` - The specified category does not exist
 * - `ROOT_CATEGORY_REJECTED` - Operation not allowed on root categories (e.g., delete, set description)
 * - `DESCRIPTION_TOO_LONG` - Description exceeds {@link MAX_DESCRIPTION_LENGTH} characters
 * - `STORAGE_ERROR` - Underlying storage operation failed (filesystem, network, etc.)
 * - `INVALID_PATH` - Category path is malformed or empty
 * - `CATEGORY_PROTECTED` - Operation rejected on config-defined category
 * - `ROOT_CATEGORY_NOT_ALLOWED` - New root category rejected in subcategories mode
 */
export type CategoryErrorCode =
    | 'CATEGORY_NOT_FOUND'
    | 'ROOT_CATEGORY_REJECTED'
    | 'DESCRIPTION_TOO_LONG'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH'
    | 'CATEGORY_PROTECTED'
    | 'ROOT_CATEGORY_NOT_ALLOWED';

/**
 * Error details for category operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the failing path or underlying cause.
 */
export type CategoryError = ErrorDetails<CategoryErrorCode>;
export type CategoryResult<T> = Result<T, CategoryError>;

/**
 * Result of the createCategory operation.
 *
 * Indicates whether the category was newly created or already existed.
 * The operation is idempotent - creating an existing category succeeds
 * with `created: false`.
 */
export interface CreateCategoryResult {
    /** The normalized category path */
    path: string;
    /** True if the category was newly created, false if it already existed */
    created: boolean;
}

/**
 * Result of the setDescription operation.
 *
 * Contains the final description value after normalization.
 * Empty strings are normalized to null (description cleared).
 */
export interface SetDescriptionResult {
    /** The category path that was updated */
    path: string;
    /** The description value (null if cleared or empty) */
    description: string | null;
}

/**
 * Result of the deleteCategory operation.
 *
 * Confirms deletion of a category and all its contents.
 * Unlike create, delete is NOT idempotent - deleting a non-existent
 * category returns an error.
 */
export interface DeleteCategoryResult {
    /** The category path that was deleted */
    path: string;
    /** True if the category was successfully deleted */
    deleted: boolean;
}

/**
 * Maximum description length in characters.
 *
 * Set to 500 characters to balance between providing meaningful context
 * and keeping index files manageable. Descriptions appear in parent
 * category indexes and are displayed in listing operations, so shorter
 * descriptions improve readability and reduce token usage when AI agents
 * browse the category hierarchy.
 */
export const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Entry for a subcategory within a category.
 *
 * Subcategories are nested category directories. Each entry tracks
 * the total memory count for efficient hierarchy browsing without
 * recursively scanning the filesystem.
 *
 * @example
 * ```typescript
 * const entry: SubcategoryEntry = {
 *   path: CategoryPath.fromString('project/cortex').unwrap(),
 *   memoryCount: 5,
 *   description: 'Cortex memory system project knowledge'
 * };
 * ```
 *
 * @edgeCases
 * - `memoryCount` reflects direct memories in the subcategory, not recursive totals.
 */
export type SubcategoryEntry = {
    /** Full path to the subcategory (e.g., "project/cortex") */
    path: CategoryPath;
    /** Total number of memories in this subcategory */
    memoryCount: number;
    /** Optional description (max 500 chars) for the subcategory */
    description?: string;
};

export type CategoryMemoryEntry = {
    /** Full path to the memory (e.g., "project/cortex/notes/memory1") */
    path: MemoryPath;
    /** Estimated token count for the memory content */
    tokenEstimate: number;
    /** When the memory was last updated (optional for backward compatibility) */
    updatedAt?: Date;
};

/**
 * Complete structure for a category's contents.
 *
 * Each category directory contains an `index.yaml` file with this
 * structure, listing all direct memories and subcategories. Storage
 * adapters handle YAML serialization using snake_case fields such as
 * `token_estimate`, `memory_count`, and optional `updated_at`.
 * The index is maintained automatically when memories are written or
 * deleted, and can be rebuilt via the `reindex` command.
 *
 * @example
 * ```typescript
 * const category: Category = {
 *   memories: [
 *     { path: memPath('project/tech-stack'), tokenEstimate: 150 },
 *     { path: memPath('project/conventions'), tokenEstimate: 200 }
 *   ],
 *   subcategories: [
 *     { path: catPath('project/cortex'), memoryCount: 5 }
 *   ]
 * };
 * ```
 *
 * @edgeCases
 * - Empty categories are represented with `{ memories: [], subcategories: [] }`.
 */
export interface Category {
    /** List of memory entries in this category */
    memories: CategoryMemoryEntry[];
    /** List of subcategory entries in this category */
    subcategories: SubcategoryEntry[];
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
