/**
 * Index operations for filesystem storage.
 *
 * Handles reading, writing, and rebuilding category index files.
 *
 * @module core/storage/filesystem/indexes
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import type { MemorySlugPath, Result } from '../../types.ts';
import type { StorageAdapterError, StorageIndexName } from '../adapter.ts';
import type { CategoryIndex, IndexMemoryEntry } from '../../index/types.ts';
import { parseIndex, serializeIndex } from '../../serialization.ts';
import { defaultTokenizer } from '../../tokens.ts';
import { validateMemorySlugPath } from '../../memory/validation.ts';
import type { DirEntriesResult, FilesystemContext, StringOrNullResult } from './types.ts';
import { err, isNotFoundError, ok, resolveStoragePath, toSlugPathFromRelative } from './utils.ts';
import { validateSlugPath } from './files.ts';

/**
 * Internal state for building indexes during reindex.
 */
interface IndexBuildState {
    indexes: Map<string, CategoryIndex>;
    parentSubcategories: Map<string, Set<string>>;
}

type IndexBuildResult = Result<IndexBuildState, StorageAdapterError>;

/**
 * Resolves the filesystem path for an index file.
 */
export const resolveIndexPath = (
    ctx: FilesystemContext,
    name: StorageIndexName,
    errorCode: StorageAdapterError['code']
): Result<string, StorageAdapterError> => {
    // Category indexes are at: STORE_ROOT/<categoryPath>/index.yaml
    // For root category (empty string): STORE_ROOT/index.yaml
    const indexPath =
        name === '' ? `index${ctx.indexExtension}` : `${name}/index${ctx.indexExtension}`;
    return resolveStoragePath(ctx.storeRoot, indexPath, errorCode);
};

/**
 * Reads directory entries, returning empty array if directory doesn't exist.
 */
const readDirEntries = async (current: string): Promise<DirEntriesResult> => {
    try {
        const entries = await readdir(current, { withFileTypes: true });
        return ok(entries);
    } catch (error) {
        if (isNotFoundError(error)) {
            return ok([]);
        }
        return err({
            code: 'READ_FAILED',
            message: `Failed to read memory directory at ${current}.`,
            path: current,
            cause: error,
        });
    }
};

/**
 * Reads an index file from the filesystem.
 *
 * @param ctx - Filesystem context with configuration
 * @param name - Index name (category path, or empty string for root)
 * @returns The file contents or null if not found
 */
export const readIndexFile = async (
    ctx: FilesystemContext,
    name: StorageIndexName
): Promise<StringOrNullResult> => {
    const filePathResult = resolveIndexPath(ctx, name, 'READ_FAILED');
    if (!filePathResult.ok) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        const contents = await readFile(filePath, 'utf8');
        return ok(contents);
    } catch (error) {
        if (isNotFoundError(error)) {
            return ok(null);
        }
        return err({
            code: 'READ_FAILED',
            message: `Failed to read index file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
};

/**
 * Writes an index file to the filesystem.
 *
 * Creates parent directories if they don't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param name - Index name (category path, or empty string for root)
 * @param contents - The content to write
 * @returns Success or error
 */
export const writeIndexFile = async (
    ctx: FilesystemContext,
    name: StorageIndexName,
    contents: string
): Promise<Result<void, StorageAdapterError>> => {
    const filePathResult = resolveIndexPath(ctx, name, 'WRITE_FAILED');
    if (!filePathResult.ok) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, contents, 'utf8');
        return ok(undefined);
    } catch (error) {
        return err({
            code: 'WRITE_FAILED',
            message: `Failed to write index file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
};

/**
 * Reads and parses a category index file.
 *
 * @param ctx - Filesystem context with configuration
 * @param name - Index name (category path, or empty string for root)
 * @param options - Options for handling missing indexes
 * @returns Parsed CategoryIndex or error
 */
export const readCategoryIndex = async (
    ctx: FilesystemContext,
    name: StorageIndexName,
    options: { createWhenMissing?: boolean } = {}
): Promise<Result<CategoryIndex, StorageAdapterError>> => {
    const contents = await readIndexFile(ctx, name);
    if (!contents.ok) {
        return contents;
    }
    if (!contents.value) {
        if (!options.createWhenMissing) {
            return err({
                code: 'INDEX_UPDATE_FAILED',
                message: `Category index not found at ${name}.`,
                path: name,
            });
        }
        return ok({ memories: [], subcategories: [] });
    }
    const parsed = parseIndex(contents.value);
    if (!parsed.ok) {
        return err({
            code: 'INDEX_UPDATE_FAILED',
            message: `Failed to parse category index at ${name}.`,
            path: name,
            cause: parsed.error,
        });
    }
    return ok(parsed.value);
};

/**
 * Serializes and writes a category index file.
 *
 * @param ctx - Filesystem context with configuration
 * @param name - Index name (category path, or empty string for root)
 * @param index - The CategoryIndex to write
 * @returns Success or error
 */
export const writeCategoryIndex = async (
    ctx: FilesystemContext,
    name: StorageIndexName,
    index: CategoryIndex
): Promise<Result<void, StorageAdapterError>> => {
    const serialized = serializeIndex(index);
    if (!serialized.ok) {
        return err({
            code: 'INDEX_UPDATE_FAILED',
            message: `Failed to serialize category index at ${name}.`,
            path: name,
            cause: serialized.error,
        });
    }
    return writeIndexFile(ctx, name, serialized.value);
};

/**
 * Upserts a memory entry into a category index.
 *
 * If the memory already exists in the index, it is replaced.
 * Entries are kept sorted by path.
 */
export const upsertMemoryEntry = async (
    ctx: FilesystemContext,
    indexName: StorageIndexName,
    entry: IndexMemoryEntry,
    options: { createWhenMissing?: boolean } = {}
): Promise<Result<void, StorageAdapterError>> => {
    const current = await readCategoryIndex(ctx, indexName, options);
    if (!current.ok) {
        return current;
    }
    const memories = current.value.memories.filter((existing) => existing.path !== entry.path);
    memories.push(entry);
    memories.sort((a, b) => a.path.localeCompare(b.path));
    const nextIndex: CategoryIndex = {
        memories,
        subcategories: current.value.subcategories,
    };
    return writeCategoryIndex(ctx, indexName, nextIndex);
};

/**
 * Upserts a subcategory entry into a parent category index.
 *
 * Preserves the existing description if present.
 */
export const upsertSubcategoryEntry = async (
    ctx: FilesystemContext,
    indexName: StorageIndexName,
    entryPath: string,
    memoryCount: number,
    options: { createWhenMissing?: boolean } = {}
): Promise<Result<void, StorageAdapterError>> => {
    const current = await readCategoryIndex(ctx, indexName, options);
    if (!current.ok) {
        return current;
    }
    const existing = current.value.subcategories.find((s) => s.path === entryPath);
    const subcategories = current.value.subcategories.filter((s) => s.path !== entryPath);

    subcategories.push({
        path: entryPath,
        memoryCount,
        ...(existing?.description ? { description: existing.description } : {}),
    });
    subcategories.sort((a, b) => a.path.localeCompare(b.path));
    const nextIndex: CategoryIndex = {
        memories: current.value.memories,
        subcategories,
    };
    return writeCategoryIndex(ctx, indexName, nextIndex);
};

/**
 * Updates all category indexes when a memory is written.
 *
 * Updates the memory's category index and all ancestor indexes
 * with proper memory counts.
 */
export const updateCategoryIndexes = async (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
    contents: string,
    options: { createWhenMissing?: boolean } = {}
): Promise<Result<void, StorageAdapterError>> => {
    const identityResult = validateSlugPath(slugPath, {
        code: 'INDEX_UPDATE_FAILED',
        message: 'Invalid memory slug path.',
        path: slugPath,
    });
    if (!identityResult.ok) {
        return identityResult;
    }
    const categories = identityResult.value.categories;
    const categoryIndexName = categories.join('/');

    const tokenEstimateResult = defaultTokenizer.estimateTokens(contents);
    if (!tokenEstimateResult.ok) {
        return err({
            code: 'INDEX_UPDATE_FAILED',
            message: 'Failed to estimate tokens for memory content.',
            path: slugPath,
            cause: tokenEstimateResult.error,
        });
    }

    const upsertMemory = await upsertMemoryEntry(
        ctx,
        categoryIndexName,
        {
            path: slugPath,
            tokenEstimate: tokenEstimateResult.value,
        },
        { ...options, createWhenMissing: true }
    );
    if (!upsertMemory.ok) {
        return upsertMemory;
    }

    // Update root index with top-level category
    const topLevelCategory = categories[0];
    if (topLevelCategory !== undefined) {
        const rootIndexName = '';
        const topLevelCategoryIndex = await readCategoryIndex(ctx, topLevelCategory, {
            ...options,
            createWhenMissing: true,
        });
        if (!topLevelCategoryIndex.ok) {
            return topLevelCategoryIndex;
        }
        const upsertRoot = await upsertSubcategoryEntry(
            ctx,
            rootIndexName,
            topLevelCategory,
            topLevelCategoryIndex.value.memories.length,
            { ...options, createWhenMissing: true }
        );
        if (!upsertRoot.ok) {
            return upsertRoot;
        }
    }

    // Then handle nested subcategories
    for (let index = 1; index <= categories.length - 1; index += 1) {
        const parentIndexName = categories.slice(0, index).join('/');
        const subcategoryPath = categories.slice(0, index + 1).join('/');
        const subcategoryIndex = await readCategoryIndex(ctx, subcategoryPath, {
            ...options,
            createWhenMissing: true,
        });
        if (!subcategoryIndex.ok) {
            return subcategoryIndex;
        }
        const upsertSubcategory = await upsertSubcategoryEntry(
            ctx,
            parentIndexName,
            subcategoryPath,
            subcategoryIndex.value.memories.length,
            { ...options, createWhenMissing: true }
        );
        if (!upsertSubcategory.ok) {
            return upsertSubcategory;
        }
    }

    return ok(undefined);
};

/**
 * Collects all memory file paths recursively from a directory.
 */
const collectMemoryFiles = async (
    ctx: FilesystemContext,
    root: string
): Promise<Result<string[], StorageAdapterError>> => {
    const results: string[] = [];
    const pending: string[] = [root];
    let sawNotFoundRoot = false;

    while (pending.length > 0) {
        const current = pending.pop();
        if (!current) {
            continue;
        }

        const entriesResult = await readDirEntries(current);
        if (!entriesResult.ok) {
            return entriesResult;
        }

        if (entriesResult.value.length === 0 && current === root) {
            sawNotFoundRoot = true;
        }

        for (const entry of entriesResult.value) {
            const entryName = typeof entry.name === 'string' ? entry.name : entry.name.toString();
            const entryPath = resolve(current, entryName);
            if (entry.isDirectory()) {
                pending.push(entryPath);
                continue;
            }
            // Only include memory files (with memory extension), skip index files
            if (entry.isFile() && extname(entryPath) === ctx.memoryExtension) {
                results.push(entryPath);
            }
        }
    }

    if (results.length === 0 && sawNotFoundRoot) {
        return ok([]);
    }

    return ok(results);
};

/**
 * Adds an index entry to the in-memory index map.
 */
const addIndexEntry = (
    indexes: Map<string, CategoryIndex>,
    slugPath: MemorySlugPath,
    tokenEstimate: number
): void => {
    const categoryPath = slugPath.split('/').slice(0, -1).join('/');
    const current = indexes.get(categoryPath) ?? { memories: [], subcategories: [] };
    current.memories.push({ path: slugPath, tokenEstimate });
    indexes.set(categoryPath, current);
};

/**
 * Records parent-subcategory relationships for multi-level categories.
 */
const recordParentSubcategory = (
    parentSubcategories: Map<string, Set<string>>,
    slugPath: MemorySlugPath
): void => {
    const segments = slugPath.split('/').filter((segment) => segment.length > 0);
    if (segments.length <= 2) {
        return;
    }
    for (let index = 1; index < segments.length - 1; index += 1) {
        const parentCategory = segments.slice(0, index).join('/');
        const subcategoryPath = segments.slice(0, index + 1).join('/');
        const subcategories = parentSubcategories.get(parentCategory) ?? new Set();
        subcategories.add(subcategoryPath);
        parentSubcategories.set(parentCategory, subcategories);
    }
};

/**
 * Applies parent subcategory relationships to indexes.
 */
const applyParentSubcategories = (
    indexes: Map<string, CategoryIndex>,
    parentSubcategories: Map<string, Set<string>>
): void => {
    for (const [parentCategory, subcategories] of parentSubcategories.entries()) {
        const parentIndex = indexes.get(parentCategory) ?? {
            memories: [],
            subcategories: [],
        };
        const subcategoryEntries: CategoryIndex['subcategories'] = [];
        for (const subcategoryPath of subcategories.values()) {
            const memoryCount = indexes.get(subcategoryPath)?.memories.length ?? 0;
            subcategoryEntries.push({ path: subcategoryPath, memoryCount });
        }
        parentIndex.subcategories = subcategoryEntries;
        indexes.set(parentCategory, parentIndex);
    }
};

/**
 * Builds an index entry from a memory file.
 */
const buildIndexEntry = async (
    ctx: FilesystemContext,
    filePath: string
): Promise<
    Result<{ slugPath: MemorySlugPath; tokenEstimate: number } | null, StorageAdapterError>
> => {
    const relativePath = relative(ctx.storeRoot, filePath);
    const slugPath = toSlugPathFromRelative(relativePath, ctx.memoryExtension);
    if (!slugPath) {
        return ok(null);
    }
    const identity = validateMemorySlugPath(slugPath);
    if (!identity.ok) {
        return err({
            code: 'INDEX_UPDATE_FAILED',
            message: `Invalid memory slug path for ${filePath}.`,
            path: filePath,
            cause: identity.error,
        });
    }
    let contents: string;
    try {
        contents = await readFile(filePath, 'utf8');
    } catch (error) {
        return err({
            code: 'READ_FAILED',
            message: `Failed to read memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
    const tokenEstimate = defaultTokenizer.estimateTokens(contents);
    if (!tokenEstimate.ok) {
        return err({
            code: 'INDEX_UPDATE_FAILED',
            message: 'Failed to estimate tokens for memory content.',
            path: identity.value.slugPath,
            cause: tokenEstimate.error,
        });
    }
    return ok({ slugPath: identity.value.slugPath, tokenEstimate: tokenEstimate.value });
};

/**
 * Builds index state from collected memory files.
 */
const buildIndexState = async (
    ctx: FilesystemContext,
    filePaths: string[]
): Promise<IndexBuildResult> => {
    const indexes = new Map<string, CategoryIndex>();
    const parentSubcategories = new Map<string, Set<string>>();

    for (const filePath of filePaths) {
        const entryResult = await buildIndexEntry(ctx, filePath);
        if (!entryResult.ok) {
            return entryResult;
        }
        if (!entryResult.value) {
            continue;
        }
        addIndexEntry(indexes, entryResult.value.slugPath, entryResult.value.tokenEstimate);
        recordParentSubcategory(parentSubcategories, entryResult.value.slugPath);
    }

    return ok({ indexes, parentSubcategories });
};

/**
 * Rebuilds and writes all index files.
 */
const rebuildIndexFiles = async (
    ctx: FilesystemContext,
    targetRoot: string,
    indexes: Map<string, CategoryIndex>
): Promise<Result<void, StorageAdapterError>> => {
    const sortedIndexes = Array.from(indexes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [indexName, index] of sortedIndexes) {
        index.memories.sort((a, b) => a.path.localeCompare(b.path));
        index.subcategories.sort((a, b) => a.path.localeCompare(b.path));
        const serialized = serializeIndex(index);
        if (!serialized.ok) {
            return err({
                code: 'INDEX_UPDATE_FAILED',
                message: `Failed to serialize category index at ${indexName}.`,
                path: indexName,
                cause: serialized.error,
            });
        }
        // Index files are at: targetRoot/<categoryPath>/index.yaml
        // For root category (empty string): targetRoot/index.yaml
        const indexPath =
            indexName === ''
                ? `index${ctx.indexExtension}`
                : `${indexName}/index${ctx.indexExtension}`;
        const filePathResult = resolveStoragePath(targetRoot, indexPath, 'WRITE_FAILED');
        if (!filePathResult.ok) {
            return filePathResult;
        }
        try {
            await mkdir(dirname(filePathResult.value), { recursive: true });
            await writeFile(filePathResult.value, serialized.value, 'utf8');
        } catch (error) {
            return err({
                code: 'WRITE_FAILED',
                message: `Failed to write index file at ${filePathResult.value}.`,
                path: filePathResult.value,
                cause: error,
            });
        }
    }
    return ok(undefined);
};

/**
 * Reindexes all category indexes by scanning the filesystem.
 *
 * Walks the storage directory, collects all memory files,
 * and rebuilds all index files from scratch.
 *
 * @param ctx - Filesystem context with configuration
 * @returns Success or error
 */
export const reindexCategoryIndexes = async (
    ctx: FilesystemContext
): Promise<Result<void, StorageAdapterError>> => {
    const filesResult = await collectMemoryFiles(ctx, ctx.storeRoot);
    if (!filesResult.ok) {
        return filesResult;
    }

    const buildState = await buildIndexState(ctx, filesResult.value);
    if (!buildState.ok) {
        return buildState;
    }
    applyParentSubcategories(buildState.value.indexes, buildState.value.parentSubcategories);

    // Write index files in-place to storeRoot
    const buildResult = await rebuildIndexFiles(ctx, ctx.storeRoot, buildState.value.indexes);
    if (!buildResult.ok) {
        return buildResult;
    }

    return ok(undefined);
};
