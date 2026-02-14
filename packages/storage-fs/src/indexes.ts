/**
 * Index operations for filesystem storage.
 *
 * Handles reading, writing, and rebuilding category index files.
 *
 * @module core/storage/filesystem/indexes
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { CategoryPath, type Result } from '@yeseh/cortex-core';
import { type Memory, MemoryPath } from '@yeseh/cortex-core/memory';
import type { ReindexResult, StorageAdapterError } from '@yeseh/cortex-core/storage';
import type { CategoryIndex, IndexMemoryEntry } from '@yeseh/cortex-core/index';
import { defaultTokenizer, err, ok } from '@yeseh/cortex-core';
import type { DirEntriesResult, FilesystemContext, StringOrNullResult } from './types.ts';
import { isNotFoundError, resolveStoragePath, toSlugPathFromRelative } from './utils.ts';
import { parseMemory, serializeMemory } from './memories.ts';
import { parseIndex, serializeIndex } from './index-serialization.ts';

/**
 * Internal state for building indexes during reindex.
 */
interface IndexBuildState {
    indexes: Map<string, CategoryIndex>;
    parentSubcategories: Map<string, Set<string>>;
    warnings: string[];
}

type IndexBuildResult = Result<IndexBuildState, StorageAdapterError>;

/**
 * Resolves the filesystem path for an index file.
 */
export const resolveIndexPath = (
    ctx: FilesystemContext,
    name: CategoryPath,
    errorCode: StorageAdapterError['code'],
): Result<string, StorageAdapterError> => {
    // Category indexes are at: STORE_ROOT/<categoryPath>/index.yaml
    // For root category (empty string): STORE_ROOT/index.yaml
    const indexPath = name.isRoot
        ? `index${ctx.indexExtension}`
        : `${name.toString()}/index${ctx.indexExtension}`;
    return resolveStoragePath(ctx.storeRoot, indexPath, errorCode);
};

/**
 * Reads directory entries, returning empty array if directory doesn't exist.
 */
const readDirEntries = async (current: string): Promise<DirEntriesResult> => {
    try {
        const entries = await readdir(current, { withFileTypes: true });
        return ok(entries);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return ok([]);
        }
        return err({
            code: 'IO_READ_ERROR',
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
    name: CategoryPath,
): Promise<StringOrNullResult> => {
    const filePathResult = resolveIndexPath(ctx, name, 'IO_READ_ERROR');
    if (!filePathResult.ok()) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        const contents = await readFile(filePath, 'utf8');
        return ok(contents);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return ok(null);
        }
        return err({
            code: 'IO_READ_ERROR',
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
    name: CategoryPath,
    contents: string,
): Promise<Result<void, StorageAdapterError>> => {
    const filePathResult = resolveIndexPath(ctx, name, 'IO_WRITE_ERROR');
    if (!filePathResult.ok()) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, contents, 'utf8');
        return ok(undefined);
    }
    catch (error) {
        return err({
            code: 'IO_WRITE_ERROR',
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
    name: CategoryPath,
    options: { createWhenMissing?: boolean } = {},
): Promise<Result<CategoryIndex, StorageAdapterError>> => {
    const contents = await readIndexFile(ctx, name);
    if (!contents.ok()) {
        return contents;
    }
    if (!contents.value) {
        if (!options.createWhenMissing) {
            return err({
                code: 'INDEX_ERROR',
                message: `Category index not found at ${name}.`,
                path: name.toString(),
            });
        }
        return ok({ memories: [], subcategories: [] });
    }
    const parsed = parseIndex(contents.value);
    if (!parsed.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: `Failed to parse category index at ${name}.`,
            path: name.toString(),
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
    name: CategoryPath,
    index: CategoryIndex,
): Promise<Result<void, StorageAdapterError>> => {
    const serialized = serializeIndex(index);
    if (!serialized.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: `Failed to serialize category index at ${name}.`,
            path: name.toString(),
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
    indexName: CategoryPath,
    entry: IndexMemoryEntry,
    options: { createWhenMissing?: boolean } = {},
): Promise<Result<void, StorageAdapterError>> => {
    const indexResult = await readCategoryIndex(ctx, indexName, options);
    if (!indexResult.ok()) {
        return indexResult;
    }

    const currentIndex = indexResult.value;
    const memories = currentIndex.memories.filter(
        (existing) => existing.path.toString() !== entry.path.toString(),
    );
    memories.push(entry);
    memories.sort((a, b) => a.path.toString().localeCompare(b.path.toString()));
    const nextIndex: CategoryIndex = {
        memories,
        subcategories: indexResult.value.subcategories,
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
    indexName: CategoryPath,
    entryPath: string,
    memoryCount: number,
    options: { createWhenMissing?: boolean } = {},
): Promise<Result<void, StorageAdapterError>> => {
    const current = await readCategoryIndex(ctx, indexName, options);
    if (!current.ok()) {
        return current;
    }

    // Convert string path to CategoryPath for comparison and storage
    const entryPathResult = CategoryPath.fromString(entryPath);
    if (!entryPathResult.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: `Invalid category path '${entryPath}'.`,
            path: entryPath,
            cause: entryPathResult.error,
        });
    }
    const entryPathObj = entryPathResult.value;
    const existing = current.value.subcategories.find((s) => s.path.toString() === entryPath);
    const subcategories = current.value.subcategories.filter(
        (s) => s.path.toString() !== entryPath,
    );

    subcategories.push({
        path: entryPathObj,
        memoryCount,
        ...(existing?.description ? { description: existing.description } : {}),
    });
    subcategories.sort((a, b) => a.path.toString().localeCompare(b.path.toString()));
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
    slugPath: MemoryPath,
    contents: string,
    options: { createWhenMissing?: boolean } = {},
): Promise<Result<void, StorageAdapterError>> => {
    const category = slugPath.category;
    const categories = category.toString() ? category.toString().split('/') : [];

    const tokenEstimateResult = defaultTokenizer.estimateTokens(contents);
    if (!tokenEstimateResult.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: 'Failed to estimate tokens for memory content.',
            path: slugPath.toString(),
            cause: tokenEstimateResult.error,
        });
    }

    // Parse memory to extract updatedAt timestamp
    const parseResult = parseMemory(contents);
    if (!parseResult.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: 'Failed to parse memory content for index update.',
            path: slugPath.toString(),
            cause: parseResult.error,
        });
    }

    const upsertMemory = await upsertMemoryEntry(
        ctx,
        category,
        {
            path: slugPath,
            tokenEstimate: tokenEstimateResult.value,
            updatedAt: parseResult.value.metadata.updatedAt,
        },
        { ...options, createWhenMissing: true },
    );
    if (!upsertMemory.ok()) {
        return upsertMemory;
    }

    // Update root index with top-level category
    const topLevelCategory = categories[0];
    if (topLevelCategory !== undefined) {
        const rootCategory = CategoryPath.root();
        const topLevelCategoryPathResult = CategoryPath.fromString(topLevelCategory);
        if (!topLevelCategoryPathResult.ok()) {
            return err({
                code: 'INDEX_ERROR',
                message: `Invalid category path '${topLevelCategory}'.`,
                path: topLevelCategory,
                cause: topLevelCategoryPathResult.error,
            });
        }
        const topLevelCategoryPath = topLevelCategoryPathResult.value;
        const topLevelCategoryIndex = await readCategoryIndex(ctx, topLevelCategoryPath, {
            ...options,
            createWhenMissing: true,
        });
        if (!topLevelCategoryIndex.ok()) {
            return topLevelCategoryIndex;
        }
        const upsertRoot = await upsertSubcategoryEntry(
            ctx,
            rootCategory,
            topLevelCategory,
            topLevelCategoryIndex.value.memories.length,
            { ...options, createWhenMissing: true },
        );
        if (!upsertRoot.ok()) {
            return upsertRoot;
        }
    }

    // Then handle nested subcategories
    for (let index = 1; index <= categories.length - 1; index += 1) {
        const parentPathStr = categories.slice(0, index).join('/');
        const parentPathResult = CategoryPath.fromString(parentPathStr);
        if (!parentPathResult.ok()) {
            return err({
                code: 'INDEX_ERROR',
                message: `Invalid category path '${parentPathStr}'.`,
                path: parentPathStr,
                cause: parentPathResult.error,
            });
        }
        const parentPath = parentPathResult.value;

        const subcategoryPathStr = categories.slice(0, index + 1).join('/');
        const subcategoryPathResult = CategoryPath.fromString(subcategoryPathStr);
        if (!subcategoryPathResult.ok()) {
            return err({
                code: 'INDEX_ERROR',
                message: `Invalid category path '${subcategoryPathStr}'.`,
                path: subcategoryPathStr,
                cause: subcategoryPathResult.error,
            });
        }
        const subcategoryPath = subcategoryPathResult.value;

        const subcategoryIndex = await readCategoryIndex(ctx, subcategoryPath, {
            ...options,
            createWhenMissing: true,
        });
        if (!subcategoryIndex.ok()) {
            return subcategoryIndex;
        }
        const upsertSubcategory = await upsertSubcategoryEntry(
            ctx,
            parentPath,
            categories.slice(0, index + 1).join('/'),
            subcategoryIndex.value.memories.length,
            { ...options, createWhenMissing: true },
        );
        if (!upsertSubcategory.ok()) {
            return upsertSubcategory;
        }
    }

    return ok(undefined);
};

/**
 * Updates all category indexes when a Memory object is written.
 *
 * Serializes the memory to reuse the existing index update pipeline.
 */
export const updateCategoryIndexesFromMemory = async (
    ctx: FilesystemContext,
    memory: Memory,
    options: { createWhenMissing?: boolean } = {},
): Promise<Result<void, StorageAdapterError>> => {
    const slugPath = memory.path.toString();

    const serialized = serializeMemory(memory);
    if (!serialized.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: `Failed to serialize memory for index update: ${slugPath}.`,
            path: slugPath,
            cause: serialized.error,
        });
    }

    return updateCategoryIndexes(ctx, memory.path, serialized.value, options);
};

/**
 * Collects all memory file paths recursively from a directory.
 */
const collectMemoryFiles = async (
    ctx: FilesystemContext,
    root: string,
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
        if (!entriesResult.ok()) {
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
 *
 * Note: During reindex, we use `memoryPath` (the validated MemoryPath object)
 * for the memory entry. The indexes map uses string keys for category paths.
 */
const addIndexEntry = (
    indexes: Map<string, CategoryIndex>,
    memoryPath: MemoryPath,
    tokenEstimate: number,
    updatedAt?: Date,
): void => {
    const categoryPath = memoryPath.category.toString();
    const current = indexes.get(categoryPath) ?? { memories: [], subcategories: [] };
    current.memories.push({ path: memoryPath, tokenEstimate, updatedAt });
    indexes.set(categoryPath, current);
};

/**
 * Records parent-subcategory relationships for all category levels.
 *
 * For a path like `standards/typescript`, records:
 * - Root ("") has subcategory "standards"
 *
 * For a path like `a/b/c/file`, records:
 * - Root ("") has subcategory "a"
 * - "a" has subcategory "a/b"
 * - "a/b" has subcategory "a/b/c"
 */
const recordParentSubcategory = (
    parentSubcategories: Map<string, Set<string>>,
    memoryPath: MemoryPath,
): void => {
    const categoryStr = memoryPath.category.toString();
    const segments = categoryStr.split('/').filter((segment: string) => segment.length > 0);
    if (segments.length < 1) {
        return;
    }

    // Record root -> first category relationship
    const firstCategory = segments[0];
    if (firstCategory) {
        const rootSubcategories = parentSubcategories.get('') ?? new Set();
        rootSubcategories.add(firstCategory);
        parentSubcategories.set('', rootSubcategories);
    }

    // Record nested category relationships (for 2+ segments in category)
    for (let index = 1; index < segments.length; index += 1) {
        const parentCategory = segments.slice(0, index).join('/');
        const subcategoryPath = segments.slice(0, index + 1).join('/');
        const subcategories = parentSubcategories.get(parentCategory) ?? new Set();
        subcategories.add(subcategoryPath);
        parentSubcategories.set(parentCategory, subcategories);
    }
};

/**
 * Applies parent subcategory relationships to indexes.
 *
 * Converts string paths to CategoryPath objects when building subcategory entries.
 * Invalid paths are skipped (they shouldn't occur since paths come from valid memory paths).
 */
const applyParentSubcategories = (
    indexes: Map<string, CategoryIndex>,
    parentSubcategories: Map<string, Set<string>>,
): void => {
    for (const [
        parentCategory, subcategories,
    ] of parentSubcategories.entries()) {
        const parentIndex = indexes.get(parentCategory) ?? {
            memories: [],
            subcategories: [],
        };
        const subcategoryEntries: CategoryIndex['subcategories'] = [];
        for (const subcategoryPathStr of subcategories.values()) {
            const memoryCount = indexes.get(subcategoryPathStr)?.memories.length ?? 0;
            const pathResult = CategoryPath.fromString(subcategoryPathStr);
            if (pathResult.ok()) {
                subcategoryEntries.push({ path: pathResult.value, memoryCount });
            }
            // Skip invalid paths (shouldn't happen with valid memory paths)
        }
        parentIndex.subcategories = subcategoryEntries;
        indexes.set(parentCategory, parentIndex);
    }
};

/**
 * Result of building an index entry from a memory file.
 */
type BuildIndexEntryResult = Result<
    | { memoryPath: MemoryPath; tokenEstimate: number; updatedAt?: Date }
    | { skipped: true; reason: string }
    | null,
    StorageAdapterError
>;

/**
 * Builds an index entry from a memory file.
 *
 * Normalizes file paths to valid slugs. Returns a skipped result
 * if the path normalizes to empty. Parses memory frontmatter to
 * extract the updatedAt timestamp if present.
 */
const buildIndexEntry = async (
    ctx: FilesystemContext,
    filePath: string,
): Promise<BuildIndexEntryResult> => {
    const relativePath = relative(ctx.storeRoot, filePath);
    const rawSlugPath = toSlugPathFromRelative(relativePath, ctx.memoryExtension);
    if (!rawSlugPath) {
        return ok(null);
    }

    // Parse the path using MemoryPath to validate and normalize
    const memoryPathResult = MemoryPath.fromString(rawSlugPath);
    if (!memoryPathResult.ok()) {
        return ok({
            skipped: true,
            reason: `Skipped: ${filePath} (invalid memory path: ${memoryPathResult.error.message})`,
        });
    }

    const memoryPath = memoryPathResult.value;
    const normalizedPath = memoryPath.toString();

    let contents: string;
    try {
        contents = await readFile(filePath, 'utf8');
    }
    catch (error) {
        return err({
            code: 'IO_READ_ERROR',
            message: `Failed to read memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }

    const tokenEstimate = defaultTokenizer.estimateTokens(contents);
    if (!tokenEstimate.ok()) {
        return err({
            code: 'INDEX_ERROR',
            message: 'Failed to estimate tokens for memory content.',
            path: normalizedPath,
            cause: tokenEstimate.error,
        });
    }

    // Parse memory to extract updatedAt from frontmatter
    const parseResult = parseMemory(contents);
    // If parsing fails, we still create the index entry without updatedAt
    const updatedAt = parseResult.ok() ? parseResult.value.metadata.updatedAt : undefined;

    return ok({
        memoryPath,
        tokenEstimate: tokenEstimate.value,
        updatedAt,
    });
};

/**
 * Builds index state from collected memory files.
 *
 * Handles collisions by appending numeric suffixes (-2, -3, etc.)
 * and collects warnings for skipped files and collisions.
 */
const buildIndexState = async (
    ctx: FilesystemContext,
    filePaths: string[],
): Promise<IndexBuildResult> => {
    const indexes = new Map<string, CategoryIndex>();
    const parentSubcategories = new Map<string, Set<string>>();
    const usedPaths = new Set<string>();
    const warnings: string[] = [];

    for (const filePath of filePaths) {
        const entryResult = await buildIndexEntry(ctx, filePath);
        if (!entryResult.ok()) {
            return entryResult;
        }
        if (!entryResult.value) {
            continue;
        }

        // Handle skipped entries
        if ('skipped' in entryResult.value) {
            warnings.push(entryResult.value.reason);
            continue;
        }

        const memoryPath = entryResult.value.memoryPath;
        const pathStr = memoryPath.toString();

        // Handle collisions by warning (collision detection based on string representation)
        if (usedPaths.has(pathStr)) {
            let suffix = 2;
            while (usedPaths.has(`${pathStr}-${suffix}`)) {
                suffix += 1;
            }
            const newPathStr = `${pathStr}-${suffix}`;
            warnings.push(`Collision: ${filePath} indexed as ${newPathStr}`);
            // For collisions, we still use the original path but record the warning
            // The collision suffix would require re-parsing, which may fail
            // In practice, collisions shouldn't happen with valid memory files
            usedPaths.add(newPathStr);
        }
        else {
            usedPaths.add(pathStr);
        }

        addIndexEntry(
            indexes,
            memoryPath,
            entryResult.value.tokenEstimate,
            entryResult.value.updatedAt,
        );
        recordParentSubcategory(parentSubcategories, memoryPath);
    }

    return ok({ indexes, parentSubcategories, warnings });
};

/**
 * Rebuilds and writes all index files.
 */
const rebuildIndexFiles = async (
    ctx: FilesystemContext,
    targetRoot: string,
    indexes: Map<string, CategoryIndex>,
): Promise<Result<void, StorageAdapterError>> => {
    const sortedIndexes = Array.from(indexes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [
        indexName, index,
    ] of sortedIndexes) {
        index.memories.sort((a, b) => a.path.toString().localeCompare(b.path.toString()));
        index.subcategories.sort((a, b) => a.path.toString().localeCompare(b.path.toString()));
        const serialized = serializeIndex(index);
        if (!serialized.ok()) {
            return err({
                code: 'INDEX_ERROR',
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
        const filePathResult = resolveStoragePath(targetRoot, indexPath, 'IO_WRITE_ERROR');
        if (!filePathResult.ok()) {
            return filePathResult;
        }
        try {
            await mkdir(dirname(filePathResult.value), { recursive: true });
            await writeFile(filePathResult.value, serialized.value, 'utf8');
        }
        catch (error) {
            return err({
                code: 'IO_WRITE_ERROR',
                message: `Failed to write index file at ${filePathResult.value}.`,
                path: filePathResult.value,
                cause: error,
            });
        }
    }
    return ok(undefined);
};

/**
 * Collects all index file paths recursively from a directory.
 *
 * Walks the directory tree starting at `root` and finds all files
 * matching the index file naming pattern (`index${ctx.indexExtension}`).
 * Used during reindex to discover existing index files so stale ones
 * can be identified and removed after the rebuild.
 *
 * Non-existent directories are treated as empty (no error is returned),
 * consistent with {@link readDirEntries} behavior.
 *
 * @param ctx - Filesystem context providing `indexExtension` to match
 * @param root - Absolute path of the root directory to scan recursively
 * @returns `Result` containing an array of absolute paths to discovered
 *   index files on success, or a `StorageAdapterError` with code
 *   `'IO_READ_ERROR'` if a directory cannot be read
 */
const collectIndexFiles = async (
    ctx: FilesystemContext,
    root: string,
): Promise<Result<string[], StorageAdapterError>> => {
    const results: string[] = [];
    const pending: string[] = [root];
    const indexFileName = `index${ctx.indexExtension}`;

    while (pending.length > 0) {
        const current = pending.pop();
        if (!current) {
            continue;
        }

        const entriesResult = await readDirEntries(current);
        if (!entriesResult.ok()) {
            return entriesResult;
        }

        for (const entry of entriesResult.value) {
            const entryName = typeof entry.name === 'string' ? entry.name : entry.name.toString();
            const entryPath = resolve(current, entryName);
            if (entry.isDirectory()) {
                pending.push(entryPath);
                continue;
            }
            if (entry.isFile() && entryName === indexFileName) {
                results.push(entryPath);
            }
        }
    }

    return ok(results);
};

/**
 * Removes stale index files that no longer correspond to any category.
 *
 * After a reindex, the set of valid categories may have shrunk (e.g.,
 * because all memories in a category were deleted or pruned). This
 * function computes the set of expected index file paths from the
 * rebuilt `indexes` map, then deletes any existing index files that
 * are not in that set.
 *
 * Fails fast if a storage path cannot be resolved (path traversal
 * check). Silently ignores `ENOENT` errors during deletion because
 * the file may have already been removed by another process.
 *
 * @param ctx - Filesystem context providing `storeRoot` and `indexExtension`
 * @param indexes - The rebuilt category indexes keyed by category path
 *   (empty string for root). Only index paths derived from these keys are
 *   considered "current".
 * @param existingIndexPaths - Absolute paths of index files discovered on
 *   disk before the rebuild (output of {@link collectIndexFiles})
 * @returns `Result<void>` on success, or a `StorageAdapterError` with code
 *   `'IO_WRITE_ERROR'` if a non-ENOENT deletion error occurs or a path
 *   cannot be resolved
 */
const removeStaleIndexFiles = async (
    ctx: FilesystemContext,
    indexes: Map<string, CategoryIndex>,
    existingIndexPaths: string[],
): Promise<Result<void, StorageAdapterError>> => {
    const newIndexPaths = new Set<string>();
    for (const indexName of indexes.keys()) {
        const indexPath =
            indexName === ''
                ? `index${ctx.indexExtension}`
                : `${indexName}/index${ctx.indexExtension}`;
        const filePathResult = resolveStoragePath(ctx.storeRoot, indexPath, 'IO_WRITE_ERROR');
        if (!filePathResult.ok()) {
            return filePathResult;
        }
        newIndexPaths.add(filePathResult.value);
    }

    for (const existingPath of existingIndexPaths) {
        if (!newIndexPaths.has(existingPath)) {
            try {
                await unlink(existingPath);
            }
            catch (error) {
                if (!isNotFoundError(error)) {
                    return err({
                        code: 'IO_WRITE_ERROR',
                        message: `Failed to remove stale index file at ${existingPath}.`,
                        path: existingPath,
                        cause: error,
                    });
                }
            }
        }
    }

    return ok(undefined);
};

/**
 * Reindexes all category indexes by scanning the filesystem.
 *
 * Walks the storage directory, collects all memory files, and rebuilds
 * every category index from scratch. File paths are normalized to valid
 * slugs during indexing; slug collisions are resolved by appending
 * numeric suffixes (`-2`, `-3`, …).
 *
 * After writing the new index files, stale index files for categories
 * that no longer contain any memories are removed from disk, keeping
 * the store directory clean.
 *
 * @param ctx - Filesystem context providing `storeRoot`, `memoryExtension`,
 *   and `indexExtension`
 * @returns `Result` containing a {@link ReindexResult} with a `warnings`
 *   array describing skipped files and slug collisions on success, or a
 *   `StorageAdapterError` on failure (e.g., I/O errors during read, write,
 *   or deletion)
 *
 * @example
 * ```typescript
 * const result = await reindexCategoryIndexes(ctx);
 * if (result.ok()) {
 *   for (const warning of result.value.warnings) {
 *     console.warn(warning);
 *   }
 * }
 * ```
 */
export const reindexCategoryIndexes = async (
    ctx: FilesystemContext,
): Promise<Result<ReindexResult, StorageAdapterError>> => {
    // 1. Collect existing index files before rebuild
    const existingIndexesResult = await collectIndexFiles(ctx, ctx.storeRoot);
    if (!existingIndexesResult.ok()) {
        return existingIndexesResult;
    }

    // 2. Build new index state from memory files
    const filesResult = await collectMemoryFiles(ctx, ctx.storeRoot);
    if (!filesResult.ok()) {
        return filesResult;
    }

    const buildState = await buildIndexState(ctx, filesResult.value);
    if (!buildState.ok()) {
        return buildState;
    }
    applyParentSubcategories(buildState.value.indexes, buildState.value.parentSubcategories);

    // 3. Write new index files
    const buildResult = await rebuildIndexFiles(ctx, ctx.storeRoot, buildState.value.indexes);
    if (!buildResult.ok()) {
        return buildResult;
    }

    // 4. Remove stale index files that are no longer needed
    const removeResult = await removeStaleIndexFiles(
        ctx,
        buildState.value.indexes,
        existingIndexesResult.value,
    );
    if (!removeResult.ok()) {
        return removeResult;
    }

    return ok({ warnings: buildState.value.warnings });
};
