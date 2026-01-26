/**
 * Memory file parsing and serialization helpers
 */

import { parseDocument } from 'yaml';
import { z } from 'zod';
import type { Result } from '../types.ts';

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const dateSchema = z.union([
    z.date(),
    z.string().transform((val, ctx) => {
        const parsed = new Date(val);
        if (Number.isNaN(parsed.getTime())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid timestamp' });
            return z.NEVER;
        }
        return parsed;
    }),
]).refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp' });

const nonEmptyStringSchema = z.string().trim().min(1);

const tagsSchema = z
    .union([
        z.null().transform(() => []),
        z.undefined().transform(() => []),
        z.array(nonEmptyStringSchema),
    ])
    .pipe(z.array(z.string()));

const FrontmatterSchema = z.object({
    created_at: dateSchema,
    updated_at: dateSchema,
    tags: tagsSchema,
    source: nonEmptyStringSchema,
    expires_at: dateSchema.optional(),
});

export interface MemoryFileFrontmatter {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    source: string;
    expiresAt?: Date;
}

export interface MemoryFileContents {
    frontmatter: MemoryFileFrontmatter;
    content: string;
}

export type MemoryFileParseErrorCode =
    | 'MISSING_FRONTMATTER'
    | 'INVALID_FRONTMATTER'
    | 'MISSING_FIELD'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TAGS'
    | 'INVALID_SOURCE';

export interface MemoryFileParseError {
    code: MemoryFileParseErrorCode;
    message: string;
    field?: string;
    line?: number;
}

export type MemoryFileSerializeErrorCode = 'INVALID_TIMESTAMP' | 'INVALID_TAGS' | 'INVALID_SOURCE';

export interface MemoryFileSerializeError {
    code: MemoryFileSerializeErrorCode;
    message: string;
    field?: string;
}

type ParseFrontmatterResult = Result<MemoryFileFrontmatter, MemoryFileParseError>;
type SerializeFileResult = Result<string, MemoryFileSerializeError>;

export const parseMemoryFile = (raw: string): Result<MemoryFileContents, MemoryFileParseError> => {
    const normalized = raw.replace(
        /\r\n/g, '\n',
    );
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

    const parsedFrontmatter = parseFrontmatter(frontmatterLines);
    if (!parsedFrontmatter.ok) {
        return parsedFrontmatter;
    }

    return ok({ frontmatter: parsedFrontmatter.value, content });
};

const parseFrontmatter = (frontmatterLines: string[]): ParseFrontmatterResult => {
    const frontmatterText = frontmatterLines.join('\n');

    let data: unknown;
    try {
        const doc = parseDocument(frontmatterText, { uniqueKeys: true });

        const hasDuplicateKeyIssue = [
            ...doc.errors,
            ...doc.warnings,
        ].some((issue) => /duplicate key/i.test(issue.message));

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

    return ok({
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
        tags: result.data.tags,
        source: result.data.source,
        expiresAt: result.data.expires_at,
    });
};

const mapZodErrorCode = (
    field: string | undefined,
    fieldExists: boolean,
): MemoryFileParseErrorCode => {
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

const SerializeFrontmatterSchema = z.object({
    createdAt: z.date().refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp for created_at.' }),
    updatedAt: z.date().refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp for updated_at.' }),
    tags: z.array(nonEmptyStringSchema),
    source: nonEmptyStringSchema,
    expiresAt: z.date().refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid timestamp for expires_at.' }).optional(),
});

const mapSerializeErrorCode = (field: string | undefined): MemoryFileSerializeErrorCode => {
    if (field === 'tags') return 'INVALID_TAGS';
    if (field === 'source') return 'INVALID_SOURCE';
    return 'INVALID_TIMESTAMP';
};

const mapSerializeFieldName = (field: string | undefined): string | undefined => {
    if (field === 'createdAt') return 'created_at';
    if (field === 'updatedAt') return 'updated_at';
    if (field === 'expiresAt') return 'expires_at';
    return field;
};

export const serializeMemoryFile = (memory: MemoryFileContents): SerializeFileResult => {
    const result = SerializeFrontmatterSchema.safeParse(memory.frontmatter);
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
