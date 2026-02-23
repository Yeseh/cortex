/**
 * Memory list command for browsing memories with optional filtering.
 *
 * Lists all memories in a category, or all memories across all categories
 * if no category is specified. Expired memories are excluded by default
 * unless the `--include-expired` flag is provided.
 *
 * When no category is specified, the command dynamically discovers all
 * root categories from the store's index rather than using a hardcoded list.
 *
 * @example
 * ```bash
 * # List all memories
 * cortex memory list
 *
 * # List memories in a specific category
 * cortex memory list project/cortex
 *
 * # Include expired memories
 * cortex memory list --include-expired
 *
 * # Output in JSON format
 * cortex memory list --format json
 *
 * # Use a specific store (either placement works)
 * cortex memory list -s my-store
 * cortex memory -s my-store list
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCliError } from '../../errors.ts';

import { CategoryPath, type CategoryClient } from '@yeseh/cortex-core/category';
import { serialize, type CortexContext } from '@yeseh/cortex-core';
import type { SubcategoryEntry } from '@yeseh/cortex-core/category';
import { serializeOutput, type OutputFormat } from '../../output.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';

/**
 * Options for the list command.
 */
export interface ListCommandOptions {
    /** Include expired memories in the output */
    includeExpired?: boolean;
    /** Output format (yaml, json, toon) */
    format?: string;
    /** Store name (can be specified on subcommand or parent) */
    store?: string;
}

/**
 * Dependencies for the list command handler.
 * Allows injection for testing.
 */
export interface ListHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Current time for expiration checks */
    now?: Date;
}

/**
 * Entry representing a memory in the list output.
 */
export interface ListMemoryEntry {
    path: string;
    tokenEstimate: number;
    summary?: string;
    expiresAt?: Date;
    isExpired: boolean;
}

/**
 * Entry representing a subcategory in the list output.
 */
export interface ListSubcategoryEntry {
    path: string;
    memoryCount: number;
    description?: string;
}

/**
 * Result of the list command containing memories and subcategories.
 */
export interface ListResult {
    memories: ListMemoryEntry[];
    subcategories: ListSubcategoryEntry[];
}

/**
 * Formats the output based on the specified format.
 */
const formatOutput = (result: ListResult, format: OutputFormat): string => {
    const outputMemories = result.memories.map((memory) => ({
        path: memory.path,
        token_estimate: memory.tokenEstimate,
        summary: memory.summary,
        expires_at: memory.expiresAt?.toISOString(),
        expired: memory.isExpired || undefined,
    }));

    const outputSubcategories = result.subcategories.map((subcategory) => ({
        path: subcategory.path,
        memory_count: subcategory.memoryCount,
        description: subcategory.description,
    }));

    const data = {
        memories: outputMemories,
        subcategories: outputSubcategories,
    };

    const serialized = serializeOutput({ kind: 'memory', value: data }, format);

    if (!serialized.ok()) {
        throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    return serialized.value;
};

/**
 * Handles the list command execution.
 *
 * This function:
 * 1. Resolves the store context
 * 2. Loads category index (or all categories if none specified)
 * 3. Collects memories and subcategories, filtering expired if needed
 * 4. Formats and outputs the result
 *
 * @param category - Optional category path to list (lists all if omitted)
 * @param options - Command options (includeExpired, format)
 * @param storeName - Optional store name from parent command
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When arguments are invalid
 * @throws {CommanderError} When read or parse fails
 */
export async function handleList(
    ctx: CortexContext,
    storeName: string | undefined,
    category: string | undefined,
    options: ListCommandOptions,
    deps: ListHandlerDeps = {}
): Promise<void> {
    const categoryResult = CategoryPath.fromString(category ?? '');
    if (!categoryResult.ok()) {
        throwCliError(categoryResult.error);
    }

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const rootResult = storeResult.value.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    const root = rootResult.value;
    let categoryClient: CategoryClient;

    if (categoryResult.value.isRoot) {
        categoryClient = root;
    } else {
        const categoryClientResult = root.getCategory(categoryResult.value.toString());
        if (!categoryClientResult.ok()) {
            throwCliError(categoryClientResult.error);
        }

        categoryClient = categoryClientResult.value;
    }
    const now = deps.now ?? ctx.now();
    const includeExpired = options.includeExpired ?? false;
    const visited = new Set<string>();

    const collectMemories = async (client: CategoryClient): Promise<ListMemoryEntry[]> => {
        const categoryKey = client.rawPath;
        if (visited.has(categoryKey)) {
            return [];
        }
        visited.add(categoryKey);

        const memoriesResult = await client.listMemories({ includeExpired });
        if (!memoriesResult.ok()) {
            throwCliError(memoriesResult.error);
        }

        const memories: ListMemoryEntry[] = [];
        for (const entry of memoriesResult.value) {
            const memoryClient = client.getMemory(entry.path.slug.toString());
            const memoryResult = await memoryClient.get({ includeExpired: true, now });
            if (!memoryResult.ok()) {
                if (memoryResult.error.code === 'MEMORY_NOT_FOUND') {
                    continue;
                }
                if (!includeExpired && memoryResult.error.code === 'MEMORY_EXPIRED') {
                    continue;
                }
                throwCliError(memoryResult.error);
            }

            const memory = memoryResult.value;
            const isExpired = memory.isExpired(now);
            if (!includeExpired && isExpired) {
                continue;
            }

            memories.push({
                path: entry.path.toString(),
                tokenEstimate: entry.tokenEstimate,
                summary: undefined,
                expiresAt: memory.metadata.expiresAt,
                isExpired,
            });
        }

        const subcategoriesResult = await client.listSubcategories();
        if (!subcategoriesResult.ok()) {
            throwCliError(subcategoriesResult.error);
        }

        for (const subcategory of subcategoriesResult.value) {
            const subcategoryClientResult = root.getCategory(subcategory.path.toString());
            if (!subcategoryClientResult.ok()) {
                throwCliError(subcategoryClientResult.error);
            }
            const subMemories = await collectMemories(subcategoryClientResult.value);
            memories.push(...subMemories);
        }

        return memories;
    };

    const subcategoriesResult = await categoryClient.listSubcategories();
    if (!subcategoriesResult.ok()) {
        throwCliError(subcategoriesResult.error);
    }

    const memories = await collectMemories(categoryClient);
    const result: ListResult = {
        memories,
        subcategories: subcategoriesResult.value.map((subcategory: SubcategoryEntry) => ({
            path: subcategory.path.toString(),
            memoryCount: subcategory.memoryCount,
            description: subcategory.description,
        })),
    };

    // 3. Format and output
    const validFormats = ['yaml', 'json', 'toon'] as const;
    const format: OutputFormat = validFormats.includes(options.format as OutputFormat)
        ? (options.format as OutputFormat)
        : 'yaml';
    const output = serialize(result, format);
    if (!output.ok()) {
        throwCliError({ code: 'SERIALIZE_FAILED', message: output.error.message });
    }

    const out = deps.stdout ?? ctx.stdout;
    out.write(output.value + '\n');
}

/**
 * The `list` subcommand for browsing memories.
 *
 * Lists memories in a category, or all memories across all root categories
 * if no category is specified. By default, expired memories are excluded.
 *
 * The `--store` option can be specified either on this command or on the
 * parent `memory` command for flexibility.
 *
 * @example
 * ```bash
 * cortex memory list
 * cortex memory list project/cortex
 * cortex memory list --include-expired
 * cortex memory list --format json
 * cortex memory list -s my-store
 * cortex memory -s my-store list
 * ```
 */
export const listCommand = new Command('list')
    .description('List memories in a category')
    .argument('[category]', 'Category path to list (lists all if omitted)')
    .option('-s, --store <name>', 'Use a specific named store')
    .option('-x, --include-expired', 'Include expired memories')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (category, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        // Allow store to be specified on either the subcommand or parent command
        const storeName = options.store ?? parentOpts?.store;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }

        await handleList(context.value, storeName, category, options);
    });
