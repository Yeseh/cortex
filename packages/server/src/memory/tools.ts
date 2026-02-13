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
import type { Result } from '@yeseh/cortex-core';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import {
    pruneExpiredMemories,
    type MemoryError,
    type MemorySerializer,
} from '@yeseh/cortex-core/memory';
import {
    createMemory,
    getMemory,
    updateMemory,
    removeMemory,
    moveMemory,
    listMemories,
} from '@yeseh/cortex-core/memory';
import { FilesystemRegistry, parseMemory, serializeMemory } from '@yeseh/cortex-storage-fs';
import { resolveStorePath } from '@yeseh/cortex-core/store';
import type { ServerConfig } from '../config.ts';
import { storeNameSchema } from '../store/tools.ts';

// ---------------------------------------------------------------------------
// Memory Serializer
// ---------------------------------------------------------------------------

/** Memory serializer using storage-fs implementation */
const memorySerializer: MemorySerializer = {
    parse: parseMemory,
    serialize: serializeMemory,
};

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
    citations: z.array(z.string().min(1)).optional().describe(
        'Optional citations referencing source material (file paths, URLs, document identifiers)',
    ),
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
    expires_at: isoDateSchema.optional().nullable().describe(
        'New expiration date (ISO 8601). Pass null to clear the expiration. Omit to keep existing value.',
    ),
    citations: z.array(z.string().min(1)).optional().describe(
        'New citations (replaces existing). Omit to keep existing citations.',
    ),
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

/** Schema for reindex_store tool input */
export const reindexStoreInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
});

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

/**
 * Input type for the add_memory MCP tool.
 *
 * @example
 * ```typescript
 * const input: AddMemoryInput = {
 *     store: 'cortex',
 *     path: 'decisions/api-versioning',
 *     content: 'We decided to use URL path versioning for the API.',
 *     tags: ['api', 'versioning'],
 *     citations: [
 *         'docs/api-spec.md',
 *         'https://github.com/org/repo/discussions/42',
 *     ],
 * };
 * ```
 */
export interface AddMemoryInput {
    /** Name of the memory store */
    store: string;
    /** Memory path in category/slug format (e.g., "decisions/api-versioning") */
    path: string;
    /** Memory content (markdown supported) */
    content: string;
    /** Optional tags for categorization and discovery */
    tags?: string[];
    /** Optional expiration date as ISO 8601 string */
    expires_at?: string;
    /**
     * Optional citations referencing source material.
     *
     * Each citation must be a non-empty string representing a file path,
     * URL, or document identifier.
     */
    citations?: string[];
}

/** Input type for get_memory tool */
export interface GetMemoryInput {
    store: string;
    path: string;
    include_expired?: boolean;
}

/**
 * Input type for the update_memory MCP tool.
 *
 * All fields except `store` and `path` are optional. Only provided fields
 * are updated; omitted fields retain their existing values.
 *
 * @example
 * ```typescript
 * // Update content and add new citations (replaces existing citations)
 * const input: UpdateMemoryInput = {
 *     store: 'cortex',
 *     path: 'decisions/api-versioning',
 *     content: 'Updated: We now use semantic versioning headers.',
 *     citations: ['docs/api-spec-v2.md'],
 * };
 *
 * // Clear expiration while keeping everything else
 * const clearExpiry: UpdateMemoryInput = {
 *     store: 'cortex',
 *     path: 'decisions/api-versioning',
 *     expires_at: null,
 * };
 * ```
 */
export interface UpdateMemoryInput {
    /** Name of the memory store */
    store: string;
    /** Memory path in category/slug format */
    path: string;
    /** New content (omit to keep existing) */
    content?: string;
    /** New tags - replaces existing tags when provided */
    tags?: string[];
    /**
     * New expiration date.
     * - ISO 8601 string — set expiration to this date
     * - `null` — explicitly clear (remove) the expiration
     * - `undefined` (omitted) — keep the existing value unchanged
     */
    expires_at?: string | null;
    /**
     * New citations - replaces existing citations when provided.
     *
     * **Update semantics:** When provided, completely replaces the existing
     * citations array. When omitted, existing citations are preserved.
     * To clear all citations, pass an empty array `[]`.
     */
    citations?: string[];
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

/** Input type for reindex_store tool */
export interface ReindexStoreInput {
    store: string;
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
): Promise<Result<ScopedStorageAdapter, McpError>> => {
    const registryPath = join(config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();

    if (!registryResult.ok) {
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
    if (!storeResult.ok) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }

    // Handle autoCreate for directory creation
    if (autoCreate) {
        const storePathResult = resolveStorePath(registryResult.value, storeName);
        if (storePathResult.ok) {
            try {
                await mkdir(storePathResult.value, { recursive: true });
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
        case 'INVALID_CITATIONS':
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

    const result = await createMemory(adapterResult.value, memorySerializer, input.path, {
        content: input.content,
        tags: input.tags,
        source: 'mcp',
        expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
        citations: input.citations,
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

    const result = await getMemory(adapterResult.value, memorySerializer, input.path, {
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
            created_at: memory.metadata.createdAt.toISOString(),
            updated_at: memory.metadata.updatedAt?.toISOString(),
            tags: memory.metadata.tags,
            source: memory.metadata.source,
            expires_at: memory.metadata.expiresAt?.toISOString(),
            citations: memory.metadata.citations,
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
    if (input.content === undefined && input.tags === undefined && 
        input.expires_at === undefined && input.citations === undefined) {
        throw new McpError(
            ErrorCode.InvalidParams,
            'No updates provided. Specify content, tags, expires_at, or citations.',
        );
    }

    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await updateMemory(adapterResult.value, memorySerializer, input.path, {
        content: input.content,
        tags: input.tags,
        expiresAt: input.expires_at === null
            ? null
            : input.expires_at
                ? new Date(input.expires_at)
                : undefined,
        citations: input.citations,
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

    const result = await listMemories(adapterResult.value, memorySerializer, {
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

    const result = await pruneExpiredMemories(adapterResult.value, memorySerializer, { dryRun });
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

/**
 * Rebuilds all category indexes for a store from the filesystem state.
 *
 * This is a repair operation that scans all categories and regenerates
 * their index files. Use when indexes may be out of sync with actual
 * memory files on disk, such as after manual file modifications or
 * corruption recovery.
 *
 * The operation returns any warnings about files that could not be
 * indexed normally, such as files with paths that normalize to empty
 * strings or collisions between normalized paths.
 *
 * @param ctx - Tool context containing server configuration
 * @param input - Input containing the store name to reindex
 * @returns MCP response with store name and any reindex warnings
 * @throws {McpError} When store resolution fails (InvalidParams) or
 *                    reindex operation errors (InternalError)
 */
export const reindexStoreHandler = async (
    ctx: ToolContext,
    input: ReindexStoreInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await adapterResult.value.indexes.reindex();
    if (!result.ok) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    const output = {
        store: input.store,
        warnings: result.value.warnings,
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
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

    // cortex_reindex_store
    server.tool(
        'cortex_reindex_store',
        'Rebuild category indexes for a store',
        reindexStoreInputSchema.shape,
        async (input) => {
            const parsed = parseInput(reindexStoreInputSchema, input);
            return reindexStoreHandler(ctx, parsed);
        },
    );
};
