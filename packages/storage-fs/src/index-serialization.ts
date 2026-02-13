/**
 * Internal serialization helpers for category indexes.
 *
 * Converts between YAML (snake_case) and CategoryIndex (camelCase).
 * This module is intentionally not exported from the package entrypoint.
 *
 * @module storage-fs/index-serialization
 */

import YAML from 'yaml';
import { z } from 'zod';
import type { Result } from '@yeseh/cortex-core';
import type { CategoryIndex } from '@yeseh/cortex-core/index';
import { ok, err } from './utils.ts';

/**
 * Error type for index serialization/deserialization operations.
 */
export interface IndexSerializationError {
    code: 'PARSE_FAILED' | 'SERIALIZE_FAILED' | 'VALIDATION_FAILED';
    message: string;
    cause?: unknown;
}

/**
 * Zod schema for index memory entry (snake_case YAML format).
 * @internal
 */
const IndexMemoryEntrySchema = z.object({
    path: z.string().min(1),
    token_estimate: z.number().int().nonnegative(),
    summary: z.string().optional(),
    updated_at: z.union([
        z.string().datetime(), z.date(),
    ]).optional(),
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
 */
export const parseIndex = (raw: string): Result<CategoryIndex, IndexSerializationError> => {
    let parsedYaml: unknown;
    try {
        parsedYaml = YAML.parse(raw) as unknown;
    }
    catch (cause) {
        return err({
            code: 'PARSE_FAILED',
            message: 'Failed to parse YAML for category index.',
            cause,
        });
    }

    const parsed = CategoryIndexSchema.safeParse(parsedYaml);
    if (!parsed.success) {
        return err({
            code: 'VALIDATION_FAILED',
            message: 'Invalid category index format.',
            cause: parsed.error,
        });
    }

    return ok({
        memories: parsed.data.memories.map((memory) => ({
            path: memory.path,
            tokenEstimate: memory.token_estimate,
            ...(memory.summary ? { summary: memory.summary } : {}),
            ...(memory.updated_at
                ? {
                    updatedAt:
                        memory.updated_at instanceof Date
                            ? memory.updated_at
                            : new Date(memory.updated_at),
                }
                : {}),
        })),
        subcategories: parsed.data.subcategories.map((subcategory) => ({
            path: subcategory.path,
            memoryCount: subcategory.memory_count,
            ...(subcategory.description ? { description: subcategory.description } : {}),
        })),
    });
};

/**
 * Serialize CategoryIndex to YAML string.
 */
export const serializeIndex = (
    index: CategoryIndex,
): Result<string, IndexSerializationError> => {
    const yamlData = {
        memories: index.memories.map((memory) => ({
            path: memory.path,
            token_estimate: memory.tokenEstimate,
            ...(memory.summary ? { summary: memory.summary } : {}),
            ...(memory.updatedAt ? { updated_at: memory.updatedAt.toISOString() } : {}),
        })),
        subcategories: index.subcategories.map((subcategory) => ({
            path: subcategory.path,
            memory_count: subcategory.memoryCount,
            ...(subcategory.description ? { description: subcategory.description } : {}),
        })),
    };

    try {
        return ok(YAML.stringify(yamlData));
    }
    catch (cause) {
        return err({
            code: 'SERIALIZE_FAILED',
            message: 'Failed to serialize category index to YAML.',
            cause,
        });
    }
};
