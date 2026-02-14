/**
 * Output format types and serialization helpers.
 *
 * This module provides type definitions for CLI output payloads and a thin
 * wrapper around the core serialize function. Validation is expected to happen
 * at object construction time, not during serialization.
 */

import { err, ok, type Result } from '@yeseh/cortex-core';
import { serialize, type OutputFormat } from '@yeseh/cortex-core';

// Re-export OutputFormat from core
export type { OutputFormat };

export interface OutputMemoryMetadata {
    createdAt: Date;
    updatedAt?: Date;
    tags: string[];
    source?: string;
    tokenEstimate?: number;
    expiresAt?: Date;
}

export interface OutputMemory {
    path: string;
    metadata: OutputMemoryMetadata;
    content: string;
}

export interface OutputCategoryMemory {
    path: string;
    tokenEstimate?: number;
    summary?: string;
}

export interface OutputSubcategory {
    path: string;
    memoryCount: number;
}

export interface OutputCategory {
    path: string;
    memories: OutputCategoryMemory[];
    subcategories: OutputSubcategory[];
}

export interface OutputStore {
    name: string;
    path: string;
}

export interface OutputStoreRegistry {
    stores: OutputStore[];
}

export interface OutputStoreInit {
    path: string;
    name: string;
}

export interface OutputInit {
    path: string;
    categories: string[];
}

export type OutputPayload =
    | { kind: 'memory'; value: OutputMemory }
    | { kind: 'category'; value: OutputCategory }
    | { kind: 'store'; value: OutputStore }
    | { kind: 'store-registry'; value: OutputStoreRegistry }
    | { kind: 'store-init'; value: OutputStoreInit }
    | { kind: 'init'; value: OutputInit };

export interface OutputSerializeError {
    code: 'INVALID_FORMAT' | 'SERIALIZE_FAILED';
    message: string;
}

/** Re-export toonOptions for backwards compatibility */
export { toonOptions } from '@yeseh/cortex-core';

/**
 * Serialize an output payload to the specified format.
 *
 * This is a thin wrapper around the core serialize function that extracts
 * the value from the discriminated union and handles errors.
 *
 * @param payload - The output payload to serialize
 * @param format - The output format ('yaml', 'json', or 'toon')
 * @returns Result with serialized string or error
 */
export const serializeOutput = (
    payload: OutputPayload,
    format: OutputFormat,
): Result<string, OutputSerializeError> => {
    const result = serialize(payload.value, format);

    if (result.ok()) {
        return ok(result.value);
    }

    return err({
        code: result.error.code === 'INVALID_FORMAT' ? 'INVALID_FORMAT' : 'SERIALIZE_FAILED',
        message: result.error.message,
    });
};
