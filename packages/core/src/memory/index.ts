/**
 * Memory module - centralized domain types and operations for memory management.
 *
 * This module provides storage-agnostic types for working with memories
 * in the Cortex system. Serialization/parsing is handled by storage adapters.
 *
 * @module core/memory
 *
 * @example
 * ```typescript
 * import {
 *     type Memory,
 *     type MemoryMetadata,
 *     type MemorySerializer,
 *     validateMemorySlugPath,
 * } from '@yeseh/cortex-core/memory';
 *
 * // For parsing/serialization, use storage-fs:
 * import { parseMemory, serializeMemory } from '@yeseh/cortex-storage-fs';
 * ```
 */

// Domain types
export type { MemoryMetadata, Memory, MemoryErrorCode, MemoryError } from './types.ts';

// Validation functions and types
export { validateCategoryPath, validateMemorySlugPath } from './validation.ts';

export type { MemoryPathValidationError } from './validation.ts';

// Expiration utilities
export { isExpired, isExpiredNow } from './expiration.ts';

// Operations types and interface
export type { MemorySerializer } from './operations.ts';

// Domain operations
export {
    createMemory,
    getMemory,
    updateMemory,
    moveMemory,
    removeMemory,
    listMemories,
    pruneExpiredMemories,
    getRecentMemories,
} from './operations.ts';

export type {
    CreateMemoryInput,
    UpdateMemoryInput,
    GetMemoryOptions,
    ListMemoriesOptions,
    PruneOptions,
    GetRecentMemoriesOptions,
    ListedMemory,
    ListedSubcategory,
    ListMemoriesResult,
    PrunedMemory,
    PruneResult,
    RecentMemory,
    GetRecentMemoriesResult,
} from './operations.ts';


