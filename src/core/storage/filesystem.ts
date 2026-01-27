/**
 * Filesystem storage adapter implementation
 */

import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { MemoryIdentity, MemorySlugPath, Result } from '../types.ts';
import { defaultTokenizer } from '../tokens.ts';
import type { CategoryIndex, IndexMemoryEntry } from '../index/types.ts';
import { parseCategoryIndex, serializeCategoryIndex } from '../index/parser.ts';
import { validateMemorySlugPath } from '../memory/validation.ts';
import type { StorageAdapter, StorageAdapterError, StorageIndexName } from './adapter.ts';
import type { CategoryError } from '../category/types.ts';

export interface FilesystemStorageAdapterOptions {
    rootDirectory: string;
    memoryExtension?: string;
    indexExtension?: string;
}

type DirEntriesResult = Result<Awaited<ReturnType<typeof readdir>>, StorageAdapterError>;
type IndexBuildResult = Result<IndexBuildState, StorageAdapterError>;
type StringOrNullResult = Result<string | null, StorageAdapterError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const toCategoryError = (
    code: CategoryError['code'],
    message: string,
    path: string,
    cause?: unknown
): CategoryError => ({ code, message, path, cause });

const normalizeExtension = (value: string | undefined, fallback: string): string => {
    const raw = value?.trim();
    if (!raw) {
        return fallback;
    }
    return raw.startsWith('.') ? raw : `.${raw}`;
};

const isNotFoundError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object' || !('code' in error)) {
        return false;
    }
    return (error as { code?: string }).code === 'ENOENT';
};

const resolveStoragePath = (
    root: string,
    relativePath: string,
    errorCode: StorageAdapterError['code']
): Result<string, StorageAdapterError> => {
    const resolved = resolve(root, relativePath);
    const rootRelative = relative(root, resolved);
    if (rootRelative.startsWith('..') || isAbsolute(rootRelative)) {
        return err({
            code: errorCode,
            message: `Path escapes storage root: ${relativePath}.`,
            path: resolved,
        });
    }

    return ok(resolved);
};

const toSlugPathFromRelative = (relativePath: string, extension: string): string | null => {
    if (!relativePath || relativePath.startsWith('..')) {
        return null;
    }
    if (extname(relativePath) !== extension) {
        return null;
    }
    const withoutExtension = relativePath.slice(0, -extension.length);
    const slugPath = withoutExtension
        .split(sep)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .join('/');
    return slugPath.length > 0 ? slugPath : null;
};

interface IndexBuildState {
    indexes: Map<string, CategoryIndex>;
    parentSubcategories: Map<string, Set<string>>;
}

export class FilesystemStorageAdapter implements StorageAdapter {
    private readonly storeRoot: string;
    private readonly memoryExtension: string;
    private readonly indexExtension: string;

    constructor(options: FilesystemStorageAdapterOptions) {
        this.storeRoot = resolve(options.rootDirectory);
        this.memoryExtension = normalizeExtension(options.memoryExtension, '.md');
        this.indexExtension = normalizeExtension(options.indexExtension, '.yaml');
    }

    private validateSlugPath(
        slugPath: string,
        failure: { code: StorageAdapterError['code']; message: string; path: string }
    ): Result<MemoryIdentity, StorageAdapterError> {
        const identity = validateMemorySlugPath(slugPath);
        if (!identity.ok) {
            return err({ ...failure, cause: identity.error });
        }
        // Prevent 'index' as memory slug to avoid collision with index files
        if (identity.value.slug === 'index') {
            return err({
                ...failure,
                message: 'Memory slug "index" is reserved for index files.',
            });
        }
        return ok(identity.value);
    }

    private resolveMemoryPath(
        slugPath: MemorySlugPath,
        errorCode: StorageAdapterError['code']
    ): Result<string, StorageAdapterError> {
        return resolveStoragePath(this.storeRoot, `${slugPath}${this.memoryExtension}`, errorCode);
    }

    private resolveIndexPath(
        name: StorageIndexName,
        errorCode: StorageAdapterError['code']
    ): Result<string, StorageAdapterError> {
        // Category indexes are at: STORE_ROOT/<categoryPath>/index.yaml
        // For root category (empty string): STORE_ROOT/index.yaml
        const indexPath =
            name === '' ? `index${this.indexExtension}` : `${name}/index${this.indexExtension}`;
        return resolveStoragePath(this.storeRoot, indexPath, errorCode);
    }

    private async readDirEntries(current: string): Promise<DirEntriesResult> {
        try {
            return ok(
                (await readdir(current, {
                    withFileTypes: true,
                })) as unknown as Awaited<ReturnType<typeof readdir>>
            );
        } catch (error) {
            if (isNotFoundError(error)) {
                return ok([] as unknown as Awaited<ReturnType<typeof readdir>>);
            }
            return err({
                code: 'READ_FAILED',
                message: `Failed to read memory directory at ${current}.`,
                path: current,
                cause: error,
            });
        }
    }

    private async readCategoryIndex(
        name: StorageIndexName,
        options: { createWhenMissing?: boolean } = {}
    ): Promise<Result<CategoryIndex, StorageAdapterError>> {
        const contents = await this.readIndexFile(name);
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
        const parsed = parseCategoryIndex(contents.value);
        if (!parsed.ok) {
            return err({
                code: 'INDEX_UPDATE_FAILED',
                message: `Failed to parse category index at ${name}.`,
                path: name,
                cause: parsed.error,
            });
        }
        return ok(parsed.value);
    }

    private async writeCategoryIndex(
        name: StorageIndexName,
        index: CategoryIndex
    ): Promise<Result<void, StorageAdapterError>> {
        const serialized = serializeCategoryIndex(index);
        if (!serialized.ok) {
            return err({
                code: 'INDEX_UPDATE_FAILED',
                message: `Failed to serialize category index at ${name}.`,
                path: name,
                cause: serialized.error,
            });
        }
        return this.writeIndexFile(name, serialized.value);
    }

    private async upsertMemoryEntry(
        indexName: StorageIndexName,
        entry: IndexMemoryEntry,
        options: { createWhenMissing?: boolean } = {}
    ): Promise<Result<void, StorageAdapterError>> {
        const current = await this.readCategoryIndex(indexName, options);
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
        return this.writeCategoryIndex(indexName, nextIndex);
    }

    private async upsertSubcategoryEntry(
        indexName: StorageIndexName,
        entryPath: string,
        memoryCount: number,
        options: { createWhenMissing?: boolean } = {}
    ): Promise<Result<void, StorageAdapterError>> {
        const current = await this.readCategoryIndex(indexName, options);
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
        return this.writeCategoryIndex(indexName, nextIndex);
    }

    private async updateCategoryIndexes(
        slugPath: MemorySlugPath,
        contents: string,
        options: { createWhenMissing?: boolean } = {}
    ): Promise<Result<void, StorageAdapterError>> {
        const identityResult = this.validateSlugPath(slugPath, {
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

        const upsertMemory = await this.upsertMemoryEntry(
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
            const topLevelCategoryIndex = await this.readCategoryIndex(topLevelCategory, {
                ...options,
                createWhenMissing: true,
            });
            if (!topLevelCategoryIndex.ok) {
                return topLevelCategoryIndex;
            }
            const upsertRoot = await this.upsertSubcategoryEntry(
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
            const subcategoryIndex = await this.readCategoryIndex(subcategoryPath, {
                ...options,
                createWhenMissing: true,
            });
            if (!subcategoryIndex.ok) {
                return subcategoryIndex;
            }
            const upsertSubcategory = await this.upsertSubcategoryEntry(
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
    }

    private async collectMemoryFiles(root: string): Promise<Result<string[], StorageAdapterError>> {
        const results: string[] = [];
        const pending: string[] = [root];
        let sawNotFoundRoot = false;

        while (pending.length > 0) {
            const current = pending.pop();
            if (!current) {
                continue;
            }

            const entriesResult = await this.readDirEntries(current);
            if (!entriesResult.ok) {
                return entriesResult;
            }

            if (entriesResult.value.length === 0 && current === root) {
                sawNotFoundRoot = true;
            }

            for (const entry of entriesResult.value) {
                const entryName =
                    typeof entry.name === 'string' ? entry.name : entry.name.toString();
                const entryPath = resolve(current, entryName);
                if (entry.isDirectory()) {
                    pending.push(entryPath);
                    continue;
                }
                // Only include memory files (with memory extension), skip index files
                if (entry.isFile() && extname(entryPath) === this.memoryExtension) {
                    results.push(entryPath);
                }
            }
        }

        if (results.length === 0 && sawNotFoundRoot) {
            return ok([]);
        }

        return ok(results);
    }

    private addIndexEntry(
        indexes: Map<string, CategoryIndex>,
        slugPath: MemorySlugPath,
        tokenEstimate: number
    ): void {
        const categoryPath = slugPath.split('/').slice(0, -1).join('/');
        const current = indexes.get(categoryPath) ?? { memories: [], subcategories: [] };
        current.memories.push({ path: slugPath, tokenEstimate });
        indexes.set(categoryPath, current);
    }

    private recordParentSubcategory(
        parentSubcategories: Map<string, Set<string>>,
        slugPath: MemorySlugPath
    ): void {
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
    }

    private applyParentSubcategories(
        indexes: Map<string, CategoryIndex>,
        parentSubcategories: Map<string, Set<string>>
    ): void {
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
    }

    private async buildIndexEntry(
        filePath: string
    ): Promise<
        Result<{ slugPath: MemorySlugPath; tokenEstimate: number } | null, StorageAdapterError>
    > {
        const relativePath = relative(this.storeRoot, filePath);
        const slugPath = toSlugPathFromRelative(relativePath, this.memoryExtension);
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
    }

    private async buildIndexState(filePaths: string[]): Promise<IndexBuildResult> {
        const indexes = new Map<string, CategoryIndex>();
        const parentSubcategories = new Map<string, Set<string>>();

        for (const filePath of filePaths) {
            const entryResult = await this.buildIndexEntry(filePath);
            if (!entryResult.ok) {
                return entryResult;
            }
            if (!entryResult.value) {
                continue;
            }
            this.addIndexEntry(
                indexes,
                entryResult.value.slugPath,
                entryResult.value.tokenEstimate
            );
            this.recordParentSubcategory(parentSubcategories, entryResult.value.slugPath);
        }

        return ok({ indexes, parentSubcategories });
    }

    private async rebuildIndexFiles(
        targetRoot: string,
        indexes: Map<string, CategoryIndex>
    ): Promise<Result<void, StorageAdapterError>> {
        const sortedIndexes = Array.from(indexes.entries()).sort((a, b) =>
            a[0].localeCompare(b[0])
        );
        for (const [indexName, index] of sortedIndexes) {
            index.memories.sort((a, b) => a.path.localeCompare(b.path));
            index.subcategories.sort((a, b) => a.path.localeCompare(b.path));
            const serialized = serializeCategoryIndex(index);
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
                    ? `index${this.indexExtension}`
                    : `${indexName}/index${this.indexExtension}`;
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
    }

    async reindexCategoryIndexes(): Promise<Result<void, StorageAdapterError>> {
        const filesResult = await this.collectMemoryFiles(this.storeRoot);
        if (!filesResult.ok) {
            return filesResult;
        }

        const buildState = await this.buildIndexState(filesResult.value);
        if (!buildState.ok) {
            return buildState;
        }
        this.applyParentSubcategories(
            buildState.value.indexes,
            buildState.value.parentSubcategories
        );

        // Write index files in-place to storeRoot
        const buildResult = await this.rebuildIndexFiles(this.storeRoot, buildState.value.indexes);
        if (!buildResult.ok) {
            return buildResult;
        }

        return ok(undefined);
    }

    async readMemoryFile(slugPath: MemorySlugPath): Promise<StringOrNullResult> {
        const filePathResult = this.resolveMemoryPath(slugPath, 'READ_FAILED');
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
                message: `Failed to read memory file at ${filePath}.`,
                path: filePath,
                cause: error,
            });
        }
    }

    async removeMemoryFile(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>> {
        const identityResult = this.validateSlugPath(slugPath, {
            code: 'WRITE_FAILED',
            message: 'Invalid memory slug path.',
            path: slugPath,
        });
        if (!identityResult.ok) {
            return identityResult;
        }

        const filePathResult = this.resolveMemoryPath(slugPath, 'WRITE_FAILED');
        if (!filePathResult.ok) {
            return filePathResult;
        }
        const filePath = filePathResult.value;
        try {
            await rm(filePath);
            return ok(undefined);
        } catch (error) {
            if (isNotFoundError(error)) {
                return ok(undefined);
            }
            return err({
                code: 'WRITE_FAILED',
                message: `Failed to remove memory file at ${filePath}.`,
                path: filePath,
                cause: error,
            });
        }
    }

    async moveMemoryFile(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>> {
        const sourceIdentityResult = this.validateSlugPath(sourceSlugPath, {
            code: 'WRITE_FAILED',
            message: 'Invalid source memory slug path.',
            path: sourceSlugPath,
        });
        if (!sourceIdentityResult.ok) {
            return sourceIdentityResult;
        }

        const destinationIdentityResult = this.validateSlugPath(destinationSlugPath, {
            code: 'WRITE_FAILED',
            message: 'Invalid destination memory slug path.',
            path: destinationSlugPath,
        });
        if (!destinationIdentityResult.ok) {
            return destinationIdentityResult;
        }

        const sourcePathResult = this.resolveMemoryPath(sourceSlugPath, 'WRITE_FAILED');
        if (!sourcePathResult.ok) {
            return sourcePathResult;
        }
        const destinationPathResult = this.resolveMemoryPath(destinationSlugPath, 'WRITE_FAILED');
        if (!destinationPathResult.ok) {
            return destinationPathResult;
        }
        const destinationDirectory = dirname(destinationPathResult.value);
        try {
            await access(destinationDirectory);
        } catch (error) {
            return err({
                code: 'WRITE_FAILED',
                message: `Destination category does not exist for ${destinationSlugPath}.`,
                path: destinationDirectory,
                cause: error,
            });
        }
        try {
            await rename(sourcePathResult.value, destinationPathResult.value);
            return ok(undefined);
        } catch (error) {
            return err({
                code: 'WRITE_FAILED',
                message: `Failed to move memory from ${sourceSlugPath} to ${destinationSlugPath}.`,
                path: destinationPathResult.value,
                cause: error,
            });
        }
    }

    async writeMemoryFile(
        slugPath: MemorySlugPath,
        contents: string,
        options: { allowIndexCreate?: boolean; allowIndexUpdate?: boolean } = {}
    ): Promise<Result<void, StorageAdapterError>> {
        const identityResult = this.validateSlugPath(slugPath, {
            code: 'WRITE_FAILED',
            message: 'Invalid memory slug path.',
            path: slugPath,
        });
        if (!identityResult.ok) {
            return identityResult;
        }

        const filePathResult = this.resolveMemoryPath(slugPath, 'WRITE_FAILED');
        if (!filePathResult.ok) {
            return filePathResult;
        }
        const filePath = filePathResult.value;

        try {
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, contents, 'utf8');
        } catch (error) {
            return err({
                code: 'WRITE_FAILED',
                message: `Failed to write memory file at ${filePath}.`,
                path: filePath,
                cause: error,
            });
        }

        if (options.allowIndexUpdate === false) {
            return ok(undefined);
        }

        const indexUpdate = await this.updateCategoryIndexes(slugPath, contents, {
            createWhenMissing: options.allowIndexCreate,
        });
        if (!indexUpdate.ok) {
            return indexUpdate;
        }

        return ok(undefined);
    }

    async readIndexFile(name: StorageIndexName): Promise<StringOrNullResult> {
        const filePathResult = this.resolveIndexPath(name, 'READ_FAILED');
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
    }

    async writeIndexFile(
        name: StorageIndexName,
        contents: string
    ): Promise<Result<void, StorageAdapterError>> {
        const filePathResult = this.resolveIndexPath(name, 'WRITE_FAILED');
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
    }

    // CategoryStoragePort implementation

    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        const dirPath = resolve(this.storeRoot, path);
        try {
            await access(dirPath);
            return ok(true);
        } catch {
            return ok(false);
        }
    }

    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        const dirPath = resolve(this.storeRoot, path);
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
    }

    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        const dirPath = resolve(this.storeRoot, path);
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
    }

    async updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, CategoryError>> {
        const indexName = parentPath === '' ? '' : parentPath;
        const currentResult = await this.readCategoryIndex(indexName, { createWhenMissing: true });
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
        const writeResult = await this.writeCategoryIndex(indexName, {
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
    }

    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>> {
        const indexName = parentPath === '' ? '' : parentPath;
        const currentResult = await this.readCategoryIndex(indexName, { createWhenMissing: false });

        if (!currentResult.ok) {
            // If we can't read the index, just return ok (nothing to remove)
            return ok(undefined);
        }

        const currentIndex = currentResult.value;
        const subcategories = currentIndex.subcategories.filter((s) => s.path !== subcategoryPath);

        const writeResult = await this.writeCategoryIndex(indexName, {
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
    }

    // Adapter methods for CategoryStoragePort interface
    async readCategoryIndexForPort(
        path: string
    ): Promise<Result<CategoryIndex | null, CategoryError>> {
        const result = await this.readCategoryIndex(path, { createWhenMissing: false });
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
    }

    async writeCategoryIndexForPort(
        path: string,
        index: CategoryIndex
    ): Promise<Result<void, CategoryError>> {
        const result = await this.writeCategoryIndex(path, index);
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
    }
}
