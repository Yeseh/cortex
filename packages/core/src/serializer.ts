/**
 * Memory serializer interface.
 *
 * Defines the contract for serializing and deserializing memory files.
 * This allows the operations module to work with any serialization format
 * without depending on a specific implementation. Storage adapters should
 * provide an implementation of this interface.
 *
 * @module core/memory/operations/serializer
 */

import type { Result } from '@/result';
import type { Memory } from './memory/memory';
import type { MemoryError } from './memory/result';


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

