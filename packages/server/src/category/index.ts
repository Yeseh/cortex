/**
 * MCP category tools module
 */

export {
    registerCategoryTools,
    createCategoryInputSchema,
    setCategoryDescriptionInputSchema,
    deleteCategoryInputSchema,
    type CreateCategoryInput,
    type SetCategoryDescriptionInput,
    type DeleteCategoryInput,
    type CategoryToolsOptions,
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
} from './tools.ts';
