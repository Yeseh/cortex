/**
 * Index module for category index management.
 *
 * This module provides types and utilities for working with category
 * index files, which track memories and subcategories within each
 * category directory. Index files (`index.yaml`) are maintained
 * automatically when memories are written or deleted.
 *
 * @module core/index
 *
 * @example
 * ```typescript
 * import {
 *   CategoryIndex,
 *   parseCategoryIndex,
 *   serializeCategoryIndex,
 *   INDEX_FILE_NAME
 * } from './core/index';
 *
 * // Parse an index file
 * const result = parseCategoryIndex(rawYaml);
 * if (result.ok) {
 *   console.log(`Found ${result.value.memories.length} memories`);
 * }
 *
 * // Serialize an index
 * const serialized = serializeCategoryIndex(index);
 * ```
 */

export * from './types.ts';
export * from './parser.ts';

// NOTE: Operations module (operations.ts) is intentionally omitted.
// Pure index manipulation helpers will be added after the
// refactor-serialization-module change completes and parser.ts is deleted.
// See: openspec/changes/refactor-core-index/proposal.md
