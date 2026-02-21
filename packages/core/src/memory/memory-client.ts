/**
 * MemoryClient - Fluent API for memory operations.
 *
 * Provides a client interface for interacting with individual memories.
 * Path validation is lazy - invalid paths only error on first async operation.
 *
 * @module core/cortex/memory-client
 */

import { ok, err, type Result } from '@/result.ts';
import type { StorageAdapter } from '@/storage';
import { MemoryPath } from '@/memory/memory-path.ts';
import { Slug } from '@/slug.ts';
import type { Memory, MemoryData } from '@/memory/memory.ts';
import type { MemoryError, MemoryResult } from '@/memory/result.ts';
import { memoryError } from '@/memory/result.ts';
import { createMemory } from '@/memory/operations/create.ts';
import { getMemory, type GetMemoryOptions } from '@/memory/operations/get.ts';
import { updateMemory, type UpdateMemoryInput } from '@/memory/operations/update.ts';
import { removeMemory } from '@/memory/operations/remove.ts';
import { moveMemory } from '@/memory/operations/move.ts';

/**
 * Client for interacting with individual memories.
 *
 * Provides fluent API for memory CRUD operations with lazy path validation.
 * Invalid paths only error on first async operation.
 *
 * All async operations return Result types and never throw exceptions.
 * Use `.ok()` to check success and access `.value` or `.error` accordingly.
 *
 * @example
 * ```typescript
 * // Get a memory client from a category
 * const memory = category.getMemory('architecture');
 *
 * // Check if memory exists
 * const existsResult = await memory.exists();
 * if (existsResult.ok() && existsResult.value) {
 *     // Get memory content
 *     const getResult = await memory.get();
 *     if (getResult.ok()) {
 *         console.log(getResult.value.content);
 *     }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Create a new memory
 * const memory = category.getMemory('new-standard');
 * const createResult = await memory.create({
 *     content: '# TypeScript Standards\n\nUse strict mode.',
 *     source: 'user',
 *     tags: ['typescript', 'standards'],
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Move a memory to a new location
 * const oldMemory = category.getMemory('old-name');
 * const moveResult = await oldMemory.move(newCategory.getMemory('new-name'));
 * if (moveResult.ok()) {
 *     const newClient = moveResult.value;
 *     console.log('Moved to:', newClient.rawPath);
 * }
 * ```
 */
export class MemoryClient {
    #rawPath: string;
    #rawSlug: string;

    /** Storage adapter for this memory's store */
    private readonly adapter: StorageAdapter;

    /**
     * Private constructor - use CategoryClient.getMemory() or factory method.
     *
     * @param path - The full memory path (normalized to canonical format)
     * @param rawSlug - The memory slug
     * @param adapter - The storage adapter for performing operations
     */
    private constructor(path: string, adapter: StorageAdapter) {
        const normalizedPath = MemoryClient.normalizePath(path);
        const slug = normalizedPath.split('/').slice(-1)[0] || '';

        this.#rawPath = normalizedPath;
        this.#rawSlug = slug;
        this.adapter = adapter;
    }

    /**
     * Full path including category with leading slash.
     *
     * @example "/standards/javascript/style"
     */
    get path(): MemoryPath {
        // Safe to unwrap - factory validates 
        return MemoryPath.fromString(this.#rawPath).unwrap(); 
    }

    /**
     * Memory name only (slug) as originally provided.
     *
     * Note: This is the raw input value. The actual slug used in storage
     * may be normalized (lowercase, hyphens for spaces). Use `parseSlug()`
     * to get the normalized slug.
     *
     * @example "style"
     * @example "MyStyle" // Raw input - parses to "mystyle"
     */
    get slug(): Slug {
        // Safe to unwrap - factory validates
        return Slug.from(this.#rawSlug).unwrap();
    }

    /**
     * Creates a MemoryClient for a specific path.
     *
     * This is an internal factory method for creating clients at arbitrary paths.
     * Used by CategoryClient and tests. External callers should use
     * `category.getMemory(slug)` instead.
     *
     * @internal
     * @param path - The full memory path (will be normalized)
     * @param slug - The memory slug
     * @param adapter - The storage adapter for the store
     * @returns A MemoryClient for the specified path
     *
     * @example
     * ```typescript
     * // Internal usage
     * const client = MemoryClient.init('/standards/typescript/style', adapter);
     * ```
     */
    static pointTo(path: string | MemoryPath, adapter: StorageAdapter): MemoryClient {
        if (path instanceof MemoryPath) {
            return new MemoryClient(path.toString(), adapter);
        }

        return new MemoryClient(path, adapter);
    }

    /**
     * Normalize a path to canonical format.
     *
     * Ensures paths are in a consistent format:
     * - Add leading slash if missing
     * - Collapse multiple slashes to single slash
     * - Remove trailing slash
     *
     * @param path - The path to normalize
     * @returns The normalized canonical path
     *
     * @example
     * ```typescript
     * MemoryClient.normalizePath('standards/typescript/style') // => '/standards/typescript/style'
     * MemoryClient.normalizePath('//foo//bar//baz')            // => '/foo/bar/baz'
     * ```
     */
    private static normalizePath(path: string): string {
        // Handle empty or whitespace-only input
        if (!path || path.trim() === '') {
            return '/';
        }

        // Collapse multiple slashes to single slash
        let normalized = path.replace(/\/+/g, '/');

        // Ensure leading slash
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }

        // Remove trailing slash
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }

        return normalized;
    }

    /**
     * Get the path without the leading slash for domain operations.
     *
     * Domain operations (createMemory, getMemory, etc.) expect paths
     * without leading slashes.
     *
     * @returns Path without leading slash
     */
    private getPathWithoutLeadingSlash(): string {
        return this.#rawPath.startsWith('/') ? this.#rawPath.slice(1) : this.#rawPath;
    }

    // =========================================================================
    // Parsing Methods (lazy validation)
    // =========================================================================

    /**
     * Parse the raw path into a MemoryPath value object.
     *
     * Converts the canonical rawPath (with leading slash) to a MemoryPath
     * that can be used with storage operations.
     *
     * @returns Result containing MemoryPath on success, or MemoryError with code INVALID_PATH if path is malformed
     *
     * @example
     * ```typescript
     * const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);
     * const pathResult = client.parsePath();
     * if (pathResult.ok()) {
     *     console.log(pathResult.value.toString()); // 'standards/typescript/style'
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Invalid path returns error
     * const client = MemoryClient.create('/invalid', 'invalid', adapter);
     * const pathResult = client.parsePath();
     * if (!pathResult.ok()) {
     *     console.log(pathResult.error.code); // 'INVALID_PATH'
     * }
     * ```
     */
    parsePath(): Result<MemoryPath, MemoryError> {
        const pathWithoutLeadingSlash = this.getPathWithoutLeadingSlash();
        const parseResult = MemoryPath.fromString(pathWithoutLeadingSlash);

        if (!parseResult.ok()) {
            return err({
                code: 'INVALID_PATH',
                message: `Invalid memory path: ${this.#rawPath}`,
                path: this.#rawPath,
                cause: parseResult.error,
            });
        }

        return ok(parseResult.value);
    }

    /**
     * Parse the raw slug into a Slug value object.
     *
     * Validates and normalizes the slug according to slug rules
     * (lowercase, hyphen-separated, no special characters).
     *
     * @returns Result containing Slug on success, or MemoryError with code INVALID_PATH if slug is empty or malformed
     *
     * @example
     * ```typescript
     * const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);
     * const slugResult = client.parseSlug();
     * if (slugResult.ok()) {
     *     console.log(slugResult.value.toString()); // 'style'
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Invalid slug returns error
     * const client = MemoryClient.create('/standards/typescript/', '', adapter);
     * const slugResult = client.parseSlug();
     * if (!slugResult.ok()) {
     *     console.log(slugResult.error.code); // 'INVALID_PATH'
     * }
     * ```
     */
    parseSlug(): Result<Slug, MemoryError> {
        const slugResult = Slug.from(this.#rawSlug);

        if (!slugResult.ok()) {
            return err({
                code: 'INVALID_PATH',
                message: `Invalid memory slug: ${this.#rawSlug}`,
                path: this.#rawPath,
                cause: slugResult.error,
            });
        }

        return ok(slugResult.value);
    }

    // =========================================================================
    // Lifecycle Methods (async)
    // =========================================================================

    /**
     * Create a new memory at this path.
     *
     * Creates the memory with the provided content and metadata. Parent
     * categories are created automatically if they don't exist.
     *
     * @param input - Memory creation input (content, source, tags, etc.)
     * @returns Result containing created Memory on success, or MemoryError (INVALID_PATH, STORAGE_ERROR)
     *
     * @example
     * ```typescript
     * const memory = category.getMemory('architecture');
     * const result = await memory.create({
     *     content: '# Architecture Decision\n\nUse hexagonal architecture.',
     *     source: 'user',
     *     tags: ['architecture', 'decision'],
     * });
     * if (result.ok()) {
     *     console.log('Created memory:', result.value.path.toString());
     * }
     * ```
     *
     * @example
     * ```typescript
     * // With expiration
     * const result = await memory.create({
     *     content: 'Temporary investigation notes',
     *     source: 'agent',
     *     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
     * });
     * ```
     *
     * @edgeCases
     * - Invalid path returns INVALID_PATH error
     * - Parent categories are created automatically
     * - Storage errors return STORAGE_ERROR
     */
    async create(input: MemoryData): Promise<Result<Memory, MemoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return createMemory(
            this.adapter, 
            this.getPathWithoutLeadingSlash(), 
            input);
    }

    /**
     * Retrieve the memory at this path.
     *
     * Returns the memory content and metadata. By default, expired memories
     * are not returned (returns MEMORY_EXPIRED error).
     *
     * @param options - Retrieval options
     * @param options.includeExpired - Include expired memories (default: false)
     * @param options.now - Current time for expiration check
     * @returns Result containing Memory on success, or MemoryError (INVALID_PATH, MEMORY_NOT_FOUND, MEMORY_EXPIRED)
     *
     * @example
     * ```typescript
     * const memory = category.getMemory('architecture');
     * const result = await memory.get();
     * if (result.ok()) {
     *     console.log(result.value.content);
     *     console.log('Tags:', result.value.metadata.tags);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Include expired memories
     * const result = await memory.get({ includeExpired: true });
     * ```
     *
     * @edgeCases
     * - Invalid path returns INVALID_PATH error
     * - Memory not found returns MEMORY_NOT_FOUND error
     * - Expired memory returns MEMORY_EXPIRED error (unless includeExpired: true)
     */
    async get(options?: GetMemoryOptions): Promise<Result<Memory, MemoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return getMemory(this.adapter, this.getPathWithoutLeadingSlash(), options);
    }

    /**
     * Update the memory at this path.
     *
     * Merges the provided updates with existing memory data. Only specified
     * fields are updated; others retain their current values.
     *
     * @param input - Update input (content, tags, expiresAt, citations)
     * @returns Result containing updated Memory on success, or MemoryError (INVALID_PATH, MEMORY_NOT_FOUND, INVALID_INPUT)
     *
     * @example
     * ```typescript
     * const memory = category.getMemory('architecture');
     * const result = await memory.update({
     *     content: 'Updated architecture notes',
     *     tags: ['architecture', 'updated'],
     * });
     * if (result.ok()) {
     *     console.log('Updated:', result.value.metadata.updatedAt);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Clear expiration
     * const result = await memory.update({ expiresAt: null });
     * ```
     *
     * @edgeCases
     * - Invalid path returns INVALID_PATH error
     * - Memory not found returns MEMORY_NOT_FOUND error
     * - Empty updates returns INVALID_INPUT error
     * - Pass expiresAt: null to clear expiration
     */
    async update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return updateMemory(this.adapter, this.getPathWithoutLeadingSlash(), input);
    }

    /**
     * Delete the memory at this path.
     *
     * Removes the memory file and updates category indexes.
     *
     * @returns Result containing void on success, or MemoryError (INVALID_PATH, MEMORY_NOT_FOUND)
     *
     * @example
     * ```typescript
     * const memory = category.getMemory('old-notes');
     * const result = await memory.delete();
     * if (result.ok()) {
     *     console.log('Memory deleted');
     * } else if (result.error.code === 'MEMORY_NOT_FOUND') {
     *     console.log('Memory did not exist');
     * }
     * ```
     *
     * @edgeCases
     * - Invalid path returns INVALID_PATH error
     * - Memory not found returns MEMORY_NOT_FOUND error
     * - Not idempotent: deleting a missing memory is an error
     */
    async delete(): Promise<Result<void, MemoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        return removeMemory(this.adapter, this.getPathWithoutLeadingSlash());
    }

    /**
     * Check if the memory exists at this path.
     *
     * Returns true if the memory file exists, false otherwise.
     * Does not check expiration status.
     *
     * @returns Result containing boolean (true if exists) on success, or MemoryError (INVALID_PATH, STORAGE_ERROR)
     *
     * @example
     * ```typescript
     * const memory = category.getMemory('architecture');
     * const existsResult = await memory.exists();
     * if (existsResult.ok() && existsResult.value) {
     *     console.log('Memory exists');
     * } else if (existsResult.ok()) {
     *     console.log('Memory does not exist');
     * }
     * ```
     *
     * @edgeCases
     * - Invalid path returns INVALID_PATH error
     * - Does not check if memory is expired
     */
    async exists(): Promise<Result<boolean, MemoryError>> {
        const pathResult = this.parsePath();
        if (!pathResult.ok()) {
            return pathResult;
        }

        const readResult = await this.adapter.memories.load(pathResult.value);
        if (!readResult.ok()) {
            return memoryError('STORAGE_ERROR', `Failed to check memory existence: ${this.#rawPath}`, {
                path: this.#rawPath,
                cause: readResult.error,
            });
        }

        return ok(readResult.value !== null);
    }

    // =========================================================================
    // Movement Methods
    // =========================================================================

    /**
     * Move the memory to a new location.
     *
     * Moves this memory to the destination path and returns a new MemoryClient
     * pointing to the new location. The current client becomes stale after a
     * successful move.
     *
     * @param destination - Target location (MemoryClient or MemoryPath)
     * @returns Result containing new MemoryClient at destination on success, or MemoryError (INVALID_PATH, MEMORY_NOT_FOUND, DESTINATION_EXISTS)
     *
     * @example
     * ```typescript
     * // Move using another MemoryClient
     * const oldMemory = category.getMemory('old-name');
     * const newMemory = otherCategory.getMemory('new-name');
     * const result = await oldMemory.move(newMemory);
     * if (result.ok()) {
     *     console.log('Moved to:', result.value.rawPath);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Move using MemoryPath
     * const parseResult = MemoryPath.fromString('standards/javascript/new-style');
     * if (parseResult.ok()) {
     *     const result = await memory.move(parseResult.value);
     * }
     * ```
     *
     * @edgeCases
     * - Invalid source path returns INVALID_PATH error
     * - Source not found returns MEMORY_NOT_FOUND error
     * - Destination already exists returns DESTINATION_EXISTS error
     * - Same-path move is a no-op (returns success)
     * - Current client is stale after successful move
     */
    async move(destination: MemoryClient | MemoryPath): Promise<MemoryResult<MemoryClient>> {
        // Validate source path first
        const sourcePathResult = this.parsePath();
        if (!sourcePathResult.ok()) {
            return sourcePathResult;
        }

        // Get destination path string
        let destPathString: string;
        let destSlug: string;

        if (destination instanceof MemoryClient) {
            // Validate destination client's path
            const destPathResult = destination.parsePath();
            if (!destPathResult.ok()) {
                return destPathResult;
            }
            destPathString = destination.getPathWithoutLeadingSlash();
            destSlug = destination.#rawSlug;
        }
        else {
            // MemoryPath - use toString()
            destPathString = destination.toString();
            destSlug = destination.slug.toString();
        }

        // Perform the move
        const moveResult = await moveMemory(
            this.adapter,
            this.getPathWithoutLeadingSlash(),
            destPathString,
        );

        if (!moveResult.ok()) {
            return moveResult;
        }

        const destinationClient = MemoryClient.pointTo('/' + destPathString, this.adapter);
        return ok(destinationClient);
    }
}
