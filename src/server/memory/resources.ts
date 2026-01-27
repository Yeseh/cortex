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
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult, Resource } from '@modelcontextprotocol/sdk/types.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import { parseMemoryFile } from '../../core/memory/index.ts';
import { validateMemorySlugPath } from '../../core/memory/validation.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';
import { parseCategoryIndex } from '../../core/index/parser.ts';
import type { ServerConfig } from '../config.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Root memory categories used for listing operations.
 *
 * These are the top-level categories in the memory hierarchy that are
 * enumerated when listing resources or providing path completions.
 */
const ROOT_CATEGORIES = ['human', 'persona', 'project', 'domain'] as const;

/**
 * URI scheme prefix for memory resources.
 *
 * All memory resource URIs follow the pattern: `cortex://memory/{store}/{path}`
 */
const MEMORY_URI_SCHEME = 'cortex://memory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Resolves the store root directory path.
 *
 * @param config - Server configuration containing data path and default store
 * @param storeName - Optional store name; uses default store if undefined
 * @returns Absolute path to the store root directory
 *
 * @example
 * ```ts
 * const storeRoot = resolveStoreRoot(config, 'my-store');
 * // Returns: '/data/path/my-store'
 *
 * const defaultRoot = resolveStoreRoot(config, undefined);
 * // Returns: '/data/path/{defaultStore}'
 * ```
 */
const resolveStoreRoot = (config: ServerConfig, storeName: string | undefined): string => {
    const store = storeName ?? config.defaultStore;
    return resolve(config.dataPath, store);
};

/**
 * Creates a filesystem storage adapter for the given store root.
 *
 * @param storeRoot - Absolute path to the store root directory
 * @returns A configured FilesystemStorageAdapter instance
 *
 * @example
 * ```ts
 * const adapter = createAdapter('/data/stores/global');
 * const result = await adapter.readMemoryFile('project/my-memory');
 * ```
 */
const createAdapter = (storeRoot: string): FilesystemStorageAdapter => {
    return new FilesystemStorageAdapter({ rootDirectory: storeRoot });
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
    config: ServerConfig
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
 * @param adapter - Storage adapter for filesystem operations
 * @param store - Store name for building the response URI
 * @param memoryPath - Memory path in category/slug format
 * @returns Result containing ReadResourceResult or McpError
 *
 * @example
 * ```ts
 * const adapter = createAdapter('/data/stores/global');
 * const result = await readMemoryContent(adapter, 'global', 'project/my-memory');
 * if (result.ok) {
 *   console.log(result.value.contents[0].text);
 *   // Memory content as plain text
 * }
 * ```
 */
const readMemoryContent = async (
    adapter: FilesystemStorageAdapter,
    store: string,
    memoryPath: string
): Promise<Result<ReadResourceResult, McpError>> => {
    // Validate the memory path
    const identity = validateMemorySlugPath(memoryPath);
    if (!identity.ok) {
        return err(
            new McpError(ErrorCode.InvalidParams, `Invalid memory path: ${identity.error.message}`)
        );
    }

    // Read the memory file
    const readResult = await adapter.readMemoryFile(identity.value.slugPath);
    if (!readResult.ok) {
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to read memory: ${readResult.error.message}`
            )
        );
    }

    if (!readResult.value) {
        return err(new McpError(ErrorCode.InvalidParams, `Memory not found: ${memoryPath}`));
    }

    // Parse the memory file to get content
    const parsed = parseMemoryFile(readResult.value);
    if (!parsed.ok) {
        return err(
            new McpError(ErrorCode.InternalError, `Failed to parse memory: ${parsed.error.message}`)
        );
    }

    const uri = buildResourceUri(store, memoryPath, false);

    return ok({
        contents: [
            {
                uri,
                mimeType: 'text/plain',
                text: parsed.value.content,
            },
        ],
    });
};

/**
 * Reads category listing for a category path.
 *
 * Returns a JSON listing of all memories and subcategories within the
 * specified category. For the root path (empty string), delegates to
 * readRootCategoryListing.
 *
 * @param adapter - Storage adapter for filesystem operations
 * @param store - Store name for building response URIs
 * @param categoryPath - Category path to list (empty for root)
 * @returns Result containing ReadResourceResult with JSON listing or McpError
 *
 * @example
 * ```ts
 * const adapter = createAdapter('/data/stores/global');
 *
 * // List root categories
 * const rootResult = await readCategoryListing(adapter, 'global', '');
 *
 * // List specific category
 * const projectResult = await readCategoryListing(adapter, 'global', 'project');
 * if (projectResult.ok) {
 *   const listing = JSON.parse(projectResult.value.contents[0].text);
 *   console.log(listing.memories);  // Array of memory entries
 * }
 * ```
 */
const readCategoryListing = async (
    adapter: FilesystemStorageAdapter,
    store: string,
    categoryPath: string
): Promise<Result<ReadResourceResult, McpError>> => {
    // Handle root listing (empty path)
    if (!categoryPath) {
        return readRootCategoryListing(adapter, store);
    }

    // Read the category index
    const indexResult = await adapter.readIndexFile(categoryPath);
    if (!indexResult.ok) {
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to read category index: ${indexResult.error.message}`
            )
        );
    }

    if (!indexResult.value) {
        return err(new McpError(ErrorCode.InvalidParams, `Category not found: ${categoryPath}`));
    }

    // Parse the category index
    const parsed = parseCategoryIndex(indexResult.value);
    if (!parsed.ok) {
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to parse category index: ${parsed.error.message}`
            )
        );
    }

    const listing: CategoryListing = {
        category: categoryPath,
        memories: parsed.value.memories.map((memory) => ({
            path: memory.path,
            uri: buildResourceUri(store, memory.path, false),
            tokenEstimate: memory.tokenEstimate,
            summary: memory.summary,
        })),
        subcategories: parsed.value.subcategories.map((sub) => ({
            path: sub.path,
            uri: buildResourceUri(store, sub.path, true),
            memoryCount: sub.memoryCount,
        })),
    };

    const uri = buildResourceUri(store, categoryPath, true);

    return ok({
        contents: [
            {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(listing, null, 2),
            },
        ],
    });
};

/**
 * Reads root category listing (lists all root categories).
 *
 * Enumerates all root categories (human, persona, project, domain) and
 * returns their availability and memory counts.
 *
 * @param adapter - Storage adapter for filesystem operations
 * @param store - Store name for building response URIs
 * @returns Result containing ReadResourceResult with root category listing
 */
const readRootCategoryListing = async (
    adapter: FilesystemStorageAdapter,
    store: string
): Promise<Result<ReadResourceResult, McpError>> => {
    const subcategories: CategoryListing['subcategories'] = [];

    for (const category of ROOT_CATEGORIES) {
        const indexResult = await adapter.readIndexFile(category);
        if (!indexResult.ok || !indexResult.value) {
            // Category doesn't exist, skip it
            continue;
        }

        const parsed = parseCategoryIndex(indexResult.value);
        if (!parsed.ok) {
            continue;
        }

        subcategories.push({
            path: category,
            uri: buildResourceUri(store, category, true),
            memoryCount: parsed.value.memories.length,
        });
    }

    const listing: CategoryListing = {
        category: '',
        memories: [],
        subcategories,
    };

    const uri = buildResourceUri(store, '', true);

    return ok({
        contents: [
            {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(listing, null, 2),
            },
        ],
    });
};

/**
 * Lists all available resources for MCP discovery.
 *
 * Enumerates all accessible memory resources including the root store,
 * categories, subcategories, and individual memories. Used by MCP clients
 * to discover available resources before reading them.
 *
 * @param config - Server configuration containing data path and default store
 * @returns Result containing array of Resource objects or McpError
 *
 * @example
 * ```ts
 * const result = await listResources(config);
 * if (result.ok) {
 *   for (const resource of result.value.resources) {
 *     console.log(`${resource.name}: ${resource.uri}`);
 *   }
 * }
 * ```
 */
const listResources = async (config: ServerConfig): Promise<ListResourcesResult> => {
    const resources: Resource[] = [];
    const store = config.defaultStore;
    const storeRoot = resolveStoreRoot(config, store);
    const adapter = createAdapter(storeRoot);

    // Add root category resource
    resources.push({
        uri: buildResourceUri(store, '', true),
        name: `Memory Store: ${store}`,
        description: 'Root category listing for the memory store',
        mimeType: 'application/json',
    });

    // Collect resources from all root categories
    for (const category of ROOT_CATEGORIES) {
        const indexResult = await adapter.readIndexFile(category);
        if (!indexResult.ok || !indexResult.value) {
            continue;
        }

        const parsed = parseCategoryIndex(indexResult.value);
        if (!parsed.ok) {
            continue;
        }

        // Add category resource
        resources.push({
            uri: buildResourceUri(store, category, true),
            name: `Category: ${category}`,
            description: `Memory category listing for ${category}`,
            mimeType: 'application/json',
        });

        // Add memory resources
        for (const memory of parsed.value.memories) {
            resources.push({
                uri: buildResourceUri(store, memory.path, false),
                name: `Memory: ${memory.path}`,
                description: memory.summary ?? `Memory at ${memory.path}`,
                mimeType: 'text/plain',
            });
        }

        // Add subcategory resources
        for (const sub of parsed.value.subcategories) {
            resources.push({
                uri: buildResourceUri(store, sub.path, true),
                name: `Category: ${sub.path}`,
                description: `Memory category listing for ${sub.path} (${sub.memoryCount} memories)`,
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
    createAdapter,
    resolveStoreRoot,
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
 * @param config - Server configuration for store paths and defaults
 *
 * @example
 * ```ts
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { registerMemoryResources } from './memory/resources.ts';
 *
 * const server = new McpServer({ name: 'cortex', version: '1.0.0' });
 * const config = { dataPath: '/data', defaultStore: 'global' };
 *
 * registerMemoryResources(server, config);
 *
 * // Clients can now access:
 * // - cortex://memory/global/          (list root categories)
 * // - cortex://memory/global/project/  (list project category)
 * // - cortex://memory/global/project/my-memory (read memory content)
 * ```
 */
export const registerMemoryResources = (server: McpServer, config: ServerConfig): void => {
    // Create resource template for dynamic URIs
    const template = new ResourceTemplate('cortex://memory/{store}/{path*}', {
        list: async () => {
            const result = await listResources(config);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok) {
                throw result.error;
            }
            return result.value;
        },
        complete: {
            store: (): string[] => {
                // Return known store names (currently just default)
                return [config.defaultStore];
            },
            'path*': async (value: string): Promise<string[]> => {
                // Autocomplete for paths within store
                const storeRoot = resolveStoreRoot(config, config.defaultStore);
                const adapter = createAdapter(storeRoot);
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
                } else {
                    // Read the parent category index
                    const indexResult = await adapter.readIndexFile(categoryPath);
                    if (indexResult.ok && indexResult.value) {
                        const parsed = parseCategoryIndex(indexResult.value);
                        if (parsed.ok) {
                            // Add matching subcategories
                            for (const sub of parsed.value.subcategories) {
                                const subName = sub.path.split('/').pop() ?? '';
                                if (subName.startsWith(prefix)) {
                                    completions.push(sub.path);
                                }
                            }
                            // Add matching memories
                            for (const mem of parsed.value.memories) {
                                const memName = mem.path.split('/').pop() ?? '';
                                if (memName.startsWith(prefix)) {
                                    completions.push(mem.path);
                                }
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
            const parsed = parseUriVariables(variables, config);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!parsed.ok) {
                throw parsed.error;
            }

            const { store, path, isCategory } = parsed.value;
            const storeRoot = resolveStoreRoot(config, store);
            const adapter = createAdapter(storeRoot);

            if (isCategory) {
                const result = await readCategoryListing(adapter, store, path);
                // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
                if (!result.ok) {
                    throw result.error;
                }
                return result.value;
            } else {
                const result = await readMemoryContent(adapter, store, path);
                // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
                if (!result.ok) {
                    throw result.error;
                }
                return result.value;
            }
        }
    );
};
