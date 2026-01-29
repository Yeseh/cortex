/**
 * Memory file operations for filesystem storage.
 *
 * Handles reading, writing, moving, and removing memory files
 * from the filesystem.
 *
 * @module core/storage/filesystem/files
 */

import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { MemoryIdentity, MemorySlugPath, Result } from '../../types.ts';
import type { StorageAdapterError } from '../adapter.ts';
import { validateMemorySlugPath } from '../../memory/validation.ts';
import type { FilesystemContext, StringOrNullResult } from './types.ts';
import { err, isNotFoundError, ok, resolveStoragePath } from './utils.ts';
import type { Memory, MemoryError, MemoryErrorCode, MemoryMetadata } from '../../memory/types.ts';
import z from 'zod';
import * as yaml from 'yaml';
import { dateSchema, nonEmptyStringSchema, tagsSchema } from '../../valdiation/schemas.ts';


export type ParseMetadataResult = Result<MemoryMetadata, MemoryError>;
export type SerializeMemoryResult = Result<string, MemoryError>;

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
});

/**
 * Validates a slug path and returns the memory identity.
 * Prevents 'index' as a slug to avoid collision with index files.
 */
export const validateSlugPath = (
    slugPath: string,
    failure: { code: StorageAdapterError['code']; message: string; path: string },
): Result<MemoryIdentity, StorageAdapterError> => {
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
};

/**
 * Maps a serialization error field to the appropriate MemoryErrorCode.
 *
 * @param field - The field that caused the error
 * @returns The appropriate MemoryErrorCode
 */
const mapSerializeErrorCode = (field: string | undefined): MemoryErrorCode => {
    if (field === 'tags') return 'INVALID_TAGS';
    if (field === 'source') return 'INVALID_SOURCE';
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
    });
};


/**
 * Resolves the filesystem path for a memory file.
 */
export const resolveMemoryPath = (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
    errorCode: StorageAdapterError['code'],
): Result<string, StorageAdapterError> => {
    return resolveStoragePath(ctx.storeRoot, `${slugPath}${ctx.memoryExtension}`, errorCode);
};

/**
 * Serializes a Memory object to the frontmatter file format.
 *
 * The output format consists of YAML frontmatter delimited by `---` markers,
 * followed by the memory content.
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
 *     },
 *     content: 'This is the memory content.',
 * };
 *
 * const result = serializeFrontmatter(memory);
 * if (result.ok) {
 *     console.log(result.value);
 *     // ---
 *     // created_at: 2024-01-01T00:00:00.000Z
 *     // updated_at: 2024-01-01T00:00:00.000Z
 *     // tags: [example, test]
 *     // source: user
 *     // ---
 *     // This is the memory content.
 * }
 * ```
 */
export const serializeMemory = (memory: Memory): SerializeMemoryResult => {
    // Convert camelCase from internal API to snake_case for validation/serialization
    const snakeCaseMetadata = {
        created_at: memory.metadata.createdAt,
        updated_at: memory.metadata.updatedAt,
        tags: memory.metadata.tags,
        source: memory.metadata.source,
        expires_at: memory.metadata.expiresAt,
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
    };


    const frontmatterBody = yaml.stringify(frontmatterData).trimEnd();
    const frontmatter = `---\n${frontmatterBody}\n---`;
    const content = memory.content ?? '';
    const separator = content.length > 0 && !content.startsWith('\n') ? '\n' : '';

    return ok(`${frontmatter}${separator}${content}`);
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
    slugPath: MemorySlugPath,
): Promise<StringOrNullResult> => {
    const filePathResult = resolveMemoryPath(ctx, slugPath, 'READ_FAILED');
    if (!filePathResult.ok) {
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
            code: 'READ_FAILED',
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
 * @param memory - The content to write
 * @returns Success or error
 */
export const writeMemory = async (
    ctx: FilesystemContext,
    slugPath: MemorySlugPath,
    memory: string,
): Promise<Result<void, StorageAdapterError>> => {
    const parsed = parseMemory(memory);
    if (!parsed.ok) {
        return err({
            code: 'WRITE_FAILED',
            message: 'Failed to parse memory for writing.',
            cause: parsed.error,
        });
    }

    const identityResult = validateSlugPath(slugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid memory slug path.',
        path: slugPath,
    });
    if (!identityResult.ok) {
        return identityResult;
    }

    const filePathResult = resolveMemoryPath(ctx, slugPath, 'WRITE_FAILED');
    if (!filePathResult.ok) {
        return filePathResult;
    }

    const filePath = filePathResult.value;
    const serializedResult = serializeMemory(parsed.value); 
    if (!serializedResult.ok) {
        return err({
            code: 'WRITE_FAILED',
            message: 'Failed to serialize memory for writing.',
        });
    }

    try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, serializedResult.value, 'utf8');
    }
    catch (error) {
        return err({
            code: 'WRITE_FAILED',
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
    slugPath: MemorySlugPath,
): Promise<Result<void, StorageAdapterError>> => {
    const identityResult = validateSlugPath(slugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid memory slug path.',
        path: slugPath,
    });
    if (!identityResult.ok) {
        return identityResult;
    }

    const filePathResult = resolveMemoryPath(ctx, slugPath, 'WRITE_FAILED');
    if (!filePathResult.ok) {
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
            code: 'WRITE_FAILED',
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
    sourceSlugPath: MemorySlugPath,
    destinationSlugPath: MemorySlugPath,
): Promise<Result<void, StorageAdapterError>> => {
    const sourceIdentityResult = validateSlugPath(sourceSlugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid source memory slug path.',
        path: sourceSlugPath,
    });
    if (!sourceIdentityResult.ok) {
        return sourceIdentityResult;
    }

    const destinationIdentityResult = validateSlugPath(destinationSlugPath, {
        code: 'WRITE_FAILED',
        message: 'Invalid destination memory slug path.',
        path: destinationSlugPath,
    });
    if (!destinationIdentityResult.ok) {
        return destinationIdentityResult;
    }

    const sourcePathResult = resolveMemoryPath(ctx, sourceSlugPath, 'WRITE_FAILED');
    if (!sourcePathResult.ok) {
        return sourcePathResult;
    }

    const destinationPathResult = resolveMemoryPath(ctx, destinationSlugPath, 'WRITE_FAILED');
    if (!destinationPathResult.ok) {
        return destinationPathResult;
    }

    const destinationDirectory = dirname(destinationPathResult.value);
    try {
        await access(destinationDirectory);
    }
    catch (error) {
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
    }
    catch (error) {
        return err({
            code: 'WRITE_FAILED',
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
 * followed by the memory content.
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
 * ---
 * This is the memory content.
 * `;
 *
 * const result = parseFrontmatter(raw);
 * if (result.ok) {
 *     console.log(result.value.metadata.tags); // ['example', 'test']
 *     console.log(result.value.content); // 'This is the memory content.\n'
 * } else {
 *     console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export const parseMemory = (raw: string): Result<Memory, MemoryError> => {
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
    if (!parsedMetadata.ok) {
        return err(parsedMetadata.error);
    }

    return ok({ metadata: parsedMetadata.value, content });
};

