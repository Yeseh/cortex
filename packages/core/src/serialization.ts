/**
 * Generic serialization module for input/output formatting.
 *
 * Provides serialization and deserialization functions with both throwing
 * and Result-based error handling patterns. Supports JSON, YAML, and TOON formats.
 *
 * @module serialization
 */

import * as TOON from '@toon-format/toon';
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
export const serialize = (
    obj: unknown,
    format: OutputFormat
): Result<string, SerializationError> => {
    try {
        switch (format) {
            case 'json':
                return ok(JSON.stringify(obj));
            case 'yaml':
                return ok(Bun.YAML.stringify(obj));
            case 'toon':
                return ok(TOON.encode(obj, toonOptions));
            default:
                return err({
                    code: 'INVALID_FORMAT',
                    message: `Unsupported output format: ${format}`,
                });
        }
    } catch (cause) {
        return err({
            code: 'SERIALIZE_FAILED',
            message: `Failed to serialize to ${format}.`,
            cause,
        });
    }
};

/**
 * Deserialize a string to an object of the specified format.
 *
 * @param raw - The raw string to deserialize
 * @param format - The format to parse ('yaml', 'json', or 'toon')
 * @returns Result containing the deserialized object or a SerializationError
 *
 * @example
 * ```ts
 * const obj = deserialize<{ name: string }>('{"name": "test"}', 'json');
 * // { name: 'test' }
 * ```
 */
export const deserialize = <T = unknown>(
    raw: string,
    format: 'yaml' | 'json' | 'toon'
): Result<T, SerializationError> => {
    try {
        switch (format) {
            case 'json':
                return ok(JSON.parse(raw) as T);
            case 'yaml':
                return ok(Bun.YAML.parse(raw) as T);
            case 'toon':
                return ok(TOON.decode(raw) as T);
            default:
                return err({
                    code: 'INVALID_FORMAT',
                    message: `Unsupported input format: ${format}`,
                });
        }
    } catch (cause) {
        return err({
            code: 'PARSE_FAILED',
            message: `Failed to deserialize ${format}.`,
            cause,
        });
    }
};
