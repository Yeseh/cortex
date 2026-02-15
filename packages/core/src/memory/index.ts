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
export * from '../slug.ts';
export * from '../result.ts';
export * from './memory.ts';
export * from './result.ts';
export * from './memory-path.ts';
export * from './operations/index.ts';
