/**
 * Frontmatter format adapter for memory files.
 *
 * This module provides parsing and serialization logic for memory files
 * using YAML frontmatter format. It handles conversion between raw file
 * content and structured Memory objects.
 *
 * @module core/memory/formats/frontmatter
 *
 * @example
 * ```typescript
 * import { parseFrontmatter, serializeFrontmatter } from './frontmatter.ts';
 *
 * // Parse a memory file
 * const result = parseFrontmatter(rawContent);
 * if (result.ok) {
 *     console.log(result.value.metadata.createdAt);
 *     console.log(result.value.content);
 * }
 *
 * // Serialize a memory to file content
 * const memory = {
 *     metadata: {
 *         createdAt: new Date(),
 *         updatedAt: new Date(),
 *         tags: ['example'],
 *         source: 'user',
 *     },
 *     content: 'My memory content',
 * };
 * const serialized = serializeFrontmatter(memory);
 * if (serialized.ok) {
 *     console.log(serialized.value);
 * }
 * ```
 */

import { parseDocument } from 'yaml';
import { z } from 'zod';
import { ok, err, type Result } from '../../result.ts';
import type { MemoryMetadata, Memory, MemoryErrorCode, MemoryError } from '../types.ts';

// ============================================================================
// Backwards Compatibility Type Aliases
// ============================================================================

/** @deprecated Use MemoryMetadata instead */
export type MemoryFileFrontmatter = MemoryMetadata;

/**
 * @deprecated Use Memory instead
 *
 * This type maintains backwards compatibility with the old API that used
 * `frontmatter` property instead of `metadata`.
 */
export type MemoryFileContents = {
    frontmatter: MemoryMetadata;
    content: string;
};

/** @deprecated Use MemoryErrorCode instead */
export type MemoryFileParseErrorCode = MemoryErrorCode;

/** @deprecated Use MemoryError instead */
export type MemoryFileParseError = MemoryError;

/** @deprecated Use MemoryErrorCode instead */
export type MemoryFileSerializeErrorCode = 'INVALID_TIMESTAMP' | 'INVALID_TAGS' | 'INVALID_SOURCE';

/** @deprecated Use MemoryError instead */
export type MemoryFileSerializeError = MemoryError;

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for parsing date values from frontmatter.
 * Accepts both Date objects and ISO 8601 strings.
 */
const dateSchema = z
    .union([
        z.date(),
        z.string().transform((val, ctx) => {
            const parsed = new Date(val);
            if (Number.isNaN(parsed.getTime())) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid timestamp' });
                return z.NEVER;
            }
            return parsed;
        }),
    ])
    .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp' });

/**
 * Schema for non-empty strings (trimmed and at least 1 character).
 */
const nonEmptyStringSchema = z.string().trim().min(1);

/**
 * Schema for tags array, handling null/undefined as empty arrays.
 */
const tagsSchema = z
    .union([
        z.null().transform(() => []),
        z.undefined().transform(() => []),
        z.array(nonEmptyStringSchema),
    ])
    .pipe(z.array(z.string()));

/**
 * Schema for parsing YAML frontmatter from memory files.
 */
const FrontmatterSchema = z.object({
    created_at: dateSchema,
    updated_at: dateSchema,
    tags: tagsSchema,
    source: nonEmptyStringSchema,
    expires_at: dateSchema.optional(),
});

/**
 * Schema for validating memory metadata before serialization.
 */
const SerializeFrontmatterSchema = z.object({
    createdAt: z.date().refine((d) => !Number.isNaN(d.getTime()), {
        message: 'Invalid timestamp for created_at.',
    }),
    updatedAt: z.date().refine((d) => !Number.isNaN(d.getTime()), {
        message: 'Invalid timestamp for updated_at.',
    }),
    tags: z.array(nonEmptyStringSchema),
    source: nonEmptyStringSchema,
    expiresAt: z
        .date()
        .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp for expires_at.' })
        .optional(),
});

// ============================================================================
// Internal Result Types
// ============================================================================

type ParseMetadataResult = Result<MemoryMetadata, MemoryError>;
type SerializeFileResult = Result<string, MemoryError>;

// ============================================================================
// Error Mapping Helpers
// ============================================================================

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
 * Maps camelCase field names to snake_case for error reporting.
 *
 * @param field - The camelCase field name
 * @returns The snake_case field name
 */
const mapSerializeFieldName = (field: string | undefined): string | undefined => {
    if (field === 'createdAt') return 'created_at';
    if (field === 'updatedAt') return 'updated_at';
    if (field === 'expiresAt') return 'expires_at';
    return field;
};

// ============================================================================
// Internal Parsing Functions
// ============================================================================

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
        const doc = parseDocument(frontmatterText, { uniqueKeys: true });

        const hasDuplicateKeyIssue = [...doc.errors, ...doc.warnings].some((issue) =>
            /duplicate key/i.test(issue.message)
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
    } catch {
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

    return ok({
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
        tags: result.data.tags,
        source: result.data.source,
        expiresAt: result.data.expires_at,
    });
};

// ============================================================================
// Public API
// ============================================================================

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
export const parseFrontmatter = (raw: string): Result<Memory, MemoryError> => {
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
export const serializeFrontmatter = (memory: Memory): SerializeFileResult => {
    const result = SerializeFrontmatterSchema.safeParse(memory.metadata);
    if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue?.path[0]?.toString();
        return err({
            code: mapSerializeErrorCode(field),
            message: issue?.message ?? 'Invalid frontmatter.',
            field: mapSerializeFieldName(field),
        });
    }

    const { createdAt, updatedAt, tags, source, expiresAt } = result.data;

    const lines: string[] = [
        `created_at: ${createdAt.toISOString()}`,
        `updated_at: ${updatedAt.toISOString()}`,
        `tags: [${tags.join(', ')}]`,
        `source: ${source}`,
    ];

    if (expiresAt) {
        lines.push(`expires_at: ${expiresAt.toISOString()}`);
    }

    const frontmatter = `---\n${lines.join('\n')}\n---`;
    const content = memory.content ?? '';
    const separator = content.length > 0 && !content.startsWith('\n') ? '\n' : '';

    return ok(`${frontmatter}${separator}${content}`);
};

// ============================================================================
// Backwards Compatibility Exports
// ============================================================================

/**
 * @deprecated Use parseFrontmatter instead
 *
 * Wrapper function that converts the new Memory format to the old
 * MemoryFileContents format with `frontmatter` property.
 */
export const parseMemoryFile = (raw: string): Result<MemoryFileContents, MemoryError> => {
    const result = parseFrontmatter(raw);
    if (!result.ok) return err(result.error);
    return ok({ frontmatter: result.value.metadata, content: result.value.content });
};

/**
 * @deprecated Use serializeFrontmatter instead
 *
 * Wrapper function that converts the old MemoryFileContents format with
 * `frontmatter` property to the new Memory format for serialization.
 */
export const serializeMemoryFile = (memory: MemoryFileContents): Result<string, MemoryError> => {
    return serializeFrontmatter({ metadata: memory.frontmatter, content: memory.content });
};
