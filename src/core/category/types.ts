/**
 * Category module types and storage port interface.
 *
 * This module defines the core types for category operations including
 * error handling, operation results, and the storage port interface
 * that abstracts over different storage backends.
 *
 * @module core/category/types
 */

import type { Result } from '../types.ts';
import type { CategoryIndex } from '../index/types.ts';

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
 * const result = await port.categoryExists('project/cortex');
 * if (result.ok && !result.value) {
 *   await port.ensureCategoryDirectory('project/cortex');
 *   await port.writeCategoryIndex('project/cortex', { memories: [], subcategories: [] });
 * }
 * ```
 */
export interface CategoryStoragePort {
    /**
     * Checks if a category exists at the given path.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result with true if category exists, false otherwise
     */
    categoryExists(path: string): Promise<Result<boolean, CategoryError>>;

    /**
     * Reads the index file for a category.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result with the parsed CategoryIndex or null if not found
     */
    readCategoryIndex(path: string): Promise<Result<CategoryIndex | null, CategoryError>>;

    /**
     * Writes or overwrites a category index file.
     *
     * Creates parent directories if needed.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @param index - The CategoryIndex to write
     * @returns Result indicating success or failure
     */
    writeCategoryIndex(path: string, index: CategoryIndex): Promise<Result<void, CategoryError>>;

    /**
     * Ensures a category directory exists, creating it if missing.
     *
     * This is a mkdir-like operation that creates the directory
     * structure without initializing any index files.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result indicating success or failure
     */
    ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>>;

    /**
     * Deletes a category directory and all its contents recursively.
     *
     * This is a destructive operation that removes all memories
     * and subcategories within the target path.
     *
     * @param path - Category path to delete (e.g., "project/cortex")
     * @returns Result indicating success or failure
     */
    deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>>;

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
     */
    updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
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
     */
    removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>>;
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
