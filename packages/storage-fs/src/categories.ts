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
import { ok, err, type Result, type CategoryError, CategoryPath } from '@yeseh/cortex-core';
import type { FilesystemContext } from './types.ts';
import { isNotFoundError } from './utils.ts';
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
export const exists = async (
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
export const ensure = async (
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
    path: CategoryPath
): Promise<Result<void, CategoryError>> => {
    const dirPath = resolve(ctx.storeRoot, path.toString());
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
                `Failed to delete category directory: ${path.toString()}`,
                path.toString(),
                error
            )
        );
    }
};

/**
 * @deprecated Use {@link exists} instead.
 */
export const categoryExists = exists;

/**
 * @deprecated Use {@link ensure} instead.
 */
export const ensureCategoryDirectory = ensure;

/**
 * @deprecated Use {@link deleteCategoryDirectory} instead.
 */
export { deleteCategoryDirectory as delete };

/**
 * Updates the description of a subcategory in its parent's index.
 *
 * Creates the parent index and subcategory entry if they don't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param categoryPath - Full path to the subcategory
 * @param description - New description or null to clear
 * @returns Success or error
 */
export const updateSubcategoryDescription = async (
    ctx: FilesystemContext,
    categoryPath: CategoryPath,
    description: string | null
): Promise<Result<void, CategoryError>> => {
    const parent = categoryPath.parent;
    const indexName = !parent || parent.isRoot ? CategoryPath.root() : parent;
    const subcategoryPath = categoryPath.toString();

    const currentResult = await readCategoryIndex(ctx, indexName, { createWhenMissing: true });
    if (!currentResult.ok()) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to read parent index: ${indexName.toString()}`,
                indexName.toString(),
                currentResult.error
            )
        );
    }

    const currentIndex = currentResult.value;
    const subcategories = [...currentIndex.subcategories];

    // Find existing entry or create new one
    let entryIndex = subcategories.findIndex(
        (subcategory) => subcategory.path.toString() === subcategoryPath
    );
    if (entryIndex === -1) {
        subcategories.push({ path: categoryPath, memoryCount: 0 });
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
    subcategories.sort((a, b) => a.path.toString().localeCompare(b.path.toString()));
    const writeResult = await writeCategoryIndex(ctx, indexName, {
        memories: currentIndex.memories,
        subcategories,
    });

    if (!writeResult.ok()) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to write parent index: ${indexName.toString()}`,
                indexName.toString(),
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
 * @param categoryPath - Full path to the subcategory to remove
 * @returns Success or error
 */
export const removeSubcategoryEntry = async (
    ctx: FilesystemContext,
    categoryPath: CategoryPath
): Promise<Result<void, CategoryError>> => {
    const parent = categoryPath.parent;
    const indexName = !parent || parent.isRoot ? CategoryPath.root() : parent;
    const subcategoryPath = categoryPath.toString();
    const currentResult = await readCategoryIndex(ctx, indexName, { createWhenMissing: false });

    if (!currentResult.ok()) {
        // If we can't read the index, just return ok (nothing to remove)
        return ok(undefined);
    }

    const currentIndex = currentResult.value;
    const subcategories = currentIndex.subcategories.filter(
        (subcategory) => subcategory.path.toString() !== subcategoryPath
    );

    const writeResult = await writeCategoryIndex(ctx, indexName, {
        memories: currentIndex.memories,
        subcategories,
    });

    if (!writeResult.ok()) {
        return err(
            toCategoryError(
                'STORAGE_ERROR',
                `Failed to update parent index: ${indexName.toString()}`,
                indexName.toString(),
                writeResult.error
            )
        );
    }

    return ok(undefined);
};
