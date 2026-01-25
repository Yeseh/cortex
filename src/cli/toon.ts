/**
 * TOON (Token-Oriented Object Notation) encoder.
 * Compact encoding of JSON data optimized for LLM consumption.
 *
 * @module cli/toon
 */

export interface ToonOptions {
    /** Field delimiter (default: tab) */
    delimiter?: string;
    /** Key folding mode: 'safe' collapses nested paths to dotted notation */
    keyFolding?: 'safe' | 'none';
}

const DEFAULT_OPTIONS: Required<ToonOptions> = {
    delimiter: '\t',
    keyFolding: 'none',
};

/**
 * Checks if a string needs quoting (contains delimiter, newline, or special chars)
 */
const needsQuoting = (value: string, delimiter: string): boolean => {
    return (
        value.includes(delimiter) ||
        value.includes('\n') ||
        value.includes('\r') ||
        value.includes('"') ||
        value.includes(':')
    );
};

/**
 * Quotes a string value for TOON output
 */
const quoteString = (value: string): string => {
    return JSON.stringify(value);
};

/**
 * Serializes a primitive value
 */
const serializePrimitive = (value: unknown, delimiter: string): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'null';
    if (typeof value === 'string') {
        return needsQuoting(value, delimiter) ? quoteString(value) : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return quoteString(String(value));
};

/**
 * Checks if an array contains uniform objects (all same keys)
 */
const isUniformArray = (arr: unknown[]): arr is Record<string, unknown>[] => {
    if (arr.length === 0) return false;
    if (!arr.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))) {
        return false;
    }
    const first = arr[ 0 ] as Record<string, unknown>;
    const firstKeys = Object.keys(first).sort().join(',');
    return arr.every(
        (item) =>
            Object.keys(item as object)
                .sort()
                .join(',') === firstKeys,
    );
};

/**
 * Serializes a uniform array in tabular format
 */
const serializeTabularArray = (
    arr: Record<string, unknown>[],
    key: string,
    delimiter: string,
): string => {
    if (arr.length === 0) return `${key}:[]`;

    const first = arr[ 0 ] as Record<string, unknown>;
    const headers = Object.keys(first);
    const headerLine = `${key}[${arr.length}]{${headers.join(delimiter)}}:`;

    const rows = arr.map((item) => {
        const values = headers.map((h) => serializePrimitive(item[ h ], delimiter));
        return delimiter + values.join(delimiter);
    });

    return [headerLine, ...rows].join('\n');
};

/**
 * Flattens an object with key folding (dotted notation)
 */
const flattenObject = (
    obj: Record<string, unknown>,
    prefix: string = '',
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
        }
        else {
            result[ fullKey ] = value;
        }
    }

    return result;
};

/**
 * Serializes a value to TOON format
 */
const serializeValue = (value: unknown, options: Required<ToonOptions>, key?: string): string => {
    const { delimiter, keyFolding } = options;

    // Handle primitives
    if (value === null || value === undefined) {
        return key ? `${key}:null` : 'null';
    }

    if (typeof value !== 'object') {
        const serialized = serializePrimitive(value, delimiter);
        return key ? `${key}:${serialized}` : serialized;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        if (isUniformArray(value) && key) {
            return serializeTabularArray(value, key, delimiter);
        }
        // Non-uniform arrays: serialize as JSON array
        const serialized = JSON.stringify(value);
        return key ? `${key}:${serialized}` : serialized;
    }

    // Handle objects
    let obj = value as Record<string, unknown>;
    if (keyFolding === 'safe') {
        obj = flattenObject(obj);
    }

    const entries = Object.entries(obj);
    const parts: string[] = [];

    for (const [ k, v] of entries) {
        if (Array.isArray(v) && isUniformArray(v)) {
            parts.push(serializeTabularArray(v, k, delimiter));
        } 
        else if (
            typeof v === 'object' &&
            v !== null &&
            !Array.isArray(v) &&
            keyFolding !== 'safe'
        ) {
            // Nested object without key folding - serialize inline
            parts.push(`${k}:{${serializeValue(v, options)}}`);
        } 
        else {
            const serialized = serializePrimitive(v, delimiter);
            parts.push(`${k}:${serialized}`);
        }
    }

    const result = parts.join(delimiter);
    return key ? `${key}:{${result}}` : result;
};

/**
 * Encodes a value to TOON format.
 *
 * @param value - The value to encode (must be JSON-serializable)
 * @param options - Encoding options
 * @returns TOON-encoded string
 *
 * @example
 * ```ts
 * const data = { name: 'test', count: 42 };
 * encode(data); // "name:test\tcount:42"
 *
 * const nested = { meta: { created: '2024-01-01' } };
 * encode(nested, { keyFolding: 'safe' }); // "meta.created:2024-01-01"
 * ```
 */
export const encode = (value: unknown, options?: ToonOptions): string => {
    const mergedOptions: Required<ToonOptions> = {
        ...DEFAULT_OPTIONS,
        ...options,
    };

    return serializeValue(value, mergedOptions);
};
