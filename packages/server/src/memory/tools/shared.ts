/**
 * Shared helpers and schemas for memory MCP tools.
 *
 * @module server/memory/tools/shared
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { MemoryError } from '@yeseh/cortex-core';

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
// Helper functions
// ---------------------------------------------------------------------------

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
