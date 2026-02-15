/**
 * Shared helpers and schemas for memory MCP tools.
 *
 * @module server/memory/tools/shared
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { join } from 'node:path';
import type { Result } from '@yeseh/cortex-core';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { err, ok, type MemoryError, type Cortex } from '@yeseh/cortex-core';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
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

/** Context passed to MCP tool handlers */
export interface ToolContext {
    config: ServerConfig;
    /** Optional Cortex instance for store resolution (preferred when available) */
    cortex?: Cortex;
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
 * Uses Cortex if available, falls back to FilesystemRegistry.
 *
 * @param ctx - Tool context containing config and optional Cortex instance
 * @param storeName - Name of the store to resolve
 * @returns A Result containing either the adapter or an MCP error
 */
export const resolveStoreAdapter = async (
    ctx: ToolContext,
    storeName: string,
): Promise<Result<ScopedStorageAdapter, McpError>> => {
    // Use Cortex if available (preferred path)
    if (ctx.cortex) {
        const result = ctx.cortex.getStore(storeName);
        if (!result.ok()) {
            return err(new McpError(ErrorCode.InvalidParams, result.error.message));
        }
        return ok(result.value);
    }

    // Fall back to FilesystemRegistry (backward compatibility)
    const registryPath = join(ctx.config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();

    if (!registryResult.ok()) {
        // Map REGISTRY_MISSING to appropriate error (like allowMissing: false did)
        if (registryResult.error.code === 'REGISTRY_MISSING') {
            return err(
                new McpError(
                    ErrorCode.InternalError,
                    `Store registry not found at ${registryPath}`,
                ),
            );
        }
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to load store registry: ${registryResult.error.message}`,
            ),
        );
    }

    // Use registry.getStore() to get scoped adapter
    const storeResult = registry.getStore(storeName);
    if (!storeResult.ok()) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }

    return ok(storeResult.value);
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
