/**
 * Index module for category index management.
 *
 * This module provides types and utilities for working with category
 * index files, which track memories and subcategories within each
 * category directory. Index files (`index.yaml`) are maintained
 * automatically when memories are written or deleted.
 *
 * Parsing and serialization functions are available in the
 * `core/serialization` module.
 *
 * @module core/index
 *
 * @example
 * ```typescript
 * import { CategoryIndex, INDEX_FILE_NAME } from './core/index';
 * import { parseCategoryIndex, serializeCategoryIndex } from './core/serialization';
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
