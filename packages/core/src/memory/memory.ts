import { ok } from '@/result';
import { MemoryPath } from './memory-path';
import { memoryError, type MemoryResult } from './result';

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
 *     path: 'project/cortex/config',
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


/** Input for creating a new memory */
export type MemoryData = { 
    /** Memory content (markdown) */
    content: string;
    /** Metadata for the memory */
    metadata: MemoryMetadata;
}


/**
 * A memory entry combining metadata and content.
 *
 * Represents a single piece of stored knowledge with its
 * associated metadata for tracking and organization.
 */
export class Memory {
    /** The path of the memory, used for storage and retrieval */
    path: MemoryPath;
    /** Metadata associated with this memory */
    metadata: MemoryMetadata;
    /** The memory content as a string */
    content: string;

    private constructor(path: MemoryPath, metadata: MemoryMetadata, content: string) {
        this.path = path;
        this.metadata = metadata;
        this.content = content;
    }

    static init(
        path: string | MemoryPath, 
        metadata: MemoryMetadata, 
        content: string): MemoryResult<Memory> {
        if (typeof path === 'string') {
            const pathResult = MemoryPath.fromString(path);
            if (!pathResult.ok()) {
                return memoryError('INVALID_PATH', pathResult.error.message, {
                    path,
                });
            }
            path = pathResult.value;
        }

        return ok(new Memory(path, metadata, content)); 
    }

    /**
     * Checks if a memory has expired relative to a given time.
     *
     * @param now - Current time for comparison
     * @returns true if the memory has expired (expiresAt <= now)
     */
    isExpired(now: Date): boolean {
        if (!this.metadata.expiresAt) {
            return false;
        }
        return this.metadata.expiresAt.getTime() <= now.getTime();
    };
};
