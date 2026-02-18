/**
 * CategoryClient - Fluent API for category operations.
 *
 * Provides a client interface for navigating category hierarchies and
 * performing operations. Navigation methods are synchronous with lazy
 * validation - invalid paths only error on first async operation.
 *
 * @module core/cortex/category-client
 */

import { ok, err, type Result } from '@/result.ts';
import type { ScopedStorageAdapter, ReindexResult } from '@/storage/adapter.ts';
import { CategoryPath } from '@/category/category-path.ts';
import type {
    CategoryError,
    CreateCategoryResult,
    DeleteCategoryResult,
    SetDescriptionResult,
    CategoryMemoryEntry,
    SubcategoryEntry,
} from '@/category/types.ts';
import { createCategory, deleteCategory, setDescription } from '@/category/operations/index.ts';
import type { PruneOptions, PruneResult } from '@/memory/operations/prune.ts';
import { pruneExpiredMemories } from '@/memory/operations/prune.ts';

/**
 * Client for category navigation and operations.
 *
 * Provides fluent API for navigating category hierarchies and performing
 * operations. Navigation methods are synchronous with lazy validation -
 * invalid paths only error on first async operation.
 *
 * @example
 * ```typescript
 * const root = cortex.getStore('my-store').value.rootCategory();
 * const standards = root.getCategory('standards');
 * const typescript = standards.getCategory('typescript');
 *
 * // Lazy validation - errors on first async call
 * const result = await typescript.exists();
 * ```
 *
 * @example
 * ```typescript
 * // Create a category hierarchy
 * const docs = root.getCategory('docs/api/v2');
 * const createResult = await docs.create();
 * if (createResult.ok()) {
 *     console.log('Created:', createResult.value.path);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Navigate and list contents
 * const category = root.getCategory('standards');
 * const memoriesResult = await category.listMemories();
 * if (memoriesResult.ok()) {
 *     for (const memory of memoriesResult.value) {
 *         console.log(memory.path.toString());
 *     }
 * }
 * ```
 */
export class CategoryClient {
    /** Canonical path with leading slash (e.g., "/standards/javascript") */
    readonly rawPath: string;

    /** Storage adapter for this category's store */
    private readonly adapter: ScopedStorageAdapter;

    /**
     * Creates a new CategoryClient instance.
     *
     * @param rawPath - The category path (normalized to canonical format)
     * @param adapter - The storage adapter for performing operations
     *
     * @example
     * ```typescript
     * // Usually created via StoreClient.rootCategory() or CategoryClient.getCategory()
     * const client = new CategoryClient('/standards/typescript', adapter);
     * ```
     */
    constructor(rawPath: string, adapter: ScopedStorageAdapter) {
        this.rawPath = CategoryClient.normalizePath(rawPath);
        this.adapter = adapter;
    }

    /**
     * Normalize a path to canonical format.
     *
     * Ensures paths are in a consistent format:
     * - Add leading slash if missing
     * - Remove trailing slash (except for root)
     * - Collapse multiple slashes to single slash
     *
     * @param path - The path to normalize
     * @returns The normalized canonical path
     *
     * @example
     * ```typescript
     * CategoryClient.normalizePath('standards/') // => '/standards'
     * CategoryClient.normalizePath('//foo//bar') // => '/foo/bar'
     * CategoryClient.normalizePath('')           // => '/'
     * CategoryClient.normalizePath('/')          // => '/'
     * ```
     */
    private static normalizePath(path: string): string {
        // Handle empty or whitespace-only input as root
        if (!path || path.trim() === '') {
            return '/';
        }

        // Collapse multiple slashes to single slash
        let normalized = path.replace(/\/+/g, '/');

        // Ensure leading slash
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }

        // Remove trailing slash (except for root)
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }

        return normalized;
    }

    /**
     * Parse the raw path into a CategoryPath value object.
     *
     * Converts the canonical rawPath (with leading slash) to a CategoryPath
     * that can be used with storage operations. Root path "/" parses to
     * CategoryPath.root().
     *
     * @returns Result with CategoryPath on success, or CategoryError if invalid
     *
     * @example
     * ```typescript
     * const client = new CategoryClient('/standards/typescript', adapter);
     * const pathResult = client.parsePath();
     * if (pathResult.ok()) {
     *     console.log(pathResult.value.toString()); // 'standards/typescript'
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Root path returns CategoryPath.root()
     * const root = new CategoryClient('/', adapter);
     * const pathResult = root.parsePath();
     * if (pathResult.ok()) {
     *     console.log(pathResult.value.isRoot); // true
     * }
     * ```
     */
    parsePath(): Result<CategoryPath, CategoryError> {
        // Root path maps to CategoryPath.root()
        if (this.rawPath === '/') {
            return ok(CategoryPath.root());
        }

        // Remove leading slash for CategoryPath.fromString()
        const pathWithoutLeadingSlash = this.rawPath.slice(1);
        const parseResult = CategoryPath.fromString(pathWithoutLeadingSlash);

        if (!parseResult.ok()) {
            return err({
                code: 'INVALID_PATH',
                message: `Invalid category path: ${this.rawPath}`,
                path: this.rawPath,
                cause: parseResult.error,
            });
        }

        return ok(parseResult.value);
    }

    // =========================================================================
    // Navigation Methods (synchronous, lazy validation)
    // =========================================================================

    /**
     * Get a subcategory client by relative path.
     *
     * Creates a new CategoryClient for a subcategory. The path is treated
     * as relative to the current category, regardless of whether it starts
     * with a slash. This is a synchronous operation - path validation
     * happens lazily on first async call.
     *
     * @param path - Relative path to the subcategory (e.g., "typescript" or "api/v2")
     * @returns A new CategoryClient for the subcategory
     *
     * @example
     * ```typescript
     * const standards = root.getCategory('standards');
     * const typescript = standards.getCategory('typescript');
     * console.log(typescript.rawPath); // '/standards/typescript'
     * ```
     *
     * @example
     * ```typescript
     * // Both are treated as relative paths
     * root.getCategory('foo').rawPath;  // '/foo'
     * root.getCategory('/foo').rawPath; // '/foo' (leading slash stripped)
     * ```
     *
     * @example
     * ```typescript
     * // Deep relative paths work
     * const deep = root.getCategory('a/b/c');
     * console.log(deep.rawPath); // '/a/b/c'
     * ```
     */
    getCategory(path: string): CategoryClient {
        // Strip leading slashes to treat as relative
        const relativePath = path.replace(/^\/+/, '');

        // Handle empty relative path (return equivalent instance)
        if (!relativePath || relativePath.trim() === '') {
            return new CategoryClient(this.rawPath, this.adapter);
        }

        // Concatenate with current path
        const newPath = this.rawPath === '/'
            ? '/' + relativePath
            : this.rawPath + '/' + relativePath;

        return new CategoryClient(newPath, this.adapter);
    }

    /**
     * Get a memory client by slug.
     *
     * Returns a client for interacting with a memory in this category.
     * This is a placeholder implementation that will be replaced when
     * MemoryClient is implemented.
     *
     * @param slug - The memory slug within this category
     * @returns Result with error indicating not implemented yet
     *
     * @example
     * ```typescript
     * const memory = category.getMemory('architecture');
     * // Currently returns NOT_IMPLEMENTED error
     * ```
     */
    getMemory(_slug: string): Result<never, CategoryError> {
        return err({
            code: 'NOT_IMPLEMENTED',
            message: 'getMemory() is not implemented yet. MemoryClient will be added in a future change.',
            path: this.rawPath,
        });
    }

    /**
     * Get the parent category client.
     *
     * Returns a CategoryClient for the parent category, or null if this
     * is the root category. This is a synchronous operation.
     *
     * @returns Parent CategoryClient, or null if this is the root category
     *
     * @example
     * ```typescript
     * const typescript = root.getCategory('standards/typescript');
     * const parent = typescript.parent();
     * console.log(parent?.rawPath); // '/standards'
     *
     * const grandparent = parent?.parent();
     * console.log(grandparent?.rawPath); // '/'
     *
     * const greatGrandparent = grandparent?.parent();
     * console.log(greatGrandparent); // null
     * ```
     */
    parent(): CategoryClient | null {
        // Root has no parent
        if (this.rawPath === '/') {
            return null;
        }

        // Find the last slash to get parent path
        const lastSlashIndex = this.rawPath.lastIndexOf('/');

        // If the only slash is at position 0, parent is root
        if (lastSlashIndex === 0) {
            return new CategoryClient('/', this.adapter);
        }

        // Otherwise, parent is everything before the last slash
        const parentPath = this.rawPath.slice(0, lastSlashIndex);
        return new CategoryClient(parentPath, this.adapter);
    }

    // =========================================================================
    // Lifecycle Methods (async)
    // =========================================================================

    /**
     * Create this category and its parent hierarchy.
     *
     * Idempotent operation - succeeds if category already exists with
     * `created: false`. Creates any missing intermediate parent categories.
     *
     * @returns Result with creation details or CategoryError
     *
     * @example
     * ```typescript
     * const docs = root.getCategory('docs/api/v2');
     * const result = await docs.create();
     * if (result.ok()) {
     *     if (result.value.created) {
     *         console.log('Created new category');
     *     } else {
     *         console.log('Category already existed');
     *     }
     * }
     * ```
     *
     * @edgeCases
     * - Creating root category returns INVALID_PATH error
     * - Parent categories are created automatically if missing
     */
    async create(): Promise<Result<CreateCategoryResult, CategoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return createCategory(this.adapter.categories, pathResult.value.toString());
    }

    /**
     * Delete this category and all its contents recursively.
     *
     * This is a destructive operation that removes:
     * - All memories within the category
     * - All subcategories and their contents
     * - The category's entry in its parent's index
     *
     * @returns Result with deletion details or CategoryError
     *
     * @example
     * ```typescript
     * const oldDocs = root.getCategory('docs/deprecated');
     * const result = await oldDocs.delete();
     * if (result.ok()) {
     *     console.log('Deleted:', result.value.path);
     * } else if (result.error.code === 'CATEGORY_NOT_FOUND') {
     *     console.log('Category does not exist');
     * }
     * ```
     *
     * @edgeCases
     * - Deleting root category returns ROOT_CATEGORY_REJECTED error
     * - Deleting non-existent category returns CATEGORY_NOT_FOUND error
     * - Not idempotent: deleting a missing category is an error
     */
    async delete(): Promise<Result<DeleteCategoryResult, CategoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return deleteCategory(this.adapter.categories, pathResult.value.toString());
    }

    /**
     * Check if this category exists.
     *
     * Verifies whether the category directory exists in storage.
     *
     * @returns Result with boolean (true if exists) or CategoryError
     *
     * @example
     * ```typescript
     * const standards = root.getCategory('standards');
     * const existsResult = await standards.exists();
     * if (existsResult.ok() && existsResult.value) {
     *     console.log('Category exists');
     * }
     * ```
     */
    async exists(): Promise<Result<boolean, CategoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return this.adapter.categories.exists(pathResult.value);
    }

    // =========================================================================
    // Metadata Methods
    // =========================================================================

    /**
     * Set or clear the category description.
     *
     * Descriptions provide human-readable context for what a category contains.
     * They are stored in the parent category's index file and displayed
     * when listing categories.
     *
     * @param description - Description text, or null/empty string to clear
     * @returns Result with the final description value or CategoryError
     *
     * @example
     * ```typescript
     * // Set a description
     * const result = await category.setDescription('TypeScript coding standards');
     * if (result.ok()) {
     *     console.log('Description set:', result.value.description);
     * }
     *
     * // Clear a description
     * await category.setDescription(null);
     * // or
     * await category.setDescription('');
     * ```
     *
     * @edgeCases
     * - Descriptions are trimmed; empty strings clear the description
     * - Maximum length is 500 characters (returns DESCRIPTION_TOO_LONG)
     * - Category must exist (returns CATEGORY_NOT_FOUND if not)
     */
    async setDescription(
        description: string | null,
    ): Promise<Result<SetDescriptionResult, CategoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return setDescription(
            this.adapter.categories,
            pathResult.value.toString(),
            description ?? '',
        );
    }

    // =========================================================================
    // Listing Methods
    // =========================================================================

    /**
     * List all memories in this category.
     *
     * Returns memory entries from the category's index file. Does not
     * recursively list memories from subcategories.
     *
     * Note: Expired memory filtering is handled by the `prune()` operation,
     * not during listing. The `includeExpired` option is reserved for future
     * use when expiration data is added to category indexes.
     *
     * @param options - Optional listing options
     * @param options.includeExpired - Reserved for future use (currently no effect)
     * @returns Result with array of CategoryMemoryEntry or CategoryError
     *
     * @example
     * ```typescript
     * const result = await category.listMemories();
     * if (result.ok()) {
     *     for (const memory of result.value) {
     *         console.log(`${memory.path}: ~${memory.tokenEstimate} tokens`);
     *     }
     * }
     * ```
     *
     * @edgeCases
     * - Returns empty array if category has no memories
     * - Returns empty array if category index doesn't exist
     */
    async listMemories(
        _options?: { includeExpired?: boolean },
    ): Promise<Result<CategoryMemoryEntry[], CategoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        const indexResult = await this.adapter.indexes.read(pathResult.value);
        if (!indexResult.ok()) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to read category index: ${this.rawPath}`,
                path: this.rawPath,
                cause: indexResult.error,
            });
        }

        // If no index exists, return empty array
        if (indexResult.value === null) {
            return ok([]);
        }

        return ok(indexResult.value.memories);
    }

    /**
     * List all subcategories of this category.
     *
     * Returns subcategory entries from the category's index file.
     * Each entry includes the subcategory path, memory count, and
     * optional description.
     *
     * @returns Result with array of SubcategoryEntry or CategoryError
     *
     * @example
     * ```typescript
     * const result = await category.listSubcategories();
     * if (result.ok()) {
     *     for (const subcat of result.value) {
     *         console.log(`${subcat.path}: ${subcat.memoryCount} memories`);
     *         if (subcat.description) {
     *             console.log(`  ${subcat.description}`);
     *         }
     *     }
     * }
     * ```
     *
     * @edgeCases
     * - Returns empty array if category has no subcategories
     * - Returns empty array if category index doesn't exist
     */
    async listSubcategories(): Promise<Result<SubcategoryEntry[], CategoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        const indexResult = await this.adapter.indexes.read(pathResult.value);
        if (!indexResult.ok()) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to read category index at ${this.rawPath}: ${indexResult.error.message ?? 'unknown error'}`,
                path: this.rawPath,
                cause: indexResult.error,
            });
        }

        // If no index exists, return empty array
        if (indexResult.value === null) {
            return ok([]);
        }

        return ok(indexResult.value.subcategories);
    }

    // =========================================================================
    // Store-wide Operations (currently store-wide, scoping can be added later)
    // =========================================================================

    /**
     * Rebuild indexes for the entire store.
     *
     * **Note:** This operation affects the entire store, not just this category's
     * subtree. It can be called from any CategoryClient instance in the store.
     *
     * Scans all categories and regenerates their index files from the
     * current filesystem state. This is useful for repairing corrupted
     * indexes or after manual file operations.
     *
     * @returns Result with ReindexResult containing warnings, or CategoryError
     *
     * @example
     * ```typescript
     * // Can be called from any category - affects entire store
     * const result = await anyCategory.reindex();
     * if (result.ok()) {
     *     if (result.value.warnings.length > 0) {
     *         console.log('Warnings:', result.value.warnings);
     *     } else {
     *         console.log('Reindex completed successfully');
     *     }
     * }
     * ```
     *
     * @edgeCases
     * - This is a potentially expensive operation on large stores
     * - File paths are normalized to valid slugs during reindexing
     * - Collisions are resolved with numeric suffixes (-2, -3, etc.)
     */
    async reindex(): Promise<Result<ReindexResult, CategoryError>> {
        const reindexResult = await this.adapter.indexes.reindex();
        if (!reindexResult.ok()) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to reindex store: ${reindexResult.error.message ?? 'unknown error'}`,
                path: '/',
                cause: reindexResult.error,
            });
        }

        return ok(reindexResult.value);
    }

    /**
     * Remove expired memories from the entire store.
     *
     * **Note:** This operation affects the entire store, not just this category's
     * subtree. It can be called from any CategoryClient instance in the store.
     *
     * Finds and deletes all memories that have passed their expiration
     * date. Supports dry-run mode to preview what would be deleted.
     *
     * @param options - Prune options
     * @param options.dryRun - If true, return what would be pruned without deleting
     * @param options.now - Current time for expiration check (default: new Date())
     * @returns Result with PruneResult or CategoryError
     *
     * @example
     * ```typescript
     * // Dry run to preview - can be called from any category
     * const preview = await anyCategory.prune({ dryRun: true });
     * if (preview.ok()) {
     *     console.log('Would prune:', preview.value.pruned.length, 'memories');
     * }
     *
     * // Actually prune
     * const result = await category.prune();
     * if (result.ok()) {
     *     console.log('Pruned:', result.value.pruned.length, 'memories');
     * }
     * ```
     *
     * @edgeCases
     * - Returns empty pruned array if no memories are expired
     * - Reindexes the store after pruning (unless dryRun)
     */
    async prune(options?: PruneOptions): Promise<Result<PruneResult, CategoryError>> {
        const pruneResult = await pruneExpiredMemories(this.adapter, options);
        if (!pruneResult.ok()) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to prune expired memories: ${pruneResult.error.message ?? 'unknown error'}`,
                path: '/',
                cause: pruneResult.error,
            });
        }

        return ok(pruneResult.value);
    }
}
