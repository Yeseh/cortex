import type { CategoryPath } from "@/category";
import type { CategoryResult } from "@/category/types";

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
export interface CategoryAdapter {
    /**
     * Checks if a category exists at the given path.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result with true if category exists, false otherwise
     */
    exists(path: CategoryPath): Promise<CategoryResult<boolean>>;

    /**
     * Ensures a category exists, creating it if missing.
     * If allowed, parent categories will also be created as needed.
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
    ensure(path: CategoryPath): Promise<CategoryResult<void>>;

    /**
     * Deletes a category and all its contents recursively.
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
     * - Some implementations treat missing categories as a no-op success.
     * - Returns `INVALID_PATH` when the path is empty or malformed.
     */
    delete(path: CategoryPath): Promise<CategoryResult<void>>;

    /**
     * Updates the description of a category 
     *
     * @param categoryPath - Path to the category
     * @param description - New description or null to clear
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.setDescription(
     *   'project/cortex/docs',
     *   'Project documentation'
     * );
     * ```
     *
     * @edgeCases
     * - Passing `null` clears the description field for the subcategory.
     */
    setDescription(categoryPath: CategoryPath, description: string | null
    ): Promise<CategoryResult<void>>;
}
