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
import { ok, err, type Result } from './result.ts';

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

