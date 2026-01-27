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
 *     parseFrontmatter,
 *     serializeFrontmatter,
 *     validateMemorySlugPath,
 * } from './core/memory';
 *
 * // Parse a memory file
 * const result = parseFrontmatter(rawContent);
 * if (result.ok) {
 *     console.log(result.value.metadata.source);
 * }
 *
 * // Validate a memory path
 * const pathResult = validateMemorySlugPath('project/cortex/config');
 * if (pathResult.ok) {
 *     console.log(pathResult.value.categories);
 * }
 * ```
 */

// Domain types
export type { MemoryMetadata, Memory, MemoryErrorCode, MemoryError } from './types.ts';

// Validation functions and types
export { validateCategoryPath, validateMemorySlugPath } from './validation.ts';

export type { MemoryPathValidationError } from './validation.ts';

// Format adapters (new API)
export { parseFrontmatter, serializeFrontmatter } from './formats/index.ts';

// Format adapters (deprecated backwards compatibility)
export {
    parseMemoryFile,
    serializeMemoryFile,
    type MemoryFileFrontmatter,
    type MemoryFileContents,
    type MemoryFileParseErrorCode,
    type MemoryFileParseError,
    type MemoryFileSerializeErrorCode,
    type MemoryFileSerializeError,
} from './formats/index.ts';
