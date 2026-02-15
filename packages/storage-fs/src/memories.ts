/**
 * Memory file operations for filesystem storage.
 *
 * Handles reading, writing, moving, and removing memory files
 * from the filesystem.
 *
 * @module core/storage/filesystem/memories
 */

import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Result } from '@yeseh/cortex-core';
import type { StorageAdapterError } from '@yeseh/cortex-core/storage';
import type {
    Memory,
    MemoryError,
    MemoryErrorCode,
    MemoryMetadata,
    MemoryPath,
    MemoryResult,
} from '@yeseh/cortex-core/memory';
import { dateSchema, nonEmptyStringSchema, tagsSchema, ok, err } from '@yeseh/cortex-core';
import z from 'zod';
import * as yaml from 'yaml';
import type { FilesystemContext, StringOrNullResult } from './types.ts';
import { isNotFoundError, resolveStoragePath } from './utils.ts';

export type ParseMetadataResult = Result<MemoryMetadata, MemoryError>;
export type SerializeMemoryResult = Result<string, MemoryError>;
export type MemoryFile = Omit<Memory, 'path' | 'isExpired'>;

/**
 * Schema for validating individual citation strings.
 *
 * Citations must be non-empty strings representing references to source
 * material such as file paths, URLs, or document identifiers.
 *
 * @example
 * ```typescript
 * citationSchema.parse('docs/api.md');           // OK
 * citationSchema.parse('https://example.com');   // OK
 * citationSchema.parse('');                      // Error: Citation must not be empty
 * ```
 */
const citationSchema = z.string().min(1, 'Citation must not be empty');

/**
 * Schema for validating the citations array in memory frontmatter.
 *
 * The citations field is optional in the frontmatter. When present, it must
 * be an array of non-empty strings. When absent, defaults to an empty array.
 *
 * In YAML frontmatter format (snake_case):
 * ```yaml
 * ---
 * created_at: 2024-01-01T00:00:00.000Z
 * updated_at: 2024-01-01T00:00:00.000Z
 * tags: [example]
 * source: user
 * citations:
 *   - docs/architecture.md
 *   - https://github.com/org/repo/issues/42
 * ---
 * Memory content here.
 * ```
 *
 * @example
 * ```typescript
 * citationsSchema.parse(['file.md', 'https://example.com']); // OK: ['file.md', 'https://example.com']
 * citationsSchema.parse(undefined);                          // OK: [] (defaults to empty)
 * citationsSchema.parse([]);                                 // OK: []
 * citationsSchema.parse(['', 'valid']);                      // Error: Citation must not be empty
 * ```
 */
const citationsSchema = z.array(citationSchema).optional().default([]);

/**
 * Schema for parsing YAML frontmatter from memory files.
 * Uses snake_case keys to match the file format.
 */
const FrontmatterSchema = z.object({
    created_at: dateSchema,
    updated_at: dateSchema,
    tags: tagsSchema,
    source: nonEmptyStringSchema,
    expires_at: dateSchema.optional(),
    citations: citationsSchema,
});

/**
 * Maps a serialization error field to the appropriate MemoryErrorCode.
 *
 * @param field - The field that caused the error
 * @returns The appropriate MemoryErrorCode
 */
const mapSerializeErrorCode = (field: string | undefined): MemoryErrorCode => {
    if (field === 'tags') return 'INVALID_TAGS';
    if (field === 'source') return 'INVALID_SOURCE';
    if (field === 'citations') return 'INVALID_CITATIONS';
    return 'INVALID_TIMESTAMP';
};

/**
 * Maps field names for error reporting.
 * Schema now uses snake_case, so no conversion needed.
 *
 * @param field - The field name
 * @returns The field name unchanged
 */
const mapSerializeFieldName = (field: string | undefined): string | undefined => {
    return field;
};

/**
 * Maps a Zod validation error to a MemoryErrorCode.
 *
 * @param field - The field that caused the error
 * @param fieldExists - Whether the field exists in the input
 * @returns The appropriate MemoryErrorCode
 */
const mapZodErrorCode = (field: string | undefined, fieldExists: boolean): MemoryErrorCode => {
    // Missing field: the key doesn't exist in the YAML
    if (!fieldExists && field) {
        return 'MISSING_FIELD';
    }
    // Field-specific validation errors
    if (field === 'tags') {
        return 'INVALID_TAGS';
    }
    if (field === 'source') {
        return 'INVALID_SOURCE';
    }
    if (field === 'citations') {
        return 'INVALID_CITATIONS';
    }
    if (field === 'created_at' || field === 'updated_at' || field === 'expires_at') {
        return 'INVALID_TIMESTAMP';
    }
    return 'INVALID_FRONTMATTER';
};

/**
 * Parses YAML frontmatter lines into MemoryMetadata.
 *
 * @param frontmatterLines - Array of lines from the frontmatter section
 * @returns Result containing MemoryMetadata or MemoryError
 */
const parseMetadata = (frontmatterLines: string[]): ParseMetadataResult => {
    const frontmatterText = frontmatterLines.join('\n');

    let data: unknown;
    try {
        const doc = yaml.parseDocument(frontmatterText, { uniqueKeys: true });

        const hasDuplicateKeyIssue = [
            ...doc.errors, ...doc.warnings,
        ].some((issue) =>
            /duplicate key/i.test(issue.message),
        );

        if (hasDuplicateKeyIssue) {
            return err({
                code: 'INVALID_FRONTMATTER',
                message: 'Duplicate frontmatter key.',
            });
        }

        if (doc.errors.length > 0) {
            return err({
                code: 'INVALID_FRONTMATTER',
                message: 'Invalid YAML frontmatter.',
            });
        }

        data = doc.toJS();
    }
    catch {
        return err({
            code: 'INVALID_FRONTMATTER',
            message: 'Invalid YAML frontmatter.',
        });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return err({
            code: 'INVALID_FRONTMATTER',
            message: 'Invalid YAML frontmatter.',
        });
    }

    const record = data as Record<string, unknown>;
    const result = FrontmatterSchema.safeParse(data);
    if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue?.path[0]?.toString();
        const fieldExists = field ? Object.prototype.hasOwnProperty.call(record, field) : false;
        const code = mapZodErrorCode(field, fieldExists);
        return err({
            code,
            message: issue?.message ?? 'Invalid frontmatter.',
            field,
        });
    }

    // Convert snake_case to camelCase for internal API
    return ok({
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
        tags: result.data.tags,
        source: result.data.source,
        expiresAt: result.data.expires_at,
        citations: result.data.citations ?? [],
    });
};

/**
 * Resolves the filesystem path for a memory file.
 */
export const resolveMemoryPath = (
    ctx: FilesystemContext,
    slugPath: MemoryPath,
    errorCode: StorageAdapterError['code'],
): Result<string, StorageAdapterError> => {
    return resolveStoragePath(ctx.storeRoot, `${slugPath}${ctx.memoryExtension}`, errorCode);
};

/**
 * Serializes a Memory object to the frontmatter file format.
 *
 * The output format consists of YAML frontmatter delimited by `---` markers,
 * followed by the memory content. Citations are only included in the output
 * when the array is non-empty, keeping files clean for memories without sources.
 *
 * @param memory - The Memory object to serialize
 * @returns Result containing the serialized string or MemoryError
 *
 * @example
 * ```typescript
 * const memory = {
 *     metadata: {
 *         createdAt: new Date('2024-01-01T00:00:00.000Z'),
 *         updatedAt: new Date('2024-01-01T00:00:00.000Z'),
 *         tags: ['example', 'test'],
 *         source: 'user',
 *         citations: ['docs/spec.md', 'https://example.com/api'],
 *     },
 *     content: 'This is the memory content.',
 * };
 *
 * const result = serializeMemory(memory);
 * if (result.ok()) {
 *     console.log(result.value);
 *     // ---
 *     // created_at: 2024-01-01T00:00:00.000Z
 *     // updated_at: 2024-01-01T00:00:00.000Z
 *     // tags: [example, test]
 *     // source: user
 *     // citations:
 *     //   - docs/spec.md
 *     //   - https://example.com/api
 *     // ---
 *     // This is the memory content.
 * }
 * ```
 */
export const serializeMemory = (memory: MemoryFile): SerializeMemoryResult => {
    // Convert camelCase from internal API to snake_case for validation/serialization
    const snakeCaseMetadata = {
        created_at: memory.metadata.createdAt,
        updated_at: memory.metadata.updatedAt,
        tags: memory.metadata.tags,
        source: memory.metadata.source,
        expires_at: memory.metadata.expiresAt,
        citations: memory.metadata.citations,
    };

    const result = FrontmatterSchema.safeParse(snakeCaseMetadata);
    if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue?.path[0]?.toString();
        return err({
            code: mapSerializeErrorCode(field),
            message: issue?.message ?? 'Invalid frontmatter.',
            field: mapSerializeFieldName(field),
        });
    }

    const { created_at, updated_at, tags, source, expires_at } = result.data;

    // Output snake_case for file format
    const frontmatterData = {
        created_at: created_at.toISOString(),
        updated_at: updated_at.toISOString(),
        tags,
        source,
        ...(expires_at ? { expires_at: expires_at.toISOString() } : {}),
        ...(result.data.citations && result.data.citations.length > 0
            ? { citations: result.data.citations }
            : {}),
    };

    const frontmatterBody = yaml.stringify(frontmatterData).trimEnd();
    const frontmatter = `---\n${frontmatterBody}\n---`;
    const content = memory.content ?? '';
    const separator = content.length > 0 && !content.startsWith('\n') ? '\n' : '';

    const serialized = `${frontmatter}${separator}${content}`;
    return ok(serialized);
};

/**
 * Reads a memory file from the filesystem.
 *
 * @param ctx - Filesystem context with configuration
 * @param slugPath - Path to the memory (e.g., "project/cortex/config")
 * @returns The file contents or null if not found
 */
export const readMemory = async (
    ctx: FilesystemContext,
    slugPath: MemoryPath,
): Promise<StringOrNullResult> => {
    const filePathResult = resolveMemoryPath(ctx, slugPath, 'IO_READ_ERROR');
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
            message: `Failed to read memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
};

/**
 * Writes a memory file to the filesystem.
 *
 * Creates parent directories if they don't exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param slugPath - Path to the memory (e.g., "project/cortex/config")
 * @param memory - The serialized memory content to write
 * @returns Success or error
 */
export const writeMemory = async (
    ctx: FilesystemContext,
    slugPath: MemoryPath,
    memory: string,
): Promise<Result<void, StorageAdapterError>> => {
    const filePathResult = resolveMemoryPath(ctx, slugPath, 'IO_WRITE_ERROR');
    if (!filePathResult.ok()) {
        return filePathResult;
    }

    const filePath = filePathResult.value;

    try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, memory, 'utf8');
    }
    catch (error) {
        return err({
            code: 'IO_WRITE_ERROR',
            message: `Failed to write memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }

    return ok(undefined);
};

/**
 * Removes a memory file from the filesystem.
 *
 * @param ctx - Filesystem context with configuration
 * @param slugPath - Path to the memory to remove
 * @returns Success or error (returns success if file doesn't exist)
 */
export const removeMemory = async (
    ctx: FilesystemContext,
    slugPath: MemoryPath,
): Promise<Result<void, StorageAdapterError>> => {
    const filePathResult = resolveMemoryPath(ctx, slugPath, 'IO_WRITE_ERROR');
    if (!filePathResult.ok()) {
        return filePathResult;
    }
    const filePath = filePathResult.value;
    try {
        await rm(filePath);
        return ok(undefined);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            return ok(undefined);
        }
        return err({
            code: 'IO_WRITE_ERROR',
            message: `Failed to remove memory file at ${filePath}.`,
            path: filePath,
            cause: error,
        });
    }
};

/**
 * Moves a memory file from one location to another.
 *
 * The destination category must already exist.
 *
 * @param ctx - Filesystem context with configuration
 * @param sourceSlugPath - Source path of the memory
 * @param destinationSlugPath - Destination path for the memory
 * @returns Success or error
 */
export const moveMemory = async (
    ctx: FilesystemContext,
    sourceSlugPath: MemoryPath,
    destinationSlugPath: MemoryPath,
): Promise<Result<void, StorageAdapterError>> => {
    const sourcePathResult = resolveMemoryPath(ctx, sourceSlugPath, 'IO_WRITE_ERROR');
    if (!sourcePathResult.ok()) {
        return sourcePathResult;
    }

    const destinationPathResult = resolveMemoryPath(ctx, destinationSlugPath, 'IO_WRITE_ERROR');
    if (!destinationPathResult.ok()) {
        return destinationPathResult;
    }

    const destinationDirectory = dirname(destinationPathResult.value);
    try {
        await access(destinationDirectory);
    }
    catch (error) {
        return err({
            code: 'IO_WRITE_ERROR',
            message: `Destination category does not exist for ${destinationSlugPath}.`,
            path: destinationDirectory,
            cause: error,
        });
    }

    try {
        await rename(sourcePathResult.value, destinationPathResult.value);
        return ok(undefined);
    }
    catch (error) {
        return err({
            code: 'IO_WRITE_ERROR',
            message: `Failed to move memory from ${sourceSlugPath} to ${destinationSlugPath}.`,
            path: destinationPathResult.value,
            cause: error,
        });
    }
};

/**
 * Parses a raw memory file string into a Memory object.
 *
 * The file format consists of YAML frontmatter delimited by `---` markers,
 * followed by the memory content. The frontmatter uses snake_case keys
 * (e.g., `created_at`, `expires_at`, `citations`), which are converted
 * to camelCase in the returned Memory object.
 *
 * @param raw - The raw file content to parse
 * @returns Result containing Memory or MemoryError
 *
 * @example
 * ```typescript
 * const raw = `---
 * created_at: 2024-01-01T00:00:00.000Z
 * updated_at: 2024-01-01T00:00:00.000Z
 * tags: [example, test]
 * source: user
 * citations:
 *   - docs/architecture.md
 *   - https://github.com/org/repo/issues/42
 * ---
 * This is the memory content.
 * `;
 *
 * const result = parseMemory(raw);
 * if (result.ok()) {
 *     console.log(result.value.metadata.tags);      // ['example', 'test']
 *     console.log(result.value.metadata.citations); // ['docs/architecture.md', 'https://github.com/org/repo/issues/42']
 *     console.log(result.value.content);            // 'This is the memory content.\n'
 * } else {
 *     console.error(result.error.code, result.error.message);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Memory without citations (citations defaults to empty array)
 * const rawNoCitations = `---
 * created_at: 2024-01-01T00:00:00.000Z
 * updated_at: 2024-01-01T00:00:00.000Z
 * tags: []
 * source: mcp
 * ---
 * Simple memory without sources.
 * `;
 *
 * const result = parseMemory(rawNoCitations);
 * if (result.ok()) {
 *     console.log(result.value.metadata.citations); // [] (defaults to empty)
 * }
 * ```
 */
export const parseMemory = (raw: string): MemoryResult<MemoryFile> => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    const firstLine = lines[0];
    if (!firstLine || firstLine.trim() !== '---') {
        return err({
            code: 'MISSING_FRONTMATTER',
            message: 'Memory file must start with YAML frontmatter.',
            line: 1,
        });
    }

    let endIndex = -1;
    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line === undefined) {
            break;
        }
        if (line.trim() === '---') {
            endIndex = index;
            break;
        }
    }

    if (endIndex === -1) {
        return err({
            code: 'MISSING_FRONTMATTER',
            message: "Memory file frontmatter must be closed with '---'.",
            line: lines.length,
        });
    }

    const frontmatterLines = lines.slice(1, endIndex);
    const content = lines.slice(endIndex + 1).join('\n');
    const parsedMetadata = parseMetadata(frontmatterLines);
    if (!parsedMetadata.ok()) {
        return err(parsedMetadata.error);
    }

    return ok({ metadata: parsedMetadata.value, content });
};
