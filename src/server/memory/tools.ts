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
import { join, resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import {
    parseMemoryFile,
    serializeMemoryFile,
    type MemoryFileContents,
} from '../../core/memory/index.ts';
import { validateMemorySlugPath } from '../../core/memory/validation.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
import { parseIndex } from '../../core/serialization.ts';
import type { ServerConfig } from '../config.ts';
import { getMemoryPath } from '../config.ts';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/** Schema for ISO 8601 date strings */
const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO 8601 date string',
});

/** Schema for memory path (category/slug format) */
const memoryPathSchema = z.string().min(1, 'Memory path is required');

/** Schema for store name */
const storeNameSchema = z.string().min(1, 'Store name is required');

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
}

interface ToolContext {
    config: ServerConfig;
}

/** Standard MCP tool response with text content */
interface McpToolResponse {
    [key: string]: unknown;
    content: { type: 'text'; text: string }[];
}

/** Root memory categories used for listing and pruning operations. */
const ROOT_CATEGORIES = ['human', 'persona', 'project', 'domain'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Resolves the store root directory, auto-creating if needed for writes.
 */
const resolveStoreRoot = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<string, McpError>> => {
    const memoryPath = getMemoryPath(config);
    const storeRoot = resolve(memoryPath, storeName);

    if (autoCreate) {
        try {
            await mkdir(storeRoot, { recursive: true });
        } catch {
            return err(
                new McpError(
                    ErrorCode.InternalError,
                    `Failed to create store directory: ${storeName}`
                )
            );
        }
    }

    return ok(storeRoot);
};

/**
 * Creates a storage adapter for the given store.
 */
const createAdapter = (storeRoot: string): FilesystemStorageAdapter => {
    return new FilesystemStorageAdapter({ rootDirectory: storeRoot });
};

/**
 * Checks if a memory has expired.
 */
const isExpired = (expiresAt: Date | undefined, now: Date): boolean => {
    if (!expiresAt) {
        return false;
    }
    return expiresAt.getTime() <= now.getTime();
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
    input: AddMemoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, true);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const identity = validateMemorySlugPath(input.path);
    if (!identity.ok) {
        throw new McpError(ErrorCode.InvalidParams, identity.error.message);
    }

    const now = new Date();
    const memoryContents: MemoryFileContents = {
        frontmatter: {
            createdAt: now,
            updatedAt: now,
            tags: input.tags ?? [],
            source: 'mcp',
            expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
        },
        content: input.content,
    };

    const serialized = serializeMemoryFile(memoryContents);
    if (!serialized.ok) {
        throw new McpError(ErrorCode.InternalError, serialized.error.message);
    }

    const adapter = createAdapter(storeRoot.value);
    const result = await adapter.writeMemoryFile(identity.value.slugPath, serialized.value, {
        allowIndexCreate: true,
        allowIndexUpdate: true,
    });

    if (!result.ok) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: `Memory created at ${identity.value.slugPath}`,
            },
        ],
    };
};

/**
 * Retrieves memory content and metadata.
 */
export const getMemoryHandler = async (
    ctx: ToolContext,
    input: GetMemoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const identity = validateMemorySlugPath(input.path);
    if (!identity.ok) {
        throw new McpError(ErrorCode.InvalidParams, identity.error.message);
    }

    const adapter = createAdapter(storeRoot.value);
    const readResult = await adapter.readMemoryFile(identity.value.slugPath);

    if (!readResult.ok) {
        throw new McpError(ErrorCode.InternalError, readResult.error.message);
    }

    if (!readResult.value) {
        throw new McpError(ErrorCode.InvalidParams, `Memory not found: ${input.path}`);
    }

    const parsed = parseMemoryFile(readResult.value);
    if (!parsed.ok) {
        throw new McpError(ErrorCode.InternalError, parsed.error.message);
    }

    const now = new Date();
    if (!input.include_expired && isExpired(parsed.value.frontmatter.expiresAt, now)) {
        throw new McpError(ErrorCode.InvalidParams, `Memory expired: ${input.path}`);
    }

    const output = {
        path: identity.value.slugPath,
        content: parsed.value.content,
        metadata: {
            created_at: parsed.value.frontmatter.createdAt.toISOString(),
            updated_at: parsed.value.frontmatter.updatedAt.toISOString(),
            tags: parsed.value.frontmatter.tags,
            source: parsed.value.frontmatter.source,
            expires_at: parsed.value.frontmatter.expiresAt?.toISOString(),
        },
    };

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(output, null, 2),
            },
        ],
    };
};

/**
 * Updates memory content or metadata.
 */
export const updateMemoryHandler = async (
    ctx: ToolContext,
    input: UpdateMemoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const identity = validateMemorySlugPath(input.path);
    if (!identity.ok) {
        throw new McpError(ErrorCode.InvalidParams, identity.error.message);
    }

    const adapter = createAdapter(storeRoot.value);
    const readResult = await adapter.readMemoryFile(identity.value.slugPath);

    if (!readResult.ok) {
        throw new McpError(ErrorCode.InternalError, readResult.error.message);
    }

    if (!readResult.value) {
        throw new McpError(ErrorCode.InvalidParams, `Memory not found: ${input.path}`);
    }

    const parsed = parseMemoryFile(readResult.value);
    if (!parsed.ok) {
        throw new McpError(ErrorCode.InternalError, parsed.error.message);
    }

    // Check if any updates were provided
    const hasUpdates =
        input.content !== undefined ||
        input.tags !== undefined ||
        input.expires_at !== undefined ||
        input.clear_expiry;

    if (!hasUpdates) {
        throw new McpError(
            ErrorCode.InvalidParams,
            'No updates provided. Specify content, tags, expires_at, or clear_expiry.'
        );
    }

    // Build updated memory
    const now = new Date();
    let newExpiresAt: Date | undefined;
    if (input.clear_expiry) {
        newExpiresAt = undefined;
    } else if (input.expires_at) {
        newExpiresAt = new Date(input.expires_at);
    } else {
        newExpiresAt = parsed.value.frontmatter.expiresAt;
    }

    const updatedMemory: MemoryFileContents = {
        frontmatter: {
            createdAt: parsed.value.frontmatter.createdAt,
            updatedAt: now,
            tags: input.tags ?? parsed.value.frontmatter.tags,
            source: parsed.value.frontmatter.source,
            expiresAt: newExpiresAt,
        },
        content: input.content ?? parsed.value.content,
    };

    const serialized = serializeMemoryFile(updatedMemory);
    if (!serialized.ok) {
        throw new McpError(ErrorCode.InternalError, serialized.error.message);
    }

    const writeResult = await adapter.writeMemoryFile(identity.value.slugPath, serialized.value, {
        allowIndexUpdate: true,
    });

    if (!writeResult.ok) {
        throw new McpError(ErrorCode.InternalError, writeResult.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: `Memory updated at ${identity.value.slugPath}`,
            },
        ],
    };
};

/**
 * Deletes a memory.
 */
export const removeMemoryHandler = async (
    ctx: ToolContext,
    input: RemoveMemoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const identity = validateMemorySlugPath(input.path);
    if (!identity.ok) {
        throw new McpError(ErrorCode.InvalidParams, identity.error.message);
    }

    const adapter = createAdapter(storeRoot.value);

    // Check if memory exists first
    const readResult = await adapter.readMemoryFile(identity.value.slugPath);
    if (!readResult.ok) {
        throw new McpError(ErrorCode.InternalError, readResult.error.message);
    }
    if (!readResult.value) {
        throw new McpError(ErrorCode.InvalidParams, `Memory not found: ${input.path}`);
    }

    const result = await adapter.removeMemoryFile(identity.value.slugPath);

    if (!result.ok) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    // Reindex after removal
    const reindexResult = await adapter.reindexCategoryIndexes();
    if (!reindexResult.ok) {
        throw new McpError(
            ErrorCode.InternalError,
            `Memory removed but reindex failed: ${reindexResult.error.message}`
        );
    }

    return {
        content: [
            {
                type: 'text',
                text: `Memory removed at ${identity.value.slugPath}`,
            },
        ],
    };
};

/**
 * Moves or renames a memory.
 */
export const moveMemoryHandler = async (
    ctx: ToolContext,
    input: MoveMemoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const sourceIdentity = validateMemorySlugPath(input.from_path);
    if (!sourceIdentity.ok) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid source path: ${sourceIdentity.error.message}`
        );
    }

    const destIdentity = validateMemorySlugPath(input.to_path);
    if (!destIdentity.ok) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid destination path: ${destIdentity.error.message}`
        );
    }

    const adapter = createAdapter(storeRoot.value);

    // Check if source exists
    const sourceRead = await adapter.readMemoryFile(sourceIdentity.value.slugPath);
    if (!sourceRead.ok) {
        throw new McpError(ErrorCode.InternalError, sourceRead.error.message);
    }
    if (!sourceRead.value) {
        throw new McpError(ErrorCode.InvalidParams, `Source memory not found: ${input.from_path}`);
    }

    // Check if destination already exists
    const destRead = await adapter.readMemoryFile(destIdentity.value.slugPath);
    if (!destRead.ok) {
        throw new McpError(ErrorCode.InternalError, destRead.error.message);
    }
    if (destRead.value) {
        throw new McpError(ErrorCode.InvalidParams, `Destination already exists: ${input.to_path}`);
    }

    // Create destination category directory if needed
    const destCategories = destIdentity.value.categories;
    const destCategoryPath = join(storeRoot.value, ...destCategories);
    try {
        await mkdir(destCategoryPath, { recursive: true });
    } catch {
        throw new McpError(ErrorCode.InternalError, 'Failed to create destination category');
    }

    const result = await adapter.moveMemoryFile(
        sourceIdentity.value.slugPath,
        destIdentity.value.slugPath
    );

    if (!result.ok) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    // Reindex after move
    const reindexResult = await adapter.reindexCategoryIndexes();
    if (!reindexResult.ok) {
        throw new McpError(
            ErrorCode.InternalError,
            `Memory moved but reindex failed: ${reindexResult.error.message}`
        );
    }

    return {
        content: [
            {
                type: 'text',
                text: `Memory moved from ${sourceIdentity.value.slugPath} to ${destIdentity.value.slugPath}`,
            },
        ],
    };
};

/**
 * Lists memories in a category.
 */
export const listMemoriesHandler = async (
    ctx: ToolContext,
    input: ListMemoriesInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const adapter = createAdapter(storeRoot.value);
    const now = new Date();

    // If category is specified, validate and list that category
    // Otherwise list root categories
    const categoryPath = input.category ?? '';

    interface MemoryEntry {
        path: string;
        token_estimate: number;
        summary?: string;
        expires_at?: string;
        is_expired: boolean;
    }

    interface SubcategoryEntry {
        path: string;
        memory_count: number;
        description?: string;
    }

    const memories: MemoryEntry[] = [];
    const subcategories: SubcategoryEntry[] = [];

    const collectMemories = async (catPath: string, visited: Set<string>): Promise<void> => {
        if (visited.has(catPath)) {
            return;
        }
        visited.add(catPath);

        const indexResult = await adapter.readIndexFile(catPath);
        if (!indexResult.ok || !indexResult.value) {
            return;
        }

        const parsed = parseIndex(indexResult.value);
        if (!parsed.ok) {
            return;
        }

        for (const memory of parsed.value.memories) {
            // Read full memory to check expiry
            const memoryRead = await adapter.readMemoryFile(memory.path);
            if (!memoryRead.ok || !memoryRead.value) {
                continue;
            }

            const memoryParsed = parseMemoryFile(memoryRead.value);
            if (!memoryParsed.ok) {
                continue;
            }

            const expired = isExpired(memoryParsed.value.frontmatter.expiresAt, now);
            if (!input.include_expired && expired) {
                continue;
            }

            memories.push({
                path: memory.path,
                token_estimate: memory.tokenEstimate,
                summary: memory.summary,
                expires_at: memoryParsed.value.frontmatter.expiresAt?.toISOString(),
                is_expired: expired,
            });
        }

        // Recurse into subcategories
        for (const subcategory of parsed.value.subcategories) {
            await collectMemories(subcategory.path, visited);
        }
    };

    // Collect direct subcategories of the requested category (for discoverability)
    const collectDirectSubcategories = async (catPath: string): Promise<void> => {
        const indexResult = await adapter.readIndexFile(catPath);
        if (!indexResult.ok || !indexResult.value) {
            return;
        }

        const parsed = parseIndex(indexResult.value);
        if (!parsed.ok) {
            return;
        }

        for (const subcategory of parsed.value.subcategories) {
            subcategories.push({
                path: subcategory.path,
                memory_count: subcategory.memoryCount,
                description: subcategory.description,
            });
        }
    };

    const visited = new Set<string>();

    if (categoryPath) {
        // List specific category
        await collectMemories(categoryPath, visited);
        // Also collect direct subcategories for discoverability
        await collectDirectSubcategories(categoryPath);
    } else {
        // List all root categories
        for (const category of ROOT_CATEGORIES) {
            await collectMemories(category, visited);
        }
        // Collect root-level subcategories
        await collectDirectSubcategories('');
    }

    const output = {
        category: categoryPath || 'all',
        count: memories.length,
        memories,
        subcategories,
    };

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(output, null, 2),
            },
        ],
    };
};

/**
 * Deletes all expired memories.
 */
export const pruneMemoriesHandler = async (
    ctx: ToolContext,
    input: PruneMemoriesInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const adapter = createAdapter(storeRoot.value);
    const now = new Date();

    interface PrunedEntry {
        path: string;
        expires_at: string;
    }

    const pruned: PrunedEntry[] = [];

    const collectExpired = async (catPath: string, visited: Set<string>): Promise<void> => {
        if (visited.has(catPath)) {
            return;
        }
        visited.add(catPath);

        const indexResult = await adapter.readIndexFile(catPath);
        if (!indexResult.ok || !indexResult.value) {
            return;
        }

        const parsed = parseIndex(indexResult.value);
        if (!parsed.ok) {
            return;
        }

        for (const memory of parsed.value.memories) {
            const memoryRead = await adapter.readMemoryFile(memory.path);
            if (!memoryRead.ok || !memoryRead.value) {
                continue;
            }

            const memoryParsed = parseMemoryFile(memoryRead.value);
            if (!memoryParsed.ok) {
                continue;
            }

            const expiresAt = memoryParsed.value.frontmatter.expiresAt;
            if (expiresAt && isExpired(expiresAt, now)) {
                pruned.push({
                    path: memory.path,
                    expires_at: expiresAt.toISOString(),
                });
            }
        }

        for (const subcategory of parsed.value.subcategories) {
            await collectExpired(subcategory.path, visited);
        }
    };

    // Collect all expired memories
    const visited = new Set<string>();
    for (const category of ROOT_CATEGORIES) {
        await collectExpired(category, visited);
    }

    // Delete expired memories
    for (const entry of pruned) {
        const result = await adapter.removeMemoryFile(entry.path);
        if (!result.ok) {
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to prune memory ${entry.path}: ${result.error.message}`
            );
        }
    }

    // Reindex after pruning
    if (pruned.length > 0) {
        const reindexResult = await adapter.reindexCategoryIndexes();
        if (!reindexResult.ok) {
            throw new McpError(
                ErrorCode.InternalError,
                `Memories pruned but reindex failed: ${reindexResult.error.message}`
            );
        }
    }

    const output = {
        pruned_count: pruned.length,
        pruned,
    };

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(output, null, 2),
            },
        ],
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
        }
    );

    // cortex_get_memory
    server.tool(
        'cortex_get_memory',
        'Retrieve memory content and metadata',
        getMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(getMemoryInputSchema, input);
            return getMemoryHandler(ctx, parsed);
        }
    );

    // cortex_update_memory
    server.tool(
        'cortex_update_memory',
        'Update memory content or metadata',
        updateMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(updateMemoryInputSchema, input);
            return updateMemoryHandler(ctx, parsed);
        }
    );

    // cortex_remove_memory
    server.tool(
        'cortex_remove_memory',
        'Delete a memory',
        removeMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(removeMemoryInputSchema, input);
            return removeMemoryHandler(ctx, parsed);
        }
    );

    // cortex_move_memory
    server.tool(
        'cortex_move_memory',
        'Move or rename a memory',
        moveMemoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(moveMemoryInputSchema, input);
            return moveMemoryHandler(ctx, parsed);
        }
    );

    // cortex_list_memories
    server.tool(
        'cortex_list_memories',
        'List memories in a category',
        listMemoriesInputSchema.shape,
        async (input) => {
            const parsed = parseInput(listMemoriesInputSchema, input);
            return listMemoriesHandler(ctx, parsed);
        }
    );

    // cortex_prune_memories
    server.tool(
        'cortex_prune_memories',
        'Delete all expired memories',
        pruneMemoriesInputSchema.shape,
        async (input) => {
            const parsed = parseInput(pruneMemoriesInputSchema, input);
            return pruneMemoriesHandler(ctx, parsed);
        }
    );
};
