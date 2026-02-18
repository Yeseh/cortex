/**
 * MCP memory resources for browsing and discovery.
 *
 * This module provides MCP resources for AI agents to browse memory stores,
 * categories, and individual memories through URI-based resource access.
 *
 * URI Pattern: `cortex://memory/{store}/{path}`
 * - Trailing slash indicates category listing request
 * - No trailing slash indicates memory content request
 *
 * @module server/memory/resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import type { ReadResourceResult, Resource } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { CategoryPath, err, ok, type Result } from '@yeseh/cortex-core';
import { getMemory } from '@yeseh/cortex-core/memory';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import type { ToolContext } from './tools/shared.ts';
import type { ServerConfig } from '../config.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Root memory categories used as a fallback for listing operations.
 *
 * These are the historical top-level categories in the memory hierarchy.
 * They are only used when the root index is missing or unreadable, to
 * preserve existing behavior for root listings and resource discovery.
 */
const ROOT_CATEGORIES = [
    'human',
    'persona',
    'project',
    'domain',
] as const;

/**
 * URI scheme prefix for memory resources.
 *
 * All memory resource URIs follow the pattern: `cortex://memory/{store}/{path}`
 */
const MEMORY_URI_SCHEME = 'cortex://memory';

/**
 * Resolves a scoped storage adapter for a store.
 *
 * Uses the Cortex client to get a store-specific adapter.
 * This approach ensures all store access goes through the centralized registry.
 *
 * @param ctx - Tool context containing cortex instance and config
 * @param storeName - Optional store name; uses default store if undefined
 * @returns Result containing ScopedStorageAdapter or McpError
 *
 * @example
 * ```ts
 * const result = resolveAdapter(ctx, 'my-store');
 * if (result.ok()) {
 *     const memory = await result.value.memories.read('project/my-memory');
 * }
 * ```
 */
const resolveAdapter = (
    ctx: ToolContext,
    storeName: string | undefined,
): Result<ScopedStorageAdapter, McpError> => {
    const store = storeName ?? ctx.config.defaultStore;
    const storeResult = ctx.cortex.getStore(store);

    if (!storeResult.ok()) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }

    return ok(storeResult.value.getAdapter());
};

/**
 * Builds a resource URI for a memory or category.
 *
 * Constructs a properly formatted URI following the cortex memory resource
 * pattern. Category URIs include a trailing slash to distinguish them from
 * memory content URIs.
 *
 * @param store - Store name to include in the URI
 * @param path - Memory or category path within the store
 * @param isCategory - Whether this is a category listing (adds trailing slash)
 * @returns Formatted resource URI string
 *
 * @example
 * ```ts
 * // Memory content URI
 * buildResourceUri('global', 'project/my-memory', false);
 * // Returns: 'cortex://memory/global/project/my-memory'
 *
 * // Category listing URI
 * buildResourceUri('global', 'project', true);
 * // Returns: 'cortex://memory/global/project/'
 *
 * // Store root listing URI
 * buildResourceUri('global', '', true);
 * // Returns: 'cortex://memory/global/'
 * ```
 */
const buildResourceUri = (store: string, path: string, isCategory: boolean): string => {
    if (!path) {
        return `${MEMORY_URI_SCHEME}/${store}/`;
    }
    const suffix = isCategory && !path.endsWith('/') ? '/' : '';
    return `${MEMORY_URI_SCHEME}/${store}/${path}${suffix}`;
};

type ListResourcesOutput = {
    resources: Resource[];
};

type ListResourcesResult = Result<ListResourcesOutput, McpError>;

/**
 * Parsed URI variables extracted from a resource template.
 *
 * Contains the resolved store name, path, and whether the request
 * is for a category listing (trailing slash) or memory content.
 */
interface ParsedUriVariables {
    /** Store name resolved from URI or default config */
    store: string;
    /** Memory or category path with trailing slash removed */
    path: string;
    /** True if original URI had trailing slash (category listing request) */
    isCategory: boolean;
}

/**
 * Extracts a string value from a Variables entry.
 *
 * Handles both single string values and string arrays (from URI template
 * path expansion). Arrays are joined with '/' to reconstruct the path.
 *
 * @param value - Variable value from URI template (string, string[], or undefined)
 * @returns Extracted string value, or empty string if undefined
 */
const getVariableString = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
        return value.join('/');
    }
    return value ?? '';
};

/**
 * Parses URI template variables into a structured format.
 *
 * Extracts store name and path from MCP resource template variables,
 * applying defaults from config and detecting category vs memory requests.
 *
 * @param variables - URI template variables from MCP SDK
 * @param config - Server configuration for default store
 * @returns Result containing parsed variables or McpError
 *
 * @example
 * ```ts
 * const variables = { store: 'global', 'path*': 'project/my-memory' };
 * const result = parseUriVariables(variables, config);
 * // result.value = { store: 'global', path: 'project/my-memory', isCategory: false }
 *
 * const categoryVars = { store: 'global', 'path*': 'project/' };
 * const catResult = parseUriVariables(categoryVars, config);
 * // catResult.value = { store: 'global', path: 'project', isCategory: true }
 * ```
 */
const parseUriVariables = (
    variables: Variables,
    config: ServerConfig,
): Result<ParsedUriVariables, McpError> => {
    const store = getVariableString(variables.store) || config.defaultStore;
    const rawPath = getVariableString(variables['path*']);

    // Trailing slash indicates category listing
    const isCategory = rawPath.endsWith('/') || rawPath === '';
    const path = rawPath.replace(/\/$/, '');

    return ok({ store, path, isCategory });
};

// ---------------------------------------------------------------------------
// Resource Handlers
// ---------------------------------------------------------------------------

/**
 * Category listing response structure.
 *
 * Represents the JSON response returned when requesting a category URI
 * (with trailing slash). Contains information about memories and
 * subcategories within the requested category.
 *
 * @example
 * ```json
 * {
 *   "category": "project",
 *   "memories": [
 *     {
 *       "path": "project/my-memory",
 *       "uri": "cortex://memory/global/project/my-memory",
 *       "tokenEstimate": 150,
 *       "summary": "Project configuration notes"
 *     }
 *   ],
 *   "subcategories": [
 *     {
 *       "path": "project/frontend",
 *       "uri": "cortex://memory/global/project/frontend/",
 *       "memoryCount": 5
 *     }
 *   ]
 * }
 * ```
 */
interface CategoryListing {
    /** Category path being listed (empty string for root) */
    category: string;
    /** Memories directly within this category */
    memories: {
        /** Full memory path (category/slug) */
        path: string;
        /** Resource URI for retrieving memory content */
        uri: string;
        /** Estimated token count for the memory content */
        tokenEstimate: number;
        /** Optional summary extracted from memory */
        summary?: string;
    }[];
    /** Subcategories within this category */
    subcategories: {
        /** Full subcategory path */
        path: string;
        /** Resource URI for listing subcategory contents */
        uri: string;
        /** Total number of memories in this subcategory */
        memoryCount: number;
    }[];
}

/**
 * Reads memory content for a specific memory path.
 *
 * Validates the memory path, reads the memory file from storage, and
 * parses it to extract the content. Returns the content as a plain text
 * resource.
 *
 * @param adapter - Scoped storage adapter for memory operations
 * @param store - Store name for building the response URI
 * @param memoryPath - Memory path in category/slug format
 * @returns Result containing ReadResourceResult or McpError
 *
 * @example
 * ```ts
 * const adapterResult = await resolveAdapter(config, 'global');
 * if (adapterResult.ok()) {
 *     const result = await readMemoryContent(adapterResult.value, 'global', 'project/my-memory');
 *     if (result.ok()) {
 *       console.log(result.value.contents[0].text);
 *     }
 * }
 * ```
 */
const readMemoryContent = async (
    adapter: ScopedStorageAdapter,
    store: string,
    memoryPath: string,
): Promise<Result<ReadResourceResult, McpError>> => {
    // Read the memory
    const readResult = await getMemory(adapter, memoryPath, {
        includeExpired: true,
        now: new Date(),
    });
    if (!readResult.ok()) {
        if (readResult.error.code === 'INVALID_PATH') {
            return err(
                new McpError(
                    ErrorCode.InvalidParams,
                    `Invalid memory path: ${readResult.error.message}`,
                ),
            );
        }

        if (
            readResult.error.code === 'MEMORY_NOT_FOUND' ||
            readResult.error.code === 'MEMORY_EXPIRED'
        ) {
            return err(new McpError(ErrorCode.InvalidParams, `Memory not found: ${memoryPath}`));
        }

        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to read memory: ${readResult.error.message}`,
            ),
        );
    }

    const uri = buildResourceUri(store, memoryPath, false);

    return ok({
        contents: [{
            uri,
            mimeType: 'text/plain',
            text: readResult.value.content,
        }],
    });
};

/**
 * Reads category listing for a category path.
 *
 * Returns a JSON listing of all memories and subcategories within the
 * specified category. For the root path (empty string), delegates to
 * readRootCategoryListing.
 *
 * @param adapter - Scoped storage adapter for index operations
 * @param store - Store name for building response URIs
 * @param categoryPath - Category path to list (empty for root)
 * @returns Result containing ReadResourceResult with JSON listing or McpError
 *
 * @example
 * ```ts
 * const adapterResult = await resolveAdapter(config, 'global');
 * if (adapterResult.ok()) {
 *     // List specific category
 *     const projectResult = await readCategoryListing(adapterResult.value, 'global', 'project');
 *     if (projectResult.ok()) {
 *       const listing = JSON.parse(projectResult.value.contents[0].text);
 *       console.log(listing.memories);  // Array of memory entries
 *     }
 * }
 * ```
 */
const readCategoryListing = async (
    adapter: ScopedStorageAdapter,
    store: string,
    categoryPath: string,
): Promise<Result<ReadResourceResult, McpError>> => {
    // Handle root listing (empty path)
    if (!categoryPath) {
        return readRootCategoryListing(adapter, store);
    }

    // Parse category path
    const categoryPathResult = CategoryPath.fromString(categoryPath);
    if (!categoryPathResult.ok()) {
        return err(
            new McpError(
                ErrorCode.InvalidParams,
                `Invalid category path: ${categoryPathResult.error.message}`,
            ),
        );
    }

    // Read the category index
    const indexResult = await adapter.indexes.read(categoryPathResult.value);
    if (!indexResult.ok()) {
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to read category index: ${indexResult.error.message}`,
            ),
        );
    }

    if (!indexResult.value) {
        return err(new McpError(ErrorCode.InvalidParams, `Category not found: ${categoryPath}`));
    }

    const listing: CategoryListing = {
        category: categoryPath,
        memories: indexResult.value.memories.map((memory) => ({
            path: memory.path.toString(),
            uri: buildResourceUri(store, memory.path.toString(), false),
            tokenEstimate: memory.tokenEstimate,
            summary: memory.summary,
        })),
        subcategories: indexResult.value.subcategories.map((sub) => ({
            path: sub.path.toString(),
            uri: buildResourceUri(store, sub.path.toString(), true),
            memoryCount: sub.memoryCount,
        })),
    };

    const uri = buildResourceUri(store, categoryPath, true);

    return ok({
        contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(listing, null, 2),
        }],
    });
};

/**
 * Reads root category listing (lists all root categories).
 *
 * Enumerates root categories using the root index when available. If the
 * root index is missing or unreadable, falls back to the default category
 * list to preserve legacy behavior.
 *
 * @param adapter - Scoped storage adapter for index operations
 * @param store - Store name for building response URIs
 * @returns Result containing ReadResourceResult with root category listing
 */
const readRootCategoryListing = async (
    adapter: ScopedStorageAdapter,
    store: string,
): Promise<Result<ReadResourceResult, McpError>> => {
    const subcategories: CategoryListing['subcategories'] = [];

    const rootIndexResult = await adapter.indexes.read(CategoryPath.root());
    if (rootIndexResult.ok() && rootIndexResult.value) {
        for (const sub of rootIndexResult.value.subcategories) {
            subcategories.push({
                path: sub.path.toString(),
                uri: buildResourceUri(store, sub.path.toString(), true),
                memoryCount: sub.memoryCount,
            });
        }
    }
    else {
        for (const category of ROOT_CATEGORIES) {
            const categoryPathResult = CategoryPath.fromString(category);
            if (!categoryPathResult.ok()) {
                continue;
            }
            const indexResult = await adapter.indexes.read(categoryPathResult.value);
            if (!indexResult.ok() || !indexResult.value) {
                // Category doesn't exist, skip it
                continue;
            }

            subcategories.push({
                path: category,
                uri: buildResourceUri(store, category, true),
                memoryCount: indexResult.value.memories.length,
            });
        }
    }

    const listing: CategoryListing = {
        category: '',
        memories: [],
        subcategories,
    };

    const uri = buildResourceUri(store, '', true);

    return ok({
        contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(listing, null, 2),
        }],
    });
};

/**
 * Lists all available resources for MCP discovery.
 *
 * Enumerates all accessible memory resources including the root store,
 * categories, subcategories, and individual memories. Root categories are
 * derived from the root index when available; if missing or unreadable, the
 * default category list is used as a fallback.
 *
 * @param ctx - Tool context containing cortex instance and config
 * @returns Result containing array of Resource objects or McpError
 *
 * @example
 * ```ts
 * const result = await listResources(ctx);
 * if (result.ok()) {
 *   for (const resource of result.value.resources) {
 *     console.log(`${resource.name}: ${resource.uri}`);
 *   }
 * }
 * ```
 */
const listResources = async (ctx: ToolContext): Promise<ListResourcesResult> => {
    const resources: Resource[] = [];
    const store = ctx.config.defaultStore;

    // Resolve the adapter for this store
    const adapterResult = resolveAdapter(ctx, store);
    if (!adapterResult.ok()) {
        return err(adapterResult.error);
    }
    const adapter = adapterResult.value;

    // Add root category resource
    resources.push({
        uri: buildResourceUri(store, '', true),
        name: `Memory Store: ${store}`,
        description: 'Root category listing for the memory store',
        mimeType: 'application/json',
    });

    const rootIndexResult = await adapter.indexes.read(CategoryPath.root());
    const rootCategories =
        rootIndexResult.ok() && rootIndexResult.value
            ? rootIndexResult.value.subcategories.map((sub) => sub.path)
            : [...ROOT_CATEGORIES];

    // Collect resources from all root categories
    for (const category of rootCategories) {
        const categoryPathResult =
            typeof category === 'string' ? CategoryPath.fromString(category) : ok(category);

        if (!categoryPathResult.ok()) {
            continue;
        }

        const indexResult = await adapter.indexes.read(categoryPathResult.value);
        if (!indexResult.ok() || !indexResult.value) {
            continue;
        }

        const categoryStr = categoryPathResult.value.toString();

        // Add category resource
        resources.push({
            uri: buildResourceUri(store, categoryStr, true),
            name: `Category: ${categoryStr}`,
            description: `Memory category listing for ${categoryStr}`,
            mimeType: 'application/json',
        });

        // Add memory resources
        for (const memory of indexResult.value.memories) {
            const memoryPathStr = memory.path.toString();
            resources.push({
                uri: buildResourceUri(store, memoryPathStr, false),
                name: `Memory: ${memoryPathStr}`,
                description: memory.summary ?? `Memory at ${memoryPathStr}`,
                mimeType: 'text/plain',
            });
        }

        // Add subcategory resources
        for (const sub of indexResult.value.subcategories) {
            const subPathStr = sub.path.toString();
            resources.push({
                uri: buildResourceUri(store, subPathStr, true),
                name: `Category: ${subPathStr}`,
                description: `Memory category listing for ${subPathStr} (${sub.memoryCount} memories)`,
                mimeType: 'application/json',
            });
        }
    }

    return ok({ resources });
};

// ---------------------------------------------------------------------------
// Export handlers for testing
// ---------------------------------------------------------------------------

export {
    readMemoryContent,
    readCategoryListing,
    listResources,
    buildResourceUri,
    parseUriVariables,
    resolveAdapter,
    ROOT_CATEGORIES,
    MEMORY_URI_SCHEME,
};

// Export types for testing
export type { CategoryListing, ParsedUriVariables };

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Registers memory resources with the MCP server.
 *
 * Sets up a resource template for URI-based access to memories and categories.
 * Supports both memory content retrieval and category listing based on URI
 * pattern (trailing slash indicates category).
 *
 * URI Pattern: `cortex://memory/{store}/{path*}`
 * - Memory content: `cortex://memory/global/project/my-memory`
 * - Category listing: `cortex://memory/global/project/`
 * - Root listing: `cortex://memory/global/`
 *
 * @param server - MCP server instance to register resources with
 * @param ctx - Tool context containing cortex instance and config
 *
 * @example
 * ```ts
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { registerMemoryResources } from './memory/resources.ts';
 *
 * const server = new McpServer({ name: 'cortex', version: '1.0.0' });
 * const ctx = { config: { dataPath: '/data', defaultStore: 'global' }, cortex };
 *
 * registerMemoryResources(server, ctx);
 *
 * // Clients can now access:
 * // - cortex://memory/global/          (list root categories)
 * // - cortex://memory/global/project/  (list project category)
 * // - cortex://memory/global/project/my-memory (read memory content)
 * ```
 */
export const registerMemoryResources = (server: McpServer, ctx: ToolContext): void => {
    // Create resource template for dynamic URIs
    const template = new ResourceTemplate('cortex://memory/{store}/{path*}', {
        list: async () => {
            const result = await listResources(ctx);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok()) {
                throw result.error;
            }
            return result.value;
        },
        complete: {
            store: (): string[] => {
                // Return known store names (currently just default)
                return [ctx.config.defaultStore];
            },
            'path*': async (value: string): Promise<string[]> => {
                // Autocomplete for paths within store
                const adapterResult = resolveAdapter(ctx, ctx.config.defaultStore);
                if (!adapterResult.ok()) {
                    // Return empty completions on failure - don't throw in autocomplete
                    return [];
                }
                const adapter = adapterResult.value;
                const completions: string[] = [];

                // If empty or just started, suggest root categories
                if (!value || value === '') {
                    return [...ROOT_CATEGORIES];
                }

                // Try to find matching categories/memories
                const parts = value.split('/');
                const categoryPath = parts.slice(0, -1).join('/');
                const prefix = parts[parts.length - 1] ?? '';

                // Check root categories if at root level
                if (categoryPath === '') {
                    const matches = ROOT_CATEGORIES.filter((cat) => cat.startsWith(prefix));
                    completions.push(...matches);
                }
                else {
                    // Read the parent category index
                    const categoryPathResult = CategoryPath.fromString(categoryPath);
                    if (!categoryPathResult.ok()) {
                        return completions;
                    }
                    const indexResult = await adapter.indexes.read(categoryPathResult.value);
                    if (indexResult.ok() && indexResult.value) {
                        // Add matching subcategories
                        for (const sub of indexResult.value.subcategories) {
                            const subPathStr = sub.path.toString();
                            const subName = subPathStr.split('/').pop() ?? '';
                            if (subName.startsWith(prefix)) {
                                completions.push(subPathStr);
                            }
                        }
                        // Add matching memories
                        for (const mem of indexResult.value.memories) {
                            const memPathStr = mem.path.toString();
                            const memName = memPathStr.split('/').pop() ?? '';
                            if (memName.startsWith(prefix)) {
                                completions.push(memPathStr);
                            }
                        }
                    }
                }

                return completions;
            },
        },
    });

    server.registerResource(
        'memory',
        template,
        {
            description:
                'Access memory content or category listings. Use trailing slash for category listings',
            mimeType: 'text/plain',
        },
        async (_uri: URL, variables: Variables): Promise<ReadResourceResult> => {
            const parsed = parseUriVariables(variables, ctx.config);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!parsed.ok()) {
                throw parsed.error;
            }

            const { store, path, isCategory } = parsed.value;

            // Resolve adapter for the requested store
            const adapterResult = resolveAdapter(ctx, store);
            if (!adapterResult.ok()) {
                throw adapterResult.error;
            }
            const adapter = adapterResult.value;

            if (isCategory) {
                const result = await readCategoryListing(adapter, store, path);
                // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
                if (!result.ok()) {
                    throw result.error;
                }
                return result.value;
            }
            else {
                const result = await readMemoryContent(adapter, store, path);
                // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
                if (!result.ok()) {
                    throw result.error;
                }
                return result.value;
            }
        },
    );
};
