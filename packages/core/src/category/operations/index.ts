/**
 * Category operations barrel export.
 *
 * Re-exports all category operations and pure helper functions
 * from individual operation modules.
 *
 * @module core/category/operations
 */

// Pure helpers
export { isRootCategory, getParentPath, getAncestorPaths } from './helpers.ts';

// Create operation
export { createCategory } from './create.ts';

// Set description operation
export { setDescription } from './set-description.ts';

// Delete operation
export { deleteCategory } from './delete.ts';
