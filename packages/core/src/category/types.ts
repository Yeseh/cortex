/**
 * Category module types and storage port interface.
 *
 * This module defines the core types for category operations including
 * error handling, operation results, and the storage port interface
 * that abstracts over different storage backends.
 *
 * @module core/category/types
 */

import type { Result } from '../result.ts';
import type { CategoryPath } from './category-path.ts';
import type { MemoryPath } from '@/memory/memory-path.ts';

/**
 * Error codes for category operations.
 *
 * These codes enable programmatic error handling by consumers:
 * - `CATEGORY_NOT_FOUND` - The specified category does not exist
 * - `ROOT_CATEGORY_REJECTED` - Operation not allowed on root categories (e.g., delete, set description)
 * - `DESCRIPTION_TOO_LONG` - Description exceeds {@link MAX_DESCRIPTION_LENGTH} characters
 * - `STORAGE_ERROR` - Underlying storage operation failed (filesystem, network, etc.)
 * - `INVALID_PATH` - Category path is malformed or empty
 */
export type CategoryErrorCode =
    | 'CATEGORY_NOT_FOUND'
    | 'ROOT_CATEGORY_REJECTED'
    | 'DESCRIPTION_TOO_LONG'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH';

/**
 * Error details for category operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the failing path or underlying cause.
 */
export interface CategoryError {
    /** Machine-readable error code for programmatic handling */
    code: CategoryErrorCode;
    /** Human-readable error message */
    message: string;
    /** Category path that caused the error (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

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
 * Abstract storage port for category operations.
 *
 * This interface defines the contract between category business logic
 * and storage implementations. It follows the ports and adapters pattern
 * to decouple core logic from infrastructure concerns.
 *
 * Implementations:
 * - {@link FilesystemStorageAdapter} - File-based storage for production
 * - In-memory adapters for testing
 *
 * All methods return Result types for explicit error handling without exceptions.
 *
 * @example
 * ```typescript
 * // Creating a category using the port
 * const result = await port.exists('project/cortex');
 * if (result.ok && !result.value) {
 *   await port.ensure('project/cortex');
 * }
 * ```
 */
export interface CategoryStorage {
    /**
     * Checks if a category exists at the given path.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result with true if category exists, false otherwise
     */
    exists(path: CategoryPath): Promise<Result<boolean, CategoryError>>;

    /**
     * Ensures a category directory exists, creating it if missing.
     *
     * This is a mkdir-like operation that creates the directory
     * structure without initializing any index files.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.ensure('project/cortex/docs');
     * ```
     *
     * @edgeCases
     * - Calling with an existing path is a no-op and should succeed.
     * - Returns `INVALID_PATH` when the path is empty or malformed.
     */
    ensure(path: CategoryPath): Promise<Result<void, CategoryError>>;

    /**
     * Deletes a category directory and all its contents recursively.
     *
     * This is a destructive operation that removes all memories
     * and subcategories within the target path.
     *
     * @param path - Category path to delete (e.g., "project/cortex")
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.delete('project/cortex/old');
     * ```
     *
     * @edgeCases
     * - Some implementations treat missing directories as a no-op success.
     * - Returns `INVALID_PATH` when the path is empty or malformed.
     */
    delete(path: CategoryPath): Promise<Result<void, CategoryError>>;

    /**
     * Updates the description of a subcategory in its parent's index.
     *
     * The description is stored in the parent category's index file
     * to enable efficient listing without reading each subcategory.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory
     * @param description - New description or null to clear
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.updateSubcategoryDescription(
     *   'project/cortex',
     *   'project/cortex/docs',
     *   'Project documentation'
     * );
     * ```
     *
     * @edgeCases
     * - Passing `''` as `parentPath` updates the root index.
     * - Passing `null` clears the description field for the subcategory.
     */
    updateSubcategoryDescription(
        categoryPath: CategoryPath,
        description: string | null
    ): Promise<Result<void, CategoryError>>;

    /**
     * Removes a subcategory entry from its parent's index.
     *
     * Called after deleting a category to clean up the parent's
     * subcategories list.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory to remove
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.removeSubcategoryEntry('project/cortex', 'project/cortex/old-docs');
     * ```
     *
     * @edgeCases
     * - Passing `''` as `parentPath` removes a top-level entry from the root index.
     * - If the parent index is missing, implementations may return success.
     */
    removeSubcategoryEntry(categoryPath: CategoryPath): Promise<Result<void, CategoryError>>;
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
 * Protected root memory categories.
 *
 * These categories have special protection:
 * - Cannot be deleted via the category delete operation
 *
 * NOTE: This list is NOT used for traversal operations (list, prune).
 * Those operations discover root categories dynamically by reading the
 * store's root index, allowing stores to have any root-level categories.
 */
export const ROOT_CATEGORIES = [
    'human', 'persona',
] as const;

/** Type for root category names */
export type RootCategory = (typeof ROOT_CATEGORIES)[number];

/**
 * Entry for a memory within a category.
 *
 * Each memory file in a category is tracked with its path and
 * estimated token count. The token estimate helps AI agents
 * decide which memories to load based on context window limits.
 *
 * @example
 * ```typescript
 * const entry: CategoryMemoryEntry = {
 *   path: MemoryPath.fromString('project/cortex/tech-stack').unwrap(),
 *   tokenEstimate: 150,
 *   summary: 'TypeScript project using Bun runtime'
 * };
 * ```
 *
 * @edgeCases
 * - `updatedAt` may be undefined when the memory frontmatter is missing or invalid.
 */
export interface CategoryMemoryEntry {
    /** Full path to the memory (e.g., "project/cortex/conventions") */
    path: MemoryPath;
    /** Estimated token count for the memory content */
    tokenEstimate: number;
    /** Optional brief summary of memory contents (for listing displays) */
    summary?: string;
    /** Optional last updated timestamp for sorting by recency */
    updatedAt?: Date;
}

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
export interface SubcategoryEntry {
    /** Full path to the subcategory (e.g., "project/cortex") */
    path: CategoryPath;
    /** Total number of memories in this subcategory */
    memoryCount: number;
    /** Optional description (max 500 chars) for the subcategory */
    description?: string;
}

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
