/**
 * Generic serialization module for input/output formatting.
 *
 * Provides serialization and deserialization functions with both throwing
 * and Result-based error handling patterns. Supports JSON, YAML, and TOON formats.
 *
 * @module serialization
 */

import YAML from 'yaml';
import { encode as toonEncode } from '@toon-format/toon';
import { z } from 'zod';
import { ok, err, type Result } from './result.ts';
import type { CategoryIndex } from './index/types.ts';

/** Supported output formats */
export type OutputFormat = 'yaml' | 'json' | 'toon';

/** TOON encoder options for token-efficient output */
export const toonOptions = {
    delimiter: '\t',
    keyFolding: 'safe',
} as const;

/**
 * Error type for serialization/deserialization operations.
 */
export interface SerializationError {
    code: 'PARSE_FAILED' | 'SERIALIZE_FAILED' | 'INVALID_FORMAT' | 'VALIDATION_FAILED';
    message: string;
    cause?: unknown;
}

// -----------------------------------------------------------------------------
// Throwing API (original serialize + new deserialize)
// -----------------------------------------------------------------------------

/**
 * Serialize any object to the specified format.
 *
 * @param obj - The object to serialize (must be JSON-serializable)
 * @param format - The output format ('yaml', 'json', or 'toon')
 * @returns Serialized string representation
 * @throws Error if serialization fails
 *
 * @example
 * ```ts
 * const yaml = serialize({ name: 'test' }, 'yaml');
 * // name: test
 * ```
 */
export const serialize = (obj: unknown, format: OutputFormat): string => {
    switch (format) {
        case 'json':
            return JSON.stringify(obj);
        case 'yaml':
            return YAML.stringify(obj);
        case 'toon':
            return toonEncode(obj, toonOptions);
        default:
            throw new Error(`Unsupported output format: ${format}`);
    }
};

/**
 * Deserialize a string to an object of the specified format.
 *
 * @param raw - The raw string to deserialize
 * @param format - The format to parse ('yaml' or 'json')
 * @returns The deserialized object
 * @throws Error if deserialization fails
 *
 * @example
 * ```ts
 * const obj = deserialize<{ name: string }>('{"name": "test"}', 'json');
 * // { name: 'test' }
 * ```
 */
export const deserialize = <T = unknown>(raw: string, format: 'yaml' | 'json'): T => {
    switch (format) {
        case 'json':
            return JSON.parse(raw) as T;
        case 'yaml':
            return YAML.parse(raw) as T;
        default:
            throw new Error(`Unsupported input format: ${format}`);
    }
};

// -----------------------------------------------------------------------------
// Result-based API (non-throwing wrappers)
// -----------------------------------------------------------------------------

/**
 * Parse a YAML string into an object with Result error handling.
 *
 * @param raw - The raw YAML string to parse
 * @returns Result containing the parsed object or a SerializationError
 *
 * @example
 * ```ts
 * const result = parseYaml<{ name: string }>('name: test');
 * if (result.ok) {
 *     console.log(result.value.name); // 'test'
 * }
 * ```
 */
export const parseYaml = <T = unknown>(raw: string): Result<T, SerializationError> => {
    try {
        const value = YAML.parse(raw) as T;
        return ok(value);
    }
    catch (cause) {
        return err({
            code: 'PARSE_FAILED',
            message: 'Failed to parse YAML.',
            cause,
        });
    }
};

/**
 * Stringify an object to YAML with Result error handling.
 *
 * @param obj - The object to serialize
 * @returns Result containing the YAML string or a SerializationError
 *
 * @example
 * ```ts
 * const result = stringifyYaml({ name: 'test' });
 * if (result.ok) {
 *     console.log(result.value); // 'name: test\n'
 * }
 * ```
 */
export const stringifyYaml = (obj: unknown): Result<string, SerializationError> => {
    try {
        return ok(YAML.stringify(obj));
    }
    catch (cause) {
        return err({
            code: 'SERIALIZE_FAILED',
            message: 'Failed to serialize to YAML.',
            cause,
        });
    }
};

/**
 * Parse a JSON string into an object with Result error handling.
 *
 * @param raw - The raw JSON string to parse
 * @returns Result containing the parsed object or a SerializationError
 *
 * @example
 * ```ts
 * const result = parseJson<{ name: string }>('{"name": "test"}');
 * if (result.ok) {
 *     console.log(result.value.name); // 'test'
 * }
 * ```
 */
export const parseJson = <T = unknown>(raw: string): Result<T, SerializationError> => {
    try {
        const value = JSON.parse(raw) as T;
        return ok(value);
    }
    catch (cause) {
        return err({
            code: 'PARSE_FAILED',
            message: 'Failed to parse JSON.',
            cause,
        });
    }
};

/**
 * Stringify an object to JSON with Result error handling.
 *
 * @param obj - The object to serialize
 * @returns Result containing the JSON string or a SerializationError
 *
 * @example
 * ```ts
 * const result = stringifyJson({ name: 'test' });
 * if (result.ok) {
 *     console.log(result.value); // '{"name":"test"}'
 * }
 * ```
 */
export const stringifyJson = (obj: unknown): Result<string, SerializationError> => {
    try {
        return ok(JSON.stringify(obj));
    }
    catch (cause) {
        return err({
            code: 'SERIALIZE_FAILED',
            message: 'Failed to serialize to JSON.',
            cause,
        });
    }
};

// -----------------------------------------------------------------------------
// Category Index serialization (with Zod validation)
// -----------------------------------------------------------------------------

/**
 * Zod schema for index memory entry (snake_case YAML format).
 * @internal
 */
const IndexMemoryEntrySchema = z.object({
    path: z.string().min(1),
    token_estimate: z.number().int().nonnegative(),
    summary: z.string().optional(),
    updated_at: z.string().datetime().optional(),
});

/**
 * Zod schema for index subcategory entry (snake_case YAML format).
 * @internal
 */
const IndexSubcategoryEntrySchema = z.object({
    path: z.string().min(1),
    memory_count: z.number().int().nonnegative(),
    description: z.string().optional(),
});

/**
 * Zod schema for category index (snake_case YAML format).
 * @internal
 */
const CategoryIndexSchema = z.object({
    memories: z.array(IndexMemoryEntrySchema),
    subcategories: z.array(IndexSubcategoryEntrySchema),
});

/**
 * Parse category index YAML to CategoryIndex with validation.
 *
 * Converts from snake_case YAML format to camelCase TypeScript types.
 *
 * @param raw - The raw YAML string containing the category index
 * @returns Result containing the parsed CategoryIndex or a SerializationError
 *
 * @example
 * ```ts
 * const yaml = `
 * memories:
 *   - path: my-memory
 *     token_estimate: 100
 * subcategories: []
 * `;
 * const result = parseIndex(yaml);
 * if (result.ok) {
 *     console.log(result.value.memories[0].tokenEstimate); // 100
 * }
 * ```
 */
export const parseIndex = (raw: string): Result<CategoryIndex, SerializationError> => {
    const yamlResult = parseYaml<unknown>(raw);
    if (!yamlResult.ok) {
        return yamlResult;
    }

    const parsed = CategoryIndexSchema.safeParse(yamlResult.value);
    if (!parsed.success) {
        return err({
            code: 'VALIDATION_FAILED',
            message: 'Invalid category index format.',
            cause: parsed.error,
        });
    }

    // Convert snake_case to camelCase
    return ok({
        memories: parsed.data.memories.map((m) => ({
            path: m.path,
            tokenEstimate: m.token_estimate,
            ...(m.summary ? { summary: m.summary } : {}),
            ...(m.updated_at ? { updatedAt: new Date(m.updated_at) } : {}),
        })),
        subcategories: parsed.data.subcategories.map((s) => ({
            path: s.path,
            memoryCount: s.memory_count,
            ...(s.description ? { description: s.description } : {}),
        })),
    });
};

/**
 * Serialize CategoryIndex to YAML string.
 *
 * Converts from camelCase TypeScript types to snake_case YAML format.
 *
 * @param index - The CategoryIndex to serialize
 * @returns Result containing the YAML string or a SerializationError
 *
 * @example
 * ```ts
 * const index: CategoryIndex = {
 *     memories: [{ path: 'my-memory', tokenEstimate: 100 }],
 *     subcategories: [],
 * };
 * const result = serializeIndex(index);
 * if (result.ok) {
 *     console.log(result.value);
 *     // memories:
 *     //   - path: my-memory
 *     //     token_estimate: 100
 *     // subcategories: []
 * }
 * ```
 */
export const serializeIndex = (index: CategoryIndex): Result<string, SerializationError> => {
    // Convert camelCase to snake_case for YAML output
    const yamlData = {
        memories: index.memories.map((m) => ({
            path: m.path,
            token_estimate: m.tokenEstimate,
            ...(m.summary ? { summary: m.summary } : {}),
            ...(m.updatedAt ? { updated_at: m.updatedAt.toISOString() } : {}),
        })),
        subcategories: index.subcategories.map((s) => ({
            path: s.path,
            memory_count: s.memoryCount,
            ...(s.description ? { description: s.description } : {}),
        })),
    };

    return stringifyYaml(yamlData);
};
