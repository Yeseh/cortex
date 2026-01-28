/**
 * CLI prune command for removing expired memories.
 */

import type { Result } from '../../core/types.ts';
import type { CategoryIndex } from '../../core/index/types.ts';
import { parseIndex } from '../../core/serialization.ts';
import { parseMemoryFile } from '../../core/memory/index.ts';
import type { StorageAdapterError } from '../../core/storage/adapter.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';

export interface PruneCommandOptions {
    storeRoot: string;
    args: string[];
    now?: Date;
}

export interface PrunedMemoryEntry {
    path: string;
    expiresAt: Date;
}

export interface PruneCommandOutput {
    message: string;
    pruned: PrunedMemoryEntry[];
}

export interface PruneCommandError {
    code: 'INVALID_ARGUMENTS' | 'READ_FAILED' | 'PARSE_FAILED' | 'DELETE_FAILED' | 'REINDEX_FAILED';
    message: string;
    cause?: StorageAdapterError | unknown;
}

type PruneCommandResult = Result<PruneCommandOutput, PruneCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

interface ParsedPruneArgs {
    dryRun: boolean;
}

const parsePruneArgs = (args: string[]): Result<ParsedPruneArgs, PruneCommandError> => {
    let dryRun = false;

    for (const value of args) {
        if (!value) {
            continue;
        }
        if (value === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (value.startsWith('-')) {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: `Unknown flag: ${value}.`,
            });
        }
        return err({
            code: 'INVALID_ARGUMENTS',
            message: 'Prune command does not accept positional arguments.',
        });
    }

    return ok({ dryRun });
};

const isExpired = (expiresAt: Date | undefined, now: Date): boolean => {
    if (!expiresAt) {
        return false;
    }
    return expiresAt.getTime() <= now.getTime();
};

const loadCategoryIndex = async (
    adapter: FilesystemStorageAdapter,
    categoryPath: string,
): Promise<Result<CategoryIndex | null, PruneCommandError>> => {
    const indexContents = await adapter.readIndexFile(categoryPath);
    if (!indexContents.ok) {
        return err({
            code: 'READ_FAILED',
            message: `Failed to read index for category ${categoryPath}.`,
            cause: indexContents.error,
        });
    }
    if (!indexContents.value) {
        return ok(null);
    }
    const parsed = parseIndex(indexContents.value);
    if (!parsed.ok) {
        return err({
            code: 'PARSE_FAILED',
            message: `Failed to parse index for category ${categoryPath}.`,
            cause: parsed.error,
        });
    }
    return ok(parsed.value);
};

const checkMemoryExpiry = async (
    adapter: FilesystemStorageAdapter,
    slugPath: string,
    now: Date,
): Promise<Result<{ expired: boolean; expiresAt?: Date }, PruneCommandError>> => {
    const contents = await adapter.readMemoryFile(slugPath);
    if (!contents.ok) {
        return err({
            code: 'READ_FAILED',
            message: `Failed to read memory file ${slugPath}.`,
            cause: contents.error,
        });
    }
    if (!contents.value) {
        return ok({ expired: false });
    }
    const parsed = parseMemoryFile(contents.value);
    if (!parsed.ok) {
        return err({
            code: 'PARSE_FAILED',
            message: `Failed to parse memory file ${slugPath}.`,
            cause: parsed.error,
        });
    }
    const expiresAt = parsed.value.frontmatter.expiresAt;
    return ok({ expired: isExpired(expiresAt, now), expiresAt });
};

const collectExpiredFromCategory = async (
    adapter: FilesystemStorageAdapter,
    categoryPath: string,
    now: Date,
    visited: Set<string>,
): Promise<Result<PrunedMemoryEntry[], PruneCommandError>> => {
    if (visited.has(categoryPath)) {
        return ok([]);
    }
    visited.add(categoryPath);

    const indexResult = await loadCategoryIndex(adapter, categoryPath);
    if (!indexResult.ok) {
        return indexResult;
    }
    if (!indexResult.value) {
        return ok([]);
    }

    const entries: PrunedMemoryEntry[] = [];

    for (const memory of indexResult.value.memories) {
        const expiryResult = await checkMemoryExpiry(adapter, memory.path, now);
        if (!expiryResult.ok) {
            return expiryResult;
        }
        if (expiryResult.value.expired && expiryResult.value.expiresAt) {
            entries.push({
                path: memory.path,
                expiresAt: expiryResult.value.expiresAt,
            });
        }
    }

    for (const subcategory of indexResult.value.subcategories) {
        const subResult = await collectExpiredFromCategory(adapter, subcategory.path, now, visited);
        if (!subResult.ok) {
            return subResult;
        }
        entries.push(...subResult.value);
    }

    return ok(entries);
};

const collectAllExpired = async (
    adapter: FilesystemStorageAdapter,
    now: Date,
): Promise<Result<PrunedMemoryEntry[], PruneCommandError>> => {
    const rootCategories = [
        'human',
        'persona',
        'project',
        'domain',
    ];
    const entries: PrunedMemoryEntry[] = [];
    const visited = new Set<string>();

    for (const category of rootCategories) {
        const result = await collectExpiredFromCategory(adapter, category, now, visited);
        if (!result.ok) {
            return result;
        }
        entries.push(...result.value);
    }

    return ok(entries);
};

const deleteExpiredMemories = async (
    adapter: FilesystemStorageAdapter,
    entries: PrunedMemoryEntry[],
): Promise<Result<void, PruneCommandError>> => {
    for (const entry of entries) {
        const removeResult = await adapter.removeMemoryFile(entry.path);
        if (!removeResult.ok) {
            return err({
                code: 'DELETE_FAILED',
                message: `Failed to delete memory ${entry.path}.`,
                cause: removeResult.error,
            });
        }
    }
    return ok(undefined);
};

export const runPruneCommand = async (
    options: PruneCommandOptions,
): Promise<PruneCommandResult> => {
    const parsed = parsePruneArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const now = options.now ?? new Date();
    const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });

    const expiredResult = await collectAllExpired(adapter, now);
    if (!expiredResult.ok) {
        return expiredResult;
    }

    const pruned = expiredResult.value;

    if (pruned.length === 0) {
        return ok({
            message: 'No expired memories found.',
            pruned: [],
        });
    }

    if (parsed.value.dryRun) {
        const paths = pruned.map((entry) => entry.path).join('\n  ');
        return ok({
            message: `Would prune ${pruned.length} expired memories:\n  ${paths}`,
            pruned,
        });
    }

    const deleteResult = await deleteExpiredMemories(adapter, pruned);
    if (!deleteResult.ok) {
        return deleteResult;
    }

    const reindexResult = await adapter.reindexCategoryIndexes();
    if (!reindexResult.ok) {
        return err({
            code: 'REINDEX_FAILED',
            message: 'Failed to reindex after pruning.',
            cause: reindexResult.error,
        });
    }

    const paths = pruned.map((entry) => entry.path).join('\n  ');
    return ok({
        message: `Pruned ${pruned.length} expired memories:\n  ${paths}`,
        pruned,
    });
};
