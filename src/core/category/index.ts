/**
 * Category module - centralized business logic for category operations
 *
 * @module core/category
 */

export type {
    CategoryErrorCode,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
    CategoryStorage as CategoryStoragePort,
} from './types.ts';

export { MAX_DESCRIPTION_LENGTH, ROOT_CATEGORIES, type RootCategory } from './types.ts';

export {
    isRootCategory,
    getParentPath,
    getAncestorPaths,
    createCategory,
    setDescription,
    deleteCategory,
} from './operations.ts';
