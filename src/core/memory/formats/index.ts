/**
 * Memory format adapters.
 *
 * This module provides format-specific parsing and serialization
 * adapters for memory files.
 *
 * @module core/memory/formats
 */

export {
    // New API
    parseFrontmatter,
    serializeFrontmatter,
    // Backwards compatibility (deprecated)
    parseMemoryFile,
    serializeMemoryFile,
    type MemoryFileFrontmatter,
    type MemoryFileContents,
    type MemoryFileParseErrorCode,
    type MemoryFileParseError,
    type MemoryFileSerializeErrorCode,
    type MemoryFileSerializeError,
} from './frontmatter.ts';
