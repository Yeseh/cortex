/**
 * Shared helpers and schemas for memory MCP tools.
 *
 * @module server/memory/tools/shared
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { Result, Cortex } from '@yeseh/cortex-core';
import type { StorageAdapter } from '@yeseh/cortex-core/storage';
import { err, ok, type MemoryError } from '@yeseh/cortex-core';
import type { ServerConfig } from '../../config.ts';

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

/** Schema for ISO 8601 date strings */
export const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO 8601 date string',
});

/** Schema for memory path (category/slug format) */
export const memoryPathSchema = z.string().min(1, 'Memory path is required');

/** Schema for tags array */
export const tagsSchema = z.array(z.string()).optional();

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ToolContext {
    config: ServerConfig;
    cortex: Cortex;
}

/** Standard MCP tool response with text content */
export interface McpToolResponse {
    [key: string]: unknown;
    content: { type: 'text'; text: string }[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Resolves a storage adapter for the given store.
 *
 * @param ctx - Tool context containing cortex instance
 * @param storeName - Name of the store to resolve
 * @returns A Result containing either the adapter or an MCP error
 */
export const resolveStoreAdapter = (
    ctx: ToolContext,
    storeName: string,
): Result<StorageAdapter, McpError> => {
    const store = ctx.cortex.getStore(storeName);
    if (!store.exists()) {
        const error = store.getError();
        return err(new McpError(ErrorCode.InvalidParams, error?.message ?? `Store '${storeName}' not found`));
    }
    return ok(store.getAdapter());
};

/**
 * Translates a domain MemoryError to an MCP McpError.
 * Maps domain error codes to appropriate MCP error codes.
 *
 * Error code mapping:
 * - Client-correctable → InvalidParams (user can fix and retry)
 * - Parsing/corruption → InternalError (data issue, not user's fault)
 * - Storage/infrastructure → InternalError (server-side issue)
 */
export const translateMemoryError = (error: MemoryError): McpError => {
    switch (error.code) {
        // Client-correctable errors (InvalidParams)
        case 'MEMORY_NOT_FOUND':
            return new McpError(
                ErrorCode.InvalidParams,
                `Memory not found: ${error.path}`,
            );
        case 'MEMORY_EXPIRED':
            return new McpError(
                ErrorCode.InvalidParams,
                `Memory expired: ${error.path}`,
            );
        case 'INVALID_PATH':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'INVALID_INPUT':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'DESTINATION_EXISTS':
            return new McpError(
                ErrorCode.InvalidParams,
                `Destination already exists: ${error.path}`,
            );

        // Parsing/validation errors (corrupted data)
        case 'MISSING_FRONTMATTER':
        case 'INVALID_FRONTMATTER':
        case 'MISSING_FIELD':
        case 'INVALID_TIMESTAMP':
        case 'INVALID_TAGS':
        case 'INVALID_SOURCE':
        case 'INVALID_CITATIONS':
            return new McpError(
                ErrorCode.InternalError,
                `Memory file corrupted: ${error.message}`,
            );

        // Storage/infrastructure errors
        case 'STORAGE_ERROR':
            return new McpError(ErrorCode.InternalError, error.message);

        default:
            return new McpError(ErrorCode.InternalError, `Unknown error: ${error.message}`);
    }
};

/**
 * Parses and validates a Zod schema, throwing McpError on failure.
 */
export const parseInput = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const message = result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new McpError(ErrorCode.InvalidParams, message);
    }
    return result.data;
};
