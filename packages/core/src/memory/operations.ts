/**
 * Memory CRUD operations.
 *
 * This module provides business logic operations for memory management,
 * abstracting away direct storage operations through the ScopedStorageAdapter.
 *
 * Operations that need to parse/serialize memory files accept a MemorySerializer
 * parameter for dependency injection. This keeps the core module free of
 * format-specific dependencies while allowing storage adapters to provide
 * their own serialization implementations.
 *
 * @module core/memory/operations
 */

import type { Result } from '../types.ts';
import type { ScopedStorageAdapter } from '../storage/adapter.ts';
import type { Memory, MemoryError, MemoryErrorCode } from './types.ts';
import type { CategoryIndex } from '../index/types.ts';
import { validateMemorySlugPath } from './validation.ts';
import { parseIndex } from '../serialization.ts';
import { isExpired } from './expiration.ts';

// ============================================================================
// Serializer Interface
// ============================================================================

/**
 * Interface for memory file serialization.
 *
 * This allows the operations module to work with any serialization format
 * without depending on a specific implementation. Storage adapters should
 * provide an implementation of this interface.
 *
 * @example
 * ```typescript
 * import { parseMemory, serializeMemory } from '@yeseh/cortex-storage-fs';
 *
 * const serializer: MemorySerializer = {
 *     parse: parseMemory,
 *     serialize: serializeMemory,
 * };
 * ```
 */
export interface MemorySerializer {
    /** Parse a raw memory file string into a Memory object */
    parse(raw: string): Result<Memory, MemoryError>;
    /** Serialize a Memory object to a string */
    serialize(memory: Memory): Result<string, MemoryError>;
}

// ============================================================================
// Input Types
// ============================================================================

/** Input for creating a new memory */
export interface CreateMemoryInput {
    /** Memory content (markdown) */
    content: string;
    /** Tags for categorization */
    tags?: string[];
    /** Source identifier (e.g., "cli", "mcp", "user") */
    source: string;
    /** Optional expiration timestamp */
    expiresAt?: Date;
}

/** Input for updating an existing memory */
export interface UpdateMemoryInput {
    /** New content (undefined = keep existing) */
    content?: string;
    /** New tags (undefined = keep existing) */
    tags?: string[];
    /**
     * New expiration date.
     * - `Date` — set expiration to this date
     * - `null` — explicitly clear (remove) the expiration
     * - `undefined` (omitted) — keep the existing value unchanged
     */
    expiresAt?: Date | null;
}

/** Options for retrieving a memory */
export interface GetMemoryOptions {
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** Options for listing memories */
export interface ListMemoriesOptions {
    /** Category to list (undefined = all root categories) */
    category?: string;
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** Options for pruning expired memories */
export interface PruneOptions {
    /** If true, return what would be pruned without deleting */
    dryRun?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

// ============================================================================
// Result Types
// ============================================================================

/** A memory entry in list results */
export interface ListedMemory {
    /** Full path to the memory */
    path: string;
    /** Estimated token count */
    tokenEstimate: number;
    /** Brief summary if available */
    summary?: string;
    /** Expiration timestamp if set */
    expiresAt?: Date;
    /** Whether the memory is currently expired */
    isExpired: boolean;
}

/** A subcategory entry in list results */
export interface ListedSubcategory {
    /** Full path to the subcategory */
    path: string;
    /** Total memories in this subcategory */
    memoryCount: number;
    /** Category description if set */
    description?: string;
}

/** Result of listing memories */
export interface ListMemoriesResult {
    /** Category that was listed (empty string for root) */
    category: string;
    /** Memories found */
    memories: ListedMemory[];
    /** Direct subcategories */
    subcategories: ListedSubcategory[];
}

/** A pruned memory entry */
export interface PrunedMemory {
    /** Path of the pruned memory */
    path: string;
    /** When it expired */
    expiresAt: Date;
}

/** Result of prune operation */
export interface PruneResult {
    /** Memories that were (or would be) pruned */
    pruned: PrunedMemory[];
}

// ============================================================================
// Helper Functions (internal)
// ============================================================================

/**
 * Creates a MemoryError with the given code and message.
 */
const memoryError = (
    code: MemoryErrorCode,
    message: string,
    extras?: Partial<MemoryError>
): MemoryError => ({
    code,
    message,
    ...extras,
});

/**
 * Creates a successful Result.
 */
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/**
 * Creates a failed Result.
 */
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Reads and parses a category index.
 */
const readCategoryIndex = async (
    storage: ScopedStorageAdapter,
    categoryPath: string
): Promise<Result<CategoryIndex | null, MemoryError>> => {
    const result = await storage.indexes.read(categoryPath);
    if (!result.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to read index: ${categoryPath}`, {
                cause: result.error,
            })
        );
    }
    if (!result.value) {
        return ok(null);
    }
    const parsed = parseIndex(result.value);
    if (!parsed.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to parse index: ${categoryPath}`, {
                cause: parsed.error,
            })
        );
    }
    return ok(parsed.value);
};

/**
 * Discovers all root categories by reading the store's root index.
 * Returns the category paths from the subcategories array.
 *
 * This enables dynamic discovery of categories instead of relying on
 * a hardcoded list, allowing stores to have any root-level categories.
 */
const discoverRootCategories = async (
    storage: ScopedStorageAdapter
): Promise<Result<string[], MemoryError>> => {
    const indexResult = await readCategoryIndex(storage, '');
    if (!indexResult.ok) {
        return indexResult;
    }

    if (!indexResult.value) {
        // No root index exists, return empty list
        return ok([]);
    }

    // Extract category paths from subcategories
    const categoryPaths = indexResult.value.subcategories.map((sub) => sub.path);
    return ok(categoryPaths);
};

/**
 * Collects memories recursively from a category.
 */
const collectMemoriesFromCategory = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,
    categoryPath: string,
    includeExpired: boolean,
    now: Date,
    visited: Set<string>
): Promise<Result<ListedMemory[], MemoryError>> => {
    // Prevent cycles
    if (visited.has(categoryPath)) return ok([]);
    visited.add(categoryPath);

    // Read index
    const indexResult = await readCategoryIndex(storage, categoryPath);
    if (!indexResult.ok) {
        return indexResult;
    }

    const index = indexResult.value;
    if (!index) {
        return ok([]);
    }

    const memories: ListedMemory[] = [];

    // Process memories in this category
    for (const entry of index.memories) {
        const readResult = await storage.memories.read(entry.path);
        if (!readResult.ok) {
            // Skip memories that can't be read
            continue;
        }
        if (!readResult.value) {
            // Memory file doesn't exist
            continue;
        }

        const parsed = serializer.parse(readResult.value);
        if (!parsed.ok) {
            // Skip memories that can't be parsed
            continue;
        }

        const memoryExpired = isExpired(parsed.value.metadata.expiresAt, now);

        // Filter based on includeExpired
        if (!includeExpired && memoryExpired) {
            continue;
        }

        memories.push({
            path: entry.path,
            tokenEstimate: entry.tokenEstimate,
            summary: entry.summary,
            expiresAt: parsed.value.metadata.expiresAt,
            isExpired: memoryExpired,
        });
    }

    // Recurse into subcategories
    for (const subcategory of index.subcategories) {
        const subResult = await collectMemoriesFromCategory(
            storage,
            serializer,
            subcategory.path,
            includeExpired,
            now,
            visited
        );
        if (subResult.ok) {
            memories.push(...subResult.value);
        }
    }

    return ok(memories);
};

/**
 * Collects direct subcategories from a category.
 */
const collectDirectSubcategories = async (
    storage: ScopedStorageAdapter,
    categoryPath: string
): Promise<Result<ListedSubcategory[], MemoryError>> => {
    const indexResult = await readCategoryIndex(storage, categoryPath);
    if (!indexResult.ok) {
        return indexResult;
    }

    const index = indexResult.value;
    if (!index) {
        return ok([]);
    }

    return ok(
        index.subcategories.map((s) => ({
            path: s.path,
            memoryCount: s.memoryCount,
            description: s.description,
        }))
    );
};

/**
 * Extracts the category path from a slug path.
 */
const getCategoryFromSlugPath = (slugPath: string): string => {
    const parts = slugPath.split('/');
    return parts.slice(0, -1).join('/');
};

// ============================================================================
// Operations
// ============================================================================

/**
 * Creates a new memory at the specified path.
 * Auto-creates parent categories as needed.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param slugPath - Memory path (e.g., "project/cortex/config")
 * @param input - Memory creation input
 * @param now - Current time (defaults to new Date())
 * @returns Result indicating success or failure with MemoryError
 */
export const createMemory = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,
    slugPath: string,
    input: CreateMemoryInput,
    now?: Date
): Promise<Result<void, MemoryError>> => {
    // 1. Validate path
    const pathResult = validateMemorySlugPath(slugPath);
    if (!pathResult.ok) {
        return err(
            memoryError('INVALID_PATH', pathResult.error.message, {
                path: slugPath,
            })
        );
    }

    // 2. Build Memory object
    const timestamp = now ?? new Date();
    const memory: Memory = {
        metadata: {
            createdAt: timestamp,
            updatedAt: timestamp,
            tags: input.tags ?? [],
            source: input.source,
            expiresAt: input.expiresAt,
        },
        content: input.content,
    };

    // 3. Serialize
    const serializeResult = serializer.serialize(memory);
    if (!serializeResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', 'Failed to serialize memory', {
                cause: serializeResult.error,
            })
        );
    }

    // 4. Write using storage.memories.write()
    const writeResult = await storage.memories.write(slugPath, serializeResult.value);
    if (!writeResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to write memory: ${slugPath}`, {
                path: slugPath,
                cause: writeResult.error,
            })
        );
    }

    // 5. Update indexes
    const indexResult = await storage.indexes.updateAfterMemoryWrite(
        slugPath,
        serializeResult.value
    );
    if (!indexResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', 'Failed to update indexes', {
                cause: indexResult.error,
            })
        );
    }

    return ok(undefined);
};

/**
 * Retrieves a memory with optional expiration filtering.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param slugPath - Memory path (e.g., "project/cortex/config")
 * @param options - Retrieval options (includeExpired, now)
 * @returns Result containing Memory or MemoryError
 */
export const getMemory = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,
    slugPath: string,
    options?: GetMemoryOptions
): Promise<Result<Memory, MemoryError>> => {
    // 1. Validate path
    const pathResult = validateMemorySlugPath(slugPath);
    if (!pathResult.ok) {
        return err(
            memoryError('INVALID_PATH', pathResult.error.message, {
                path: slugPath,
            })
        );
    }

    // 2. Read using storage.memories.read()
    const readResult = await storage.memories.read(slugPath);
    if (!readResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to read memory: ${slugPath}`, {
                path: slugPath,
                cause: readResult.error,
            })
        );
    }
    if (!readResult.value) {
        return err(
            memoryError('MEMORY_NOT_FOUND', `Memory not found: ${slugPath}`, {
                path: slugPath,
            })
        );
    }

    // 3. Parse using serializer
    const parseResult = serializer.parse(readResult.value);
    if (!parseResult.ok) {
        return err(parseResult.error);
    }

    // 4. Check expiration
    const now = options?.now ?? new Date();
    const includeExpired = options?.includeExpired ?? false;
    if (!includeExpired && isExpired(parseResult.value.metadata.expiresAt, now)) {
        return err(
            memoryError('MEMORY_EXPIRED', `Memory has expired: ${slugPath}`, {
                path: slugPath,
            })
        );
    }

    // 5. Return parsed memory
    return ok(parseResult.value);
};

/**
 * Updates an existing memory's content or metadata.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param slugPath - Memory path (e.g., "project/cortex/config")
 * @param updates - Update input (content, tags, expiresAt). Pass expiresAt as null to clear expiration.
 * @param now - Current time (defaults to new Date())
 * @returns Result containing updated Memory or MemoryError
 */
export const updateMemory = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,
    slugPath: string,
    updates: UpdateMemoryInput,
    now?: Date
): Promise<Result<Memory, MemoryError>> => {
    // 1. Validate path
    const pathResult = validateMemorySlugPath(slugPath);
    if (!pathResult.ok) {
        return err(
            memoryError('INVALID_PATH', pathResult.error.message, {
                path: slugPath,
            })
        );
    }

    // 2. Check if any updates provided
    const hasUpdates =
        updates.content !== undefined ||
        updates.tags !== undefined ||
        updates.expiresAt !== undefined;
    if (!hasUpdates) {
        return err(
            memoryError('INVALID_INPUT', 'No updates provided', {
                path: slugPath,
            })
        );
    }

    // 3. Read existing memory
    const readResult = await storage.memories.read(slugPath);
    if (!readResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to read memory: ${slugPath}`, {
                path: slugPath,
                cause: readResult.error,
            })
        );
    }
    if (!readResult.value) {
        return err(
            memoryError('MEMORY_NOT_FOUND', `Memory not found: ${slugPath}`, {
                path: slugPath,
            })
        );
    }

    const parseResult = serializer.parse(readResult.value);
    if (!parseResult.ok) {
        return err(parseResult.error);
    }

    const existing = parseResult.value;

    // 4. Merge updates
    const timestamp = now ?? new Date();
    const updatedMemory: Memory = {
        metadata: {
            createdAt: existing.metadata.createdAt,
            updatedAt: timestamp,
            tags: updates.tags ?? existing.metadata.tags,
            source: existing.metadata.source,
            expiresAt: updates.expiresAt === null
                ? undefined
                : (updates.expiresAt ?? existing.metadata.expiresAt),
        },
        content: updates.content ?? existing.content,
    };

    // 5. Serialize and write
    const serializeResult = serializer.serialize(updatedMemory);
    if (!serializeResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', 'Failed to serialize memory', {
                cause: serializeResult.error,
            })
        );
    }

    const writeResult = await storage.memories.write(slugPath, serializeResult.value);
    if (!writeResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to write memory: ${slugPath}`, {
                path: slugPath,
                cause: writeResult.error,
            })
        );
    }

    // 6. Update indexes
    const indexResult = await storage.indexes.updateAfterMemoryWrite(
        slugPath,
        serializeResult.value
    );
    if (!indexResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', 'Failed to update indexes', {
                cause: indexResult.error,
            })
        );
    }

    // 7. Return updated memory
    return ok(updatedMemory);
};

/**
 * Moves a memory to a new path with pre-flight checks.
 *
 * @param storage - The composed storage adapter
 * @param fromPath - Source memory path
 * @param toPath - Destination memory path
 * @returns Result indicating success or failure with MemoryError
 */
export const moveMemory = async (
    storage: ScopedStorageAdapter,
    fromPath: string,
    toPath: string
): Promise<Result<void, MemoryError>> => {
    // 1. Validate both paths
    const fromResult = validateMemorySlugPath(fromPath);
    if (!fromResult.ok) {
        return err(
            memoryError('INVALID_PATH', fromResult.error.message, {
                path: fromPath,
            })
        );
    }

    const toResult = validateMemorySlugPath(toPath);
    if (!toResult.ok) {
        return err(
            memoryError('INVALID_PATH', toResult.error.message, {
                path: toPath,
            })
        );
    }

    // Check for same-path move (no-op)
    if (fromPath === toPath) {
        return ok(undefined);
    }

    // 2. Check source exists
    const sourceCheck = await storage.memories.read(fromPath);
    if (!sourceCheck.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to read source memory: ${fromPath}`, {
                path: fromPath,
                cause: sourceCheck.error,
            })
        );
    }
    if (!sourceCheck.value) {
        return err(
            memoryError('MEMORY_NOT_FOUND', `Source memory not found: ${fromPath}`, {
                path: fromPath,
            })
        );
    }

    // 3. Check destination doesn't exist
    const destCheck = await storage.memories.read(toPath);
    if (!destCheck.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to check destination: ${toPath}`, {
                path: toPath,
                cause: destCheck.error,
            })
        );
    }
    if (destCheck.value) {
        return err(
            memoryError('DESTINATION_EXISTS', `Destination already exists: ${toPath}`, {
                path: toPath,
            })
        );
    }

    // 4. Create destination category
    const destCategory = getCategoryFromSlugPath(toPath);
    const ensureResult = await storage.categories.ensureCategoryDirectory(destCategory);
    if (!ensureResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to create destination category: ${destCategory}`, {
                cause: ensureResult.error,
            })
        );
    }

    // 5. Move using storage.memories.move()
    const moveResult = await storage.memories.move(fromPath, toPath);
    if (!moveResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to move memory from ${fromPath} to ${toPath}`, {
                cause: moveResult.error,
            })
        );
    }

    // 6. Reindex using storage.indexes.reindex()
    const reindexResult = await storage.indexes.reindex();
    if (!reindexResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', 'Failed to reindex after move', {
                cause: reindexResult.error,
            })
        );
    }

    return ok(undefined);
};

/**
 * Removes a memory and updates indexes.
 *
 * @param storage - The composed storage adapter
 * @param slugPath - Memory path to remove
 * @returns Result indicating success or failure with MemoryError
 */
export const removeMemory = async (
    storage: ScopedStorageAdapter,
    slugPath: string
): Promise<Result<void, MemoryError>> => {
    // 1. Validate path
    const pathResult = validateMemorySlugPath(slugPath);
    if (!pathResult.ok) {
        return err(
            memoryError('INVALID_PATH', pathResult.error.message, {
                path: slugPath,
            })
        );
    }

    // 2. Check memory exists
    const checkResult = await storage.memories.read(slugPath);
    if (!checkResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to read memory: ${slugPath}`, {
                path: slugPath,
                cause: checkResult.error,
            })
        );
    }
    if (!checkResult.value) {
        return err(
            memoryError('MEMORY_NOT_FOUND', `Memory not found: ${slugPath}`, {
                path: slugPath,
            })
        );
    }

    // 3. Remove using storage.memories.remove()
    const removeResult = await storage.memories.remove(slugPath);
    if (!removeResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', `Failed to remove memory: ${slugPath}`, {
                path: slugPath,
                cause: removeResult.error,
            })
        );
    }

    // 4. Reindex using storage.indexes.reindex()
    const reindexResult = await storage.indexes.reindex();
    if (!reindexResult.ok) {
        return err(
            memoryError('STORAGE_ERROR', 'Failed to reindex after remove', {
                cause: reindexResult.error,
            })
        );
    }

    return ok(undefined);
};

/**
 * Lists memories in a category or all root categories.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param options - List options (category, includeExpired, now)
 * @returns Result containing ListMemoriesResult or MemoryError
 */
export const listMemories = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,
    options?: ListMemoriesOptions
): Promise<Result<ListMemoriesResult, MemoryError>> => {
    const includeExpired = options?.includeExpired ?? false;
    const now = options?.now ?? new Date();
    const category = options?.category ?? '';

    const visited = new Set<string>();
    const memories: ListedMemory[] = [];
    const subcategories: ListedSubcategory[] = [];

    if (!category) {
        // No category specified - discover root categories dynamically
        const rootCategoriesResult = await discoverRootCategories(storage);
        if (!rootCategoriesResult.ok) {
            return rootCategoriesResult;
        }
        const rootCategories = rootCategoriesResult.value;

        for (const rootCat of rootCategories) {
            const collectResult = await collectMemoriesFromCategory(
                storage,
                serializer,
                rootCat,
                includeExpired,
                now,
                visited
            );
            if (collectResult.ok) {
                memories.push(...collectResult.value);
            }

            // Add root category itself as a discoverable subcategory
            const indexResult = await readCategoryIndex(storage, rootCat);
            if (indexResult.ok && indexResult.value) {
                subcategories.push({
                    path: rootCat,
                    memoryCount: indexResult.value.memories.length,
                    description: undefined,
                });
            }
        }
    } else {
        // Specific category requested
        const collectResult = await collectMemoriesFromCategory(
            storage,
            serializer,
            category,
            includeExpired,
            now,
            visited
        );
        if (!collectResult.ok) {
            return collectResult;
        }
        memories.push(...collectResult.value);

        const subResult = await collectDirectSubcategories(storage, category);
        if (!subResult.ok) {
            return subResult;
        }
        subcategories.push(...subResult.value);
    }

    return ok({
        category,
        memories,
        subcategories,
    });
};

/**
 * Finds and optionally deletes all expired memories.
 *
 * @param storage - The composed storage adapter
 * @param serializer - Memory serializer for format conversion
 * @param options - Prune options (dryRun, now)
 * @returns Result containing PruneResult or MemoryError
 */
export const pruneExpiredMemories = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,
    options?: PruneOptions
): Promise<Result<PruneResult, MemoryError>> => {
    const dryRun = options?.dryRun ?? false;
    const now = options?.now ?? new Date();

    // 1. Discover all root categories dynamically from the store's root index
    const rootCategoriesResult = await discoverRootCategories(storage);
    if (!rootCategoriesResult.ok) {
        return rootCategoriesResult;
    }
    const rootCategories = rootCategoriesResult.value;

    // 2. Collect all expired memories from discovered categories
    const expiredMemories: PrunedMemory[] = [];

    for (const rootCat of rootCategories) {
        const visited = new Set<string>();
        const collectResult = await collectMemoriesFromCategory(
            storage,
            serializer,
            rootCat,
            true, // Include expired
            now,
            visited
        );
        if (collectResult.ok) {
            for (const memory of collectResult.value) {
                if (memory.isExpired && memory.expiresAt) {
                    expiredMemories.push({
                        path: memory.path,
                        expiresAt: memory.expiresAt,
                    });
                }
            }
        }
    }

    // 2. If dryRun, return list without deleting
    if (dryRun) {
        return ok({ pruned: expiredMemories });
    }

    // 3. Delete each expired memory
    for (const memory of expiredMemories) {
        const removeResult = await storage.memories.remove(memory.path);
        if (!removeResult.ok) {
            return err(
                memoryError('STORAGE_ERROR', `Failed to remove expired memory: ${memory.path}`, {
                    path: memory.path,
                    cause: removeResult.error,
                })
            );
        }
    }

    // 4. Reindex if any were deleted
    if (expiredMemories.length > 0) {
        const reindexResult = await storage.indexes.reindex();
        if (!reindexResult.ok) {
            return err(
                memoryError('STORAGE_ERROR', 'Failed to reindex after prune', {
                    cause: reindexResult.error,
                })
            );
        }
    }

    // 5. Return list of pruned memories
    return ok({ pruned: expiredMemories });
};
