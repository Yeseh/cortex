/**
 * Category module - centralized business logic for category operations
 *
 * @module core/category
 */

export * from './category-path.ts';

export type {
    CategoryErrorCode,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
    CategoryStorage,
    // New types from index module
    Category,
    CategoryMemoryEntry,
    SubcategoryEntry,
    IndexParseErrorCode,
    IndexParseError,
    IndexSerializeErrorCode,
    IndexSerializeError,
} from './types.ts';

export { MAX_DESCRIPTION_LENGTH, ROOT_CATEGORIES, type RootCategory } from './types.ts';

export { createCategory, setDescription, deleteCategory } from './operations/index.ts';
