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
export * from '@/slug';
export * from '@/memory/memory';
export * from '@/memory/result';
export * from '@/memory/memory-path';

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
} from './operations/index.ts';

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
} from './operations/index.ts';
