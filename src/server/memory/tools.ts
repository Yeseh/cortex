/**
 * MCP memory tools for CRUD operations on memories.
 *
 * This module provides MCP tools for AI agents to create, read, update,
 * delete, move, list, and prune memories. It implements agent-friendly
 * behavior including auto-creation of stores and categories.
 *
 * @module server/memory/tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '../../core/types.ts';
import {
    pruneExpiredMemories,
    type MemoryError,
} from '../../core/memory/index.ts';
import {
    createMemory,
    getMemory,
    updateMemory,
    removeMemory,
    moveMemory,
    listMemories,
} from '../../core/memory/operations.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
import type { ComposedStorageAdapter } from '../../core/storage/adapter.ts';
import { loadStoreRegistry, resolveStorePath } from '../../core/store/registry.ts';
import type { ServerConfig } from '../config.ts';
import { storeNameSchema } from '../store/tools.ts';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/** Schema for ISO 8601 date strings */
const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO 8601 date string',
});

/** Schema for memory path (category/slug format) */
const memoryPathSchema = z.string().min(1, 'Memory path is required');

/** Schema for tags array */
const tagsSchema = z.array(z.string()).optional();

/** Schema for add_memory tool input */
export const addMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().min(1, 'Content is required').describe('Memory content'),
    tags: tagsSchema.describe('Optional tags for categorization'),
    expires_at: isoDateSchema.optional().describe('Optional expiration date (ISO 8601)'),
});

/** Schema for get_memory tool input */
export const getMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    include_expired: z.boolean().optional().default(false).describe('Include expired memories'),
});

/** Schema for update_memory tool input */
export const updateMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().optional().describe('New memory content'),
    tags: tagsSchema.describe('New tags (replaces existing)'),
    expires_at: isoDateSchema.optional().describe('New expiration date (ISO 8601)'),
    clear_expiry: z.boolean().optional().default(false).describe('Remove expiration date'),
});

/** Schema for remove_memory tool input */
export const removeMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
});

/** Schema for move_memory tool input */
export const moveMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    from_path: memoryPathSchema.describe('Source memory path'),
    to_path: memoryPathSchema.describe('Destination memory path'),
});

/** Schema for list_memories tool input */
export const listMemoriesInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    category: z
        .string()
        .optional()
        .describe('Category path to list (lists root categories if omitted)'),
    include_expired: z.boolean().optional().default(false).describe('Include expired memories'),
});

/** Schema for prune_memories tool input */
export const pruneMemoriesInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    dry_run: z
        .boolean()
        .default(false)
        .describe('Preview which memories would be pruned without deleting them'),
});

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

/** Input type for add_memory tool */
export interface AddMemoryInput {
    store: string;
    path: string;
    content: string;
    tags?: string[];
    expires_at?: string;
}

/** Input type for get_memory tool */
export interface GetMemoryInput {
    store: string;
    path: string;
    include_expired?: boolean;
}

/** Input type for update_memory tool */
export interface UpdateMemoryInput {
    store: string;
    path: string;
    content?: string;
    tags?: string[];
    expires_at?: string;
    clear_expiry?: boolean;
}

/** Input type for remove_memory tool */
export interface RemoveMemoryInput {
    store: string;
    path: string;
}

/** Input type for move_memory tool */
export interface MoveMemoryInput {
    store: string;
    from_path: string;
    to_path: string;
}

/** Input type for list_memories tool */
export interface ListMemoriesInput {
    store: string;
    category?: string;
    include_expired?: boolean;
}

/** Input type for prune_memories tool */
export interface PruneMemoriesInput {
    store: string;
    dry_run?: boolean;
}

interface ToolContext {
    config: ServerConfig;
}

/** Standard MCP tool response with text content */
interface McpToolResponse {
    [key: string]: unknown;
    content: { type: 'text'; text: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a successful Result wrapper. */
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Creates a failed Result wrapper. */
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Resolves a storage adapter for the given store.
 *
 * @param config - Server configuration containing data path
 * @param storeName - Name of the store to resolve
 * @param autoCreate - If true, creates the store root directory if missing.
 *                     Note: This controls only the store root, not category directories.
 *                     Domain operations may create category directories as needed.
 * @returns A Result containing either the adapter or an MCP error
 */
const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean,
): Promise<Result<ComposedStorageAdapter, McpError>> => {
    const registryPath = join(config.dataPath, 'stores.yaml');
    const registryResult = await loadStoreRegistry(registryPath, {
        allowMissing: false,
    });

    if (!registryResult.ok) {
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to load store registry: ${registryResult.error.message}`,
            ),
        );
    }

    const storePathResult = resolveStorePath(registryResult.value, storeName);
    if (!storePathResult.ok) {
        return err(
            new McpError(ErrorCode.InvalidParams, storePathResult.error.message),
        );
    }

    const storeRoot = storePathResult.value;

    if (autoCreate) {
        try {
            await mkdir(storeRoot, { recursive: true });
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return err(
                new McpError(
                    ErrorCode.InternalError,
                    `Failed to create store directory '${storeName}': ${message}`,
                ),
            );
        }
    }

    return ok(new FilesystemStorageAdapter({ rootDirectory: storeRoot }));
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
const translateMemoryError = (error: MemoryError): McpError => {
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
            return new McpError(
                ErrorCode.InternalError,
                `Memory file corrupted: ${error.message}`,
            );

        // Storage/infrastructure errors
        case 'STORAGE_ERROR':
            return new McpError(ErrorCode.InternalError, error.message);
    }
};

/**
 * Parses and validates a Zod schema, throwing McpError on failure.
 */
const parseInput = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const message = result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new McpError(ErrorCode.InvalidParams, message);
    }
    return result.data;
};

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

/**
 * Creates a new memory with auto-creation of stores and categories.
 */
export const addMemoryHandler = async (
    ctx: ToolContext,
    input: AddMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, true);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await createMemory(adapterResult.value, input.path, {
        content: input.content,
        tags: input.tags,
        source: 'mcp',
        expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [{ type: 'text', text: `Memory created at ${input.path}` }],
    };
};

/**
 * Retrieves memory content and metadata.
 */
export const getMemoryHandler = async (
    ctx: ToolContext,
    input: GetMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await getMemory(adapterResult.value, input.path, {
        includeExpired: input.include_expired,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    const memory = result.value;
    const output = {
        path: input.path,
        content: memory.content,
        metadata: {
            created_at: memory.frontmatter.createdAt.toISOString(),
            updated_at: memory.frontmatter.updatedAt.toISOString(),
            tags: memory.frontmatter.tags,
            source: memory.frontmatter.source,
            expires_at: memory.frontmatter.expiresAt?.toISOString(),
        },
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    };
};

/**
 * Updates memory content or metadata.
 */
export const updateMemoryHandler = async (
    ctx: ToolContext,
    input: UpdateMemoryInput,
): Promise<McpToolResponse> => {
    // Validate that at least one update field is provided
    if (!input.content && !input.tags && !input.expires_at && !input.clear_expiry) {
        throw new McpError(
            ErrorCode.InvalidParams,
            'No updates provided. Specify content, tags, expires_at, or clear_expiry.',
        );
    }

    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await updateMemory(adapterResult.value, input.path, {
        content: input.content,
        tags: input.tags,
        expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
        clearExpiry: input.clear_expiry,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [{ type: 'text', text: `Memory updated at ${input.path}` }],
    };
};

/**
 * Deletes a memory.
 */
export const removeMemoryHandler = async (
    ctx: ToolContext,
    input: RemoveMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await removeMemory(adapterResult.value, input.path);

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [{ type: 'text', text: `Memory removed at ${input.path}` }],
    };
};

/**
 * Moves or renames a memory.
 */
export const moveMemoryHandler = async (
    ctx: ToolContext,
    input: MoveMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await moveMemory(adapterResult.value, input.from_path, input.to_path);

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [{
            type: 'text',
            text: `Memory moved from ${input.from_path} to ${input.to_path}`,
        }],
    };
};

/**
 * Lists memories in a category.
 */
export const listMemoriesHandler = async (
    ctx: ToolContext,
    input: ListMemoriesInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await listMemories(adapterResult.value, {
        category: input.category,
        includeExpired: input.include_expired,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    const listResult = result.value;
    const output = {
        category: listResult.category || 'all',
        count: listResult.memories.length,
        memories: listResult.memories.map((m) => ({
            path: m.path,
            token_estimate: m.tokenEstimate,
            summary: m.summary,
            expires_at: m.expiresAt?.toISOString(),
            is_expired: m.isExpired,
        })),
        subcategories: listResult.subcategories.map((s) => ({
            path: s.path,
            memory_count: s.memoryCount,
            description: s.description,
        })),
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    };
};

/**
 * Deletes all expired memories.
 * Delegates to core pruneExpiredMemories operation.
 */
export const pruneMemoriesHandler = async (
    ctx: ToolContext,
    input: PruneMemoriesInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const dryRun = input.dry_run ?? false;

    const result = await pruneExpiredMemories(adapterResult.value, { dryRun });
    if (!result.ok) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    // Format output for MCP response
    const prunedEntries = result.value.pruned.map((m) => ({
        path: m.path,
        expires_at: m.expiresAt.toISOString(),
    }));

    if (dryRun) {
        const output = {
            dry_run: true,
            would_prune_count: prunedEntries.length,
            would_prune: prunedEntries,
        };

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(output, null, 2),
            }],
        };
    }

    const output = {
        pruned_count: prunedEntries.length,
        pruned: prunedEntries,
    };

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2),
        }],
    };
};

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Registers all memory tools with the MCP server.
 */
export const registerMemoryTools = (server: McpServer, config: ServerConfig): void => {
    const ctx: ToolContext = { config };

    // cortex_add_memory
    server.tool(
        'cortex_add_memory',
        'Create a new memory with auto-creation of stores and categories',
        addMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(addMemoryInputSchema, input);
            return addMemoryHandler(ctx, parsed);
        },
    );

    // cortex_get_memory
    server.tool(
        'cortex_get_memory',
        'Retrieve memory content and metadata',
        getMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(getMemoryInputSchema, input);
            return getMemoryHandler(ctx, parsed);
        },
    );

    // cortex_update_memory
    server.tool(
        'cortex_update_memory',
        'Update memory content or metadata',
        updateMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(updateMemoryInputSchema, input);
            return updateMemoryHandler(ctx, parsed);
        },
    );

    // cortex_remove_memory
    server.tool(
        'cortex_remove_memory',
        'Delete a memory',
        removeMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(removeMemoryInputSchema, input);
            return removeMemoryHandler(ctx, parsed);
        },
    );

    // cortex_move_memory
    server.tool(
        'cortex_move_memory',
        'Move or rename a memory',
        moveMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(moveMemoryInputSchema, input);
            return moveMemoryHandler(ctx, parsed);
        },
    );

    // cortex_list_memories
    server.tool(
        'cortex_list_memories',
        'List memories in a category',
        listMemoriesInputSchema.shape,
        async (input) => {
            const parsed = parseInput(listMemoriesInputSchema, input);
            return listMemoriesHandler(ctx, parsed);
        },
    );

    // cortex_prune_memories
    server.tool(
        'cortex_prune_memories',
        'Delete all expired memories',
        pruneMemoriesInputSchema.shape,
        async (input) => {
            const parsed = parseInput(pruneMemoriesInputSchema, input);
            return pruneMemoriesHandler(ctx, parsed);
        },
    );
};
