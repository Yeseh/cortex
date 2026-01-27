/**
 * Generic serialization module for output formatting.
 *
 * Provides a simple serialize(obj, format) function that works on any object
 * using standard libraries: JSON.stringify for JSON, yaml lib for YAML,
 * and @toon-format/toon for TOON format.
 */

import YAML from 'yaml';
import { encode as toonEncode } from '@toon-format/toon';

/** Supported output formats */
export type OutputFormat = 'yaml' | 'json' | 'toon';

/** TOON encoder options for token-efficient output */
export const toonOptions = {
    delimiter: '\t',
    keyFolding: 'safe',
} as const;

/**
 * Serialize any object to the specified format.
 *
 * @param obj - The object to serialize (must be JSON-serializable)
 * @param format - The output format ('yaml', 'json', or 'toon')
 * @returns Serialized string representation
 * @throws Error if serialization fails
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
