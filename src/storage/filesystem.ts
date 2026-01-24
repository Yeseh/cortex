/**
 * Filesystem storage adapter implementation
 */

import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { MemorySlugPath, Result } from "../core/types.ts";
import { defaultTokenizer } from "../core/tokens.ts";
import type { CategoryIndex, IndexMemoryEntry } from "../index/types.ts";
import { parseCategoryIndex, serializeCategoryIndex } from "../index/parser.ts";
import { validateMemorySlugPath } from "../memory/validation.ts";
import type {
  StorageAdapter,
  StorageAdapterError,
  StorageIndexName,
} from "./adapter.ts";

export interface FilesystemStorageAdapterOptions {
  rootDirectory: string;
  memoryDirectory?: string;
  indexDirectory?: string;
  memoryExtension?: string;
  indexExtension?: string;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const normalizeExtension = (value: string | undefined, fallback: string): string => {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }
  return raw.startsWith(".") ? raw : `.${raw}`;
};

const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return (error as { code?: string }).code === "ENOENT";
};

const resolveStoragePath = (
  root: string,
  relativePath: string,
  errorCode: StorageAdapterError["code"]
): Result<string, StorageAdapterError> => {
  const resolved = resolve(root, relativePath);
  const rootRelative = relative(root, resolved);
  if (rootRelative.startsWith("..") || isAbsolute(rootRelative)) {
    return err({
      code: errorCode,
      message: `Path escapes storage root: ${relativePath}.`,
      path: resolved,
    });
  }

  return ok(resolved);
};

const toSlugPathFromRelative = (
  relativePath: string,
  extension: string
): string | null => {
  if (!relativePath || relativePath.startsWith("..")) {
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
    .join("/");
  return slugPath.length > 0 ? slugPath : null;
};

interface IndexBuildState {
  indexes: Map<string, CategoryIndex>;
  parentSubcategories: Map<string, Set<string>>;
}

export class FilesystemStorageAdapter implements StorageAdapter {
  private readonly memoryRoot: string;
  private readonly indexRoot: string;
  private readonly memoryExtension: string;
  private readonly indexExtension: string;

  constructor(options: FilesystemStorageAdapterOptions) {
    const root = resolve(options.rootDirectory);
    this.memoryRoot = resolve(root, options.memoryDirectory ?? "memories");
    this.indexRoot = resolve(root, options.indexDirectory ?? "indexes");
    this.memoryExtension = normalizeExtension(options.memoryExtension, ".md");
    this.indexExtension = normalizeExtension(options.indexExtension, ".yml");
  }

  private async readCategoryIndex(
    name: StorageIndexName
  ): Promise<Result<CategoryIndex, StorageAdapterError>> {
    const contents = await this.readIndexFile(name);
    if (!contents.ok) {
      return contents;
    }
    if (!contents.value) {
      return ok({ memories: [], subcategories: [] });
    }
    const parsed = parseCategoryIndex(contents.value);
    if (!parsed.ok) {
      return err({
        code: "INDEX_UPDATE_FAILED",
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
        code: "INDEX_UPDATE_FAILED",
        message: `Failed to serialize category index at ${name}.`,
        path: name,
        cause: serialized.error,
      });
    }
    return this.writeIndexFile(name, serialized.value);
  }

  private async upsertMemoryEntry(
    indexName: StorageIndexName,
    entry: IndexMemoryEntry
  ): Promise<Result<void, StorageAdapterError>> {
    const current = await this.readCategoryIndex(indexName);
    if (!current.ok) {
      return current;
    }
    const memories = current.value.memories.filter(
      (existing) => existing.path !== entry.path
    );
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
    memoryCount: number
  ): Promise<Result<void, StorageAdapterError>> {
    const current = await this.readCategoryIndex(indexName);
    if (!current.ok) {
      return current;
    }
    const subcategories = current.value.subcategories.filter(
      (existing) => existing.path !== entryPath
    );
    subcategories.push({ path: entryPath, memoryCount });
    subcategories.sort((a, b) => a.path.localeCompare(b.path));
    const nextIndex: CategoryIndex = {
      memories: current.value.memories,
      subcategories,
    };
    return this.writeCategoryIndex(indexName, nextIndex);
  }

  private async updateCategoryIndexes(
    slugPath: MemorySlugPath,
    contents: string
  ): Promise<Result<void, StorageAdapterError>> {
    const identity = validateMemorySlugPath(slugPath);
    if (!identity.ok) {
      return err({
        code: "INDEX_UPDATE_FAILED",
        message: "Invalid memory slug path.",
        path: slugPath,
        cause: identity.error,
      });
    }
    const categories = identity.value.categories;
    const categoryIndexName = categories.join("/");

    const tokenEstimateResult = defaultTokenizer.estimateTokens(contents);
    if (!tokenEstimateResult.ok) {
      return err({
        code: "INDEX_UPDATE_FAILED",
        message: "Failed to estimate tokens for memory content.",
        path: slugPath,
        cause: tokenEstimateResult.error,
      });
    }

    const upsertMemory = await this.upsertMemoryEntry(categoryIndexName, {
      path: slugPath,
      tokenEstimate: tokenEstimateResult.value,
    });
    if (!upsertMemory.ok) {
      return upsertMemory;
    }

    for (let index = 1; index <= categories.length - 1; index += 1) {
      const parentIndexName = categories.slice(0, index).join("/");
      const subcategoryPath = categories.slice(0, index + 1).join("/");
      const subcategoryIndex = await this.readCategoryIndex(subcategoryPath);
      if (!subcategoryIndex.ok) {
        return subcategoryIndex;
      }
      const upsertSubcategory = await this.upsertSubcategoryEntry(
        parentIndexName,
        subcategoryPath,
        subcategoryIndex.value.memories.length
      );
      if (!upsertSubcategory.ok) {
        return upsertSubcategory;
      }
    }

    return ok(undefined);
  }

  private async collectMemoryFiles(
    root: string
  ): Promise<Result<string[], StorageAdapterError>> {
    const results: string[] = [];
    const pending: string[] = [root];

    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) {
        continue;
      }
      let entries: Awaited<ReturnType<typeof readdir>>;
      try {
        entries = (await readdir(current, {
          withFileTypes: true,
        })) as unknown as Awaited<ReturnType<typeof readdir>>;
      } catch (error) {
        if (isNotFoundError(error)) {
          return ok([]);
        }
        return err({
          code: "READ_FAILED",
          message: `Failed to read memory directory at ${current}.`,
          path: current,
          cause: error,
        });
      }

      for (const entry of entries) {
        const entryName =
          typeof entry.name === "string" ? entry.name : entry.name.toString();
        const entryPath = resolve(current, entryName);
        if (entry.isDirectory()) {
          pending.push(entryPath);
        } else if (entry.isFile()) {
          results.push(entryPath);
        }
      }
    }

    return ok(results);
  }

  private addIndexEntry(
    indexes: Map<string, CategoryIndex>,
    slugPath: MemorySlugPath,
    tokenEstimate: number
  ): void {
    const categoryPath = slugPath.split("/").slice(0, -1).join("/");
    const current = indexes.get(categoryPath) ?? { memories: [], subcategories: [] };
    current.memories.push({ path: slugPath, tokenEstimate });
    indexes.set(categoryPath, current);
  }

  private recordParentSubcategory(
    parentSubcategories: Map<string, Set<string>>,
    slugPath: MemorySlugPath
  ): void {
    const segments = slugPath.split("/").filter((segment) => segment.length > 0);
    if (segments.length <= 2) {
      return;
    }
    for (let index = 1; index < segments.length - 1; index += 1) {
      const parentCategory = segments.slice(0, index).join("/");
      const subcategoryPath = segments.slice(0, index + 1).join("/");
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
      const subcategoryEntries: CategoryIndex["subcategories"] = [];
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
    const relativePath = relative(this.memoryRoot, filePath);
    const slugPath = toSlugPathFromRelative(relativePath, this.memoryExtension);
    if (!slugPath) {
      return ok(null);
    }
    const identity = validateMemorySlugPath(slugPath);
    if (!identity.ok) {
      return err({
        code: "INDEX_UPDATE_FAILED",
        message: `Invalid memory slug path for ${filePath}.`,
        path: filePath,
        cause: identity.error,
      });
    }
    let contents: string;
    try {
      contents = await readFile(filePath, "utf8");
    } catch (error) {
      return err({
        code: "READ_FAILED",
        message: `Failed to read memory file at ${filePath}.`,
        path: filePath,
        cause: error,
      });
    }
    const tokenEstimate = defaultTokenizer.estimateTokens(contents);
    if (!tokenEstimate.ok) {
      return err({
        code: "INDEX_UPDATE_FAILED",
        message: "Failed to estimate tokens for memory content.",
        path: identity.value.slugPath,
        cause: tokenEstimate.error,
      });
    }
    return ok({ slugPath: identity.value.slugPath, tokenEstimate: tokenEstimate.value });
  }

  private async buildIndexState(
    filePaths: string[]
  ): Promise<Result<IndexBuildState, StorageAdapterError>> {
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
      this.addIndexEntry(indexes, entryResult.value.slugPath, entryResult.value.tokenEstimate);
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
          code: "INDEX_UPDATE_FAILED",
          message: `Failed to serialize category index at ${indexName}.`,
          path: indexName,
          cause: serialized.error,
        });
      }
      const filePathResult = resolveStoragePath(
        targetRoot,
        `${indexName}${this.indexExtension}`,
        "WRITE_FAILED"
      );
      if (!filePathResult.ok) {
        return filePathResult;
      }
      try {
        await mkdir(dirname(filePathResult.value), { recursive: true });
        await writeFile(filePathResult.value, serialized.value, "utf8");
      } catch (error) {
        return err({
          code: "WRITE_FAILED",
          message: `Failed to write index file at ${filePathResult.value}.`,
          path: filePathResult.value,
          cause: error,
        });
      }
    }
    return ok(undefined);
  }

  private async buildTempIndexRoot(): Promise<Result<string, StorageAdapterError>> {
    const baseRoot = dirname(this.indexRoot);
    const tempRoot = join(baseRoot, `indexes.tmp-${Date.now()}`);
    try {
      await mkdir(tempRoot, { recursive: true });
      return ok(tempRoot);
    } catch (error) {
      return err({
        code: "WRITE_FAILED",
        message: `Failed to create temporary index directory at ${tempRoot}.`,
        path: tempRoot,
        cause: error,
      });
    }
  }

  private async replaceIndexDirectory(
    tempRoot: string
  ): Promise<Result<void, StorageAdapterError>> {
    const backupRoot = join(dirname(this.indexRoot), `indexes.backup-${Date.now()}`);
    try {
      await rm(backupRoot, { recursive: true, force: true });
      await rename(this.indexRoot, backupRoot);
    } catch (error) {
      if (!isNotFoundError(error)) {
        return err({
          code: "WRITE_FAILED",
          message: `Failed to move existing index directory at ${this.indexRoot}.`,
          path: this.indexRoot,
          cause: error,
        });
      }
    }
    try {
      await rename(tempRoot, this.indexRoot);
    } catch (error) {
      return err({
        code: "WRITE_FAILED",
        message: `Failed to finalize index directory at ${this.indexRoot}.`,
        path: this.indexRoot,
        cause: error,
      });
    }
    try {
      await rm(backupRoot, { recursive: true, force: true });
    } catch (error) {
      return err({
        code: "WRITE_FAILED",
        message: `Failed to cleanup backup index directory at ${backupRoot}.`,
        path: backupRoot,
        cause: error,
      });
    }
    return ok(undefined);
  }

  async readMemoryFile(
    slugPath: MemorySlugPath
  ): Promise<Result<string | null, StorageAdapterError>> {
    const filePathResult = resolveStoragePath(
      this.memoryRoot,
      `${slugPath}${this.memoryExtension}`,
      "READ_FAILED"
    );
    if (!filePathResult.ok) {
      return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
      const contents = await readFile(filePath, "utf8");
      return ok(contents);
    } catch (error) {
      if (isNotFoundError(error)) {
        return ok(null);
      }
      return err({
        code: "READ_FAILED",
        message: `Failed to read memory file at ${filePath}.`,
        path: filePath,
        cause: error,
      });
    }
  }

  async writeMemoryFile(
    slugPath: MemorySlugPath,
    contents: string
  ): Promise<Result<void, StorageAdapterError>> {
    const identity = validateMemorySlugPath(slugPath);
    if (!identity.ok) {
      return err({
        code: "WRITE_FAILED",
        message: "Invalid memory slug path.",
        path: slugPath,
        cause: identity.error,
      });
    }
    const filePathResult = resolveStoragePath(
      this.memoryRoot,
      `${slugPath}${this.memoryExtension}`,
      "WRITE_FAILED"
    );
    if (!filePathResult.ok) {
      return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
      const indexUpdate = await this.updateCategoryIndexes(slugPath, contents);
      if (!indexUpdate.ok) {
        return indexUpdate;
      }
      return ok(undefined);
    } catch (error) {
      return err({
        code: "WRITE_FAILED",
        message: `Failed to write memory file at ${filePath}.`,
        path: filePath,
        cause: error,
      });
    }
  }

  async readIndexFile(
    name: StorageIndexName
  ): Promise<Result<string | null, StorageAdapterError>> {
    const filePathResult = resolveStoragePath(
      this.indexRoot,
      `${name}${this.indexExtension}`,
      "READ_FAILED"
    );
    if (!filePathResult.ok) {
      return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
      const contents = await readFile(filePath, "utf8");
      return ok(contents);
    } catch (error) {
      if (isNotFoundError(error)) {
        return ok(null);
      }
      return err({
        code: "READ_FAILED",
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
    const filePathResult = resolveStoragePath(
      this.indexRoot,
      `${name}${this.indexExtension}`,
      "WRITE_FAILED"
    );
    if (!filePathResult.ok) {
      return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
      return ok(undefined);
    } catch (error) {
      return err({
        code: "WRITE_FAILED",
        message: `Failed to write index file at ${filePath}.`,
        path: filePath,
        cause: error,
      });
    }
  }

  async reindexCategoryIndexes(): Promise<Result<void, StorageAdapterError>> {
    const filesResult = await this.collectMemoryFiles(this.memoryRoot);
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

    const tempRootResult = await this.buildTempIndexRoot();
    if (!tempRootResult.ok) {
      return tempRootResult;
    }

    const buildResult = await this.rebuildIndexFiles(
      tempRootResult.value,
      buildState.value.indexes
    );
    if (!buildResult.ok) {
      await rm(tempRootResult.value, { recursive: true, force: true });
      return buildResult;
    }

    const swapResult = await this.replaceIndexDirectory(tempRootResult.value);
    if (!swapResult.ok) {
      await rm(tempRootResult.value, { recursive: true, force: true });
      return swapResult;
    }

    return ok(undefined);
  }
}
