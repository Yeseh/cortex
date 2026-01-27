/**
 * Category directory operations for filesystem storage.
 *
 * Handles checking, creating, and deleting category directories,
 * as well as updating subcategory descriptions in parent indexes.
 *
 * @module core/storage/filesystem/categories
 */

import { access, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Result } from '../../types.ts';
import type { CategoryError } from '../../category/types.ts';
import type { CategoryIndex } from '../../index/types.ts';
import type { FilesystemContext } from './types.ts';
import { err, isNotFoundError, ok } from './utils.ts';
import { readCategoryIndex, writeCategoryIndex } from './indexes.ts';

/**
 * Creates a CategoryError from components.
 */
const toCategoryError = (
    code: CategoryError['code'],
    message: string,
    path: string,
    cause?: unknown
): CategoryError => ({ code, message, path, cause });

/**
 * Checks if a category directory exists.
 *
 * @param ctx - Filesystem context with configuration
 * @param path - Category path to check (e.g., "project/cortex")
 * @returns true if the category exists, false otherwise
 */
export const categoryExists = async (
    ctx: FilesystemContext,
    path: string
): Promise<Result<boolean, CategoryError>> => {
    const dirPath = resolve(ctx.storeRoot, path);
    try {
        await access(dirPath);
        return ok(true);
    } catch {
        return ok(false);
    }
};

/**
 * Ensures a category directory exists, creating it if missing.
 *
 * Creates parent directories recursively if needed.
 *
 * @param ctx - Filesystem context with configuration
 * @param path - Category path to create (e.g., "project/cortex")
 * @returns Success or error
 */
export const ensureCategoryDirectory = async (
    ctx: FilesystemContext,
    path: string
): Promise<Result<void, CategoryError>> => {
    const dirPath = resolve(ctx.storeRoot, path);
    try {
        await mkdir(dirPath, { recursive: true });
        return ok(undefined);
    } catch (error) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to create category directory: ${path}`,
                path,
                error
            )
        );
    }
};

/**
 * Deletes a category directory and all its contents recursively.
 *
 * Returns success if the directory doesn't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param path - Category path to delete (e.g., "project/cortex")
 * @returns Success or error
 */
export const deleteCategoryDirectory = async (
    ctx: FilesystemContext,
    path: string
): Promise<Result<void, CategoryError>> => {
    const dirPath = resolve(ctx.storeRoot, path);
    try {
        await rm(dirPath, { recursive: true });
        return ok(undefined);
    } catch (error) {
        if (isNotFoundError(error)) {
            return ok(undefined);
        }
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to delete category directory: ${path}`,
                path,
                error
            )
        );
    }
};

/**
 * Updates the description of a subcategory in its parent's index.
 *
 * Creates the parent index and subcategory entry if they don't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param parentPath - Path to the parent category (empty string for root)
 * @param subcategoryPath - Full path to the subcategory
 * @param description - New description or null to clear
 * @returns Success or error
 */
export const updateSubcategoryDescription = async (
    ctx: FilesystemContext,
    parentPath: string,
    subcategoryPath: string,
    description: string | null
): Promise<Result<void, CategoryError>> => {
    const indexName = parentPath === '' ? '' : parentPath;
    const currentResult = await readCategoryIndex(ctx, indexName, { createWhenMissing: true });
    if (!currentResult.ok) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to read parent index: ${parentPath}`,
                parentPath,
                currentResult.error
            )
        );
    }

    const currentIndex = currentResult.value;
    const subcategories = [...currentIndex.subcategories];

    // Find existing entry or create new one
    let entryIndex = subcategories.findIndex((s) => s.path === subcategoryPath);
    if (entryIndex === -1) {
        subcategories.push({ path: subcategoryPath, memoryCount: 0 });
        entryIndex = subcategories.length - 1;
    }

    // Update description
    const entry = subcategories[entryIndex];
    if (entry) {
        if (description === null) {
            delete entry.description;
        } else {
            entry.description = description;
        }
    }

    // Sort and write back
    subcategories.sort((a, b) => a.path.localeCompare(b.path));
    const writeResult = await writeCategoryIndex(ctx, indexName, {
        memories: currentIndex.memories,
        subcategories,
    });

    if (!writeResult.ok) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to write parent index: ${parentPath}`,
                parentPath,
                writeResult.error
            )
        );
    }

    return ok(undefined);
};

/**
 * Removes a subcategory entry from its parent's index.
 *
 * Returns success if the parent index doesn't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param parentPath - Path to the parent category (empty string for root)
 * @param subcategoryPath - Full path to the subcategory to remove
 * @returns Success or error
 */
export const removeSubcategoryEntry = async (
    ctx: FilesystemContext,
    parentPath: string,
    subcategoryPath: string
): Promise<Result<void, CategoryError>> => {
    const indexName = parentPath === '' ? '' : parentPath;
    const currentResult = await readCategoryIndex(ctx, indexName, { createWhenMissing: false });

    if (!currentResult.ok) {
        // If we can't read the index, just return ok (nothing to remove)
        return ok(undefined);
    }

    const currentIndex = currentResult.value;
    const subcategories = currentIndex.subcategories.filter((s) => s.path !== subcategoryPath);

    const writeResult = await writeCategoryIndex(ctx, indexName, {
        memories: currentIndex.memories,
        subcategories,
    });

    if (!writeResult.ok) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to update parent index: ${parentPath}`,
                parentPath,
                writeResult.error
            )
        );
    }

    return ok(undefined);
};

/**
 * Reads a category index for the CategoryStoragePort interface.
 *
 * Returns null if the index doesn't exist (instead of error).
 */
export const readCategoryIndexForPort = async (
    ctx: FilesystemContext,
    path: string
): Promise<Result<CategoryIndex | null, CategoryError>> => {
    const result = await readCategoryIndex(ctx, path, { createWhenMissing: false });
    if (!result.ok) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to read category index: ${path}`,
                path,
                result.error
            )
        );
    }
    return ok(result.value);
};

/**
 * Writes a category index for the CategoryStoragePort interface.
 */
export const writeCategoryIndexForPort = async (
    ctx: FilesystemContext,
    path: string,
    index: CategoryIndex
): Promise<Result<void, CategoryError>> => {
    const result = await writeCategoryIndex(ctx, path, index);
    if (!result.ok) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to write category index: ${path}`,
                path,
                result.error
            )
        );
    }
    return ok(undefined);
};
