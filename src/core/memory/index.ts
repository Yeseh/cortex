/**
 * Memory module - centralized domain types and operations for memory management.
 *
 * This module provides storage-agnostic types and format adapters for
 * working with memories in the Cortex system.
 *
 * @module core/memory
 *
 * @example
 * ```typescript
 * import {
 *     type Memory,
 *     type MemoryMetadata,
 *     type MemoryFileContents,
 *     parseMemoryFile,
 *     serializeMemoryFile,
 *     validateMemorySlugPath,
 * } from './core/memory';
 *
 * // Parse a memory file
 * const result = parseMemoryFile(rawContent);
 * if (result.ok) {
 *     console.log(result.value.frontmatter.source);
 * }
 *
 * // Validate a memory path
 * const pathResult = validateMemorySlugPath('project/cortex/config');
 * if (pathResult.ok) {
 *     console.log(pathResult.value.categories);
 * }
 * ```
 */

import type { Result } from '../types.ts';
import type { MemoryMetadata, Memory, MemoryError } from './types.ts';
import {
    parseMemory,
    serializeMemory,
} from '../storage/filesystem/memories.ts';

// Domain types
export type { MemoryMetadata, Memory, MemoryErrorCode, MemoryError } from './types.ts';

// Validation functions and types
export { validateCategoryPath, validateMemorySlugPath } from './validation.ts';

export type { MemoryPathValidationError } from './validation.ts';

/**
 * Contents of a memory file with frontmatter metadata and content.
 * This type uses `frontmatter` as the property name for API compatibility.
 */
export interface MemoryFileContents {
    frontmatter: MemoryMetadata;
    content: string;
}

/**
 * Parses a raw memory file string into a MemoryFileContents object.
 *
 * The file format consists of YAML frontmatter delimited by `---` markers,
 * followed by the memory content.
 *
 * @param raw - The raw file content to parse
 * @returns Result containing MemoryFileContents or MemoryError
 */
export const parseMemoryFile = (raw: string): Result<MemoryFileContents, MemoryError> => {
    const result = parseMemory(raw);
    if (!result.ok) {
        return result;
    }
    return {
        ok: true,
        value: {
            frontmatter: result.value.metadata,
            content: result.value.content,
        },
    };
};

/**
 * Serializes a MemoryFileContents object to the frontmatter file format.
 *
 * The output format consists of YAML frontmatter delimited by `---` markers,
 * followed by the memory content.
 *
 * @param contents - The MemoryFileContents object to serialize
 * @returns Result containing the serialized string or MemoryError
 */
export const serializeMemoryFile = (contents: MemoryFileContents): Result<string, MemoryError> => {
    const memory: Memory = {
        metadata: contents.frontmatter,
        content: contents.content,
    };
    return serializeMemory(memory);
};
