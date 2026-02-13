/**
 * Index module for category index management.
 *
 * This module provides types for working with category index data,
 * which track memories and subcategories within each category directory.
 * Parsing and serialization are handled by storage adapters and are
 * not part of the core index module API.
 *
 * @module core/index
 *
 * @example
 * ```typescript
 * import { CategoryIndex } from './core/index';
 *
 * const index: CategoryIndex = {
 *   memories: [],
 *   subcategories: [],
 * };
 * ```
 */

export * from './types.ts';
