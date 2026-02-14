/**
 * Memory operations barrel export.
 *
 * Re-exports all memory CRUD operations, their input/output types,
 * and the serializer interface from individual operation modules.
 *
 * @module core/memory/operations
 */

// Create operation
export { createMemory } from './create.ts';
export type { CreateMemoryInput } from './create.ts';

// Get operation
export { getMemory } from './get.ts';
export type { GetMemoryOptions } from './get.ts';

// Update operation
export { updateMemory } from './update.ts';
export type { UpdateMemoryInput } from './update.ts';

// Move operation
export { moveMemory } from './move.ts';

// Remove operation
export { removeMemory } from './remove.ts';

// List operation
export { listMemories } from './list.ts';
export type {
    ListMemoriesOptions,
    ListedMemory,
    ListedSubcategory,
    ListMemoriesResult,
} from './list.ts';

// Prune operation
export { pruneExpiredMemories } from './prune.ts';
export type { PruneOptions, PrunedMemory, PruneResult } from './prune.ts';

// Recent memories operation
export { getRecentMemories } from './recent.ts';
export type { GetRecentMemoriesOptions, RecentMemory, GetRecentMemoriesResult } from './recent.ts';

export type { MemoryError, MemoryResult } from './result.ts';