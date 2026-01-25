/**
 * CLI list command for browsing memories with optional filtering.
 */

import type { Result } from '../../core/types.ts';
import type { CategoryIndex } from '../../core/index/types.ts';
import { parseCategoryIndex } from '../../core/index/parser.ts';
import { parseMemoryFile } from '../../core/memory/file.ts';
import type { StorageAdapterError } from '../../core/storage/adapter.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';
import type { OutputFormat } from '../output.ts';
import { toonOptions } from '../output.ts';
import { encode as toonEncode } from '../toon.ts';

export interface ListCommandOptions {
    storeRoot: string;
    args: string[];
    now?: Date;
}

export interface ListMemoryEntry {
    path: string;
    tokenEstimate: number;
    summary?: string;
    expiresAt?: Date;
    isExpired: boolean;
}

export interface ListCommandOutput {
    message: string;
    memories: ListMemoryEntry[];
}

export interface ListCommandError {
    code: 'INVALID_ARGUMENTS' | 'READ_FAILED' | 'PARSE_FAILED' | 'SERIALIZE_FAILED';
    message: string;
    cause?: StorageAdapterError | unknown;
}

type ListCommandResult = Result<ListCommandOutput, ListCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

interface ParsedListArgs {
    category?: string;
    includeExpired: boolean;
    format: OutputFormat;
}

const parseListArgs = (args: string[]): Result<ParsedListArgs, ListCommandError> => {
    let category: string | undefined;
    let includeExpired = false;
    let format: OutputFormat = 'yaml';

    for (let index = 0; index < args.length; index += 1) {
        const value = args[index];
        if (!value) {
            continue;
        }
        if (value === '--include-expired') {
            includeExpired = true;
            continue;
        }
        if (value === '--format') {
            const next = args[index + 1];
            if (!next || (next !== 'yaml' && next !== 'json' && next !== 'toon')) {
                return err({
                    code: 'INVALID_ARGUMENTS',
                    message: "--format requires 'yaml', 'json', or 'toon'.",
                });
            }
            format = next;
            index += 1;
            continue;
        }
        if (value.startsWith('-')) {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: `Unknown flag: ${value}.`,
            });
        }
        if (category !== undefined) {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: 'Too many positional arguments for list command.',
            });
        }
        category = value;
    }

    return ok({ category, includeExpired, format });
};

const isExpired = (expiresAt: Date | undefined, now: Date): boolean => {
    if (!expiresAt) {
        return false;
    }
    return expiresAt.getTime() <= now.getTime();
};

const loadMemoryExpiry = async (
    adapter: FilesystemStorageAdapter,
    slugPath: string
): Promise<Result<Date | undefined, ListCommandError>> => {
    const contents = await adapter.readMemoryFile(slugPath);
    if (!contents.ok) {
        return err({
            code: 'READ_FAILED',
            message: `Failed to read memory file ${slugPath}.`,
            cause: contents.error,
        });
    }
    if (!contents.value) {
        return ok(undefined);
    }
    const parsed = parseMemoryFile(contents.value);
    if (!parsed.ok) {
        return err({
            code: 'PARSE_FAILED',
            message: `Failed to parse memory file ${slugPath}.`,
            cause: parsed.error,
        });
    }
    return ok(parsed.value.frontmatter.expiresAt);
};

const loadCategoryIndex = async (
    adapter: FilesystemStorageAdapter,
    categoryPath: string
): Promise<Result<CategoryIndex | null, ListCommandError>> => {
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
    const parsed = parseCategoryIndex(indexContents.value);
    if (!parsed.ok) {
        return err({
            code: 'PARSE_FAILED',
            message: `Failed to parse index for category ${categoryPath}.`,
            cause: parsed.error,
        });
    }
    return ok(parsed.value);
};

const collectMemoriesFromCategory = async (
    adapter: FilesystemStorageAdapter,
    categoryPath: string,
    includeExpired: boolean,
    now: Date,
    visited: Set<string>
): Promise<Result<ListMemoryEntry[], ListCommandError>> => {
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

    const entries: ListMemoryEntry[] = [];

    for (const memory of indexResult.value.memories) {
        const expiryResult = await loadMemoryExpiry(adapter, memory.path);
        if (!expiryResult.ok) {
            return expiryResult;
        }
        const expired = isExpired(expiryResult.value, now);
        if (!includeExpired && expired) {
            continue;
        }
        entries.push({
            path: memory.path,
            tokenEstimate: memory.tokenEstimate,
            summary: memory.summary,
            expiresAt: expiryResult.value,
            isExpired: expired,
        });
    }

    for (const subcategory of indexResult.value.subcategories) {
        const subResult = await collectMemoriesFromCategory(
            adapter,
            subcategory.path,
            includeExpired,
            now,
            visited
        );
        if (!subResult.ok) {
            return subResult;
        }
        entries.push(...subResult.value);
    }

    return ok(entries);
};

const collectAllCategories = async (
    adapter: FilesystemStorageAdapter,
    includeExpired: boolean,
    now: Date
): Promise<Result<ListMemoryEntry[], ListCommandError>> => {
    const rootCategories = ['human', 'persona', 'project', 'domain'];
    const entries: ListMemoryEntry[] = [];
    const visited = new Set<string>();

    for (const category of rootCategories) {
        const result = await collectMemoriesFromCategory(
            adapter,
            category,
            includeExpired,
            now,
            visited
        );
        if (!result.ok) {
            return result;
        }
        entries.push(...result.value);
    }

    return ok(entries);
};

const formatOutput = (
    memories: ListMemoryEntry[],
    format: OutputFormat
): Result<string, ListCommandError> => {
    const outputMemories = memories.map((memory) => ({
        path: memory.path,
        token_estimate: memory.tokenEstimate,
        summary: memory.summary,
        expires_at: memory.expiresAt?.toISOString(),
        expired: memory.isExpired || undefined,
    }));

    if (format === 'json') {
        return ok(JSON.stringify({ memories: outputMemories }, null, 2));
    }

    if (format === 'toon') {
        return ok(toonEncode({ memories: outputMemories }, toonOptions));
    }

    // YAML format (default)
    if (memories.length === 0) {
        return ok('memories: []');
    }

    const lines: string[] = ['memories:'];
    for (const memory of memories) {
        lines.push(`  - path: ${memory.path}`);
        lines.push(`    token_estimate: ${memory.tokenEstimate}`);
        if (memory.summary) {
            lines.push(`    summary: ${memory.summary}`);
        }
        if (memory.expiresAt) {
            lines.push(`    expires_at: ${memory.expiresAt.toISOString()}`);
        }
        if (memory.isExpired) {
            lines.push('    expired: true');
        }
    }
    return ok(lines.join('\n'));
};

export const runListCommand = async (options: ListCommandOptions): Promise<ListCommandResult> => {
    const parsed = parseListArgs(options.args);
    if (!parsed.ok) {
        return parsed;
    }

    const now = options.now ?? new Date();
    const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });

    let memories: ListMemoryEntry[];
    if (parsed.value.category) {
        const result = await collectMemoriesFromCategory(
            adapter,
            parsed.value.category,
            parsed.value.includeExpired,
            now,
            new Set()
        );
        if (!result.ok) {
            return result;
        }
        memories = result.value;
    } else {
        const result = await collectAllCategories(adapter, parsed.value.includeExpired, now);
        if (!result.ok) {
            return result;
        }
        memories = result.value;
    }

    const formatted = formatOutput(memories, parsed.value.format);
    if (!formatted.ok) {
        return formatted;
    }

    return ok({
        message: formatted.value,
        memories,
    });
};
