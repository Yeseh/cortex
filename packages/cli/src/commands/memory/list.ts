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
import { throwCoreError } from '../../errors.ts';
import { resolveStoreAdapter } from '../../context.ts';

import { listMemories } from '@yeseh/cortex-core/memory';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import type { OutputFormat } from '../../output.ts';
import { toonOptions } from '../../output.ts';
import { encode as toonEncode } from '@toon-format/toon';

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
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
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

    if (format === 'json') {
        return JSON.stringify(
            { memories: outputMemories, subcategories: outputSubcategories },
            null,
            2,
        );
    }

    if (format === 'toon') {
        return toonEncode(
            { memories: outputMemories, subcategories: outputSubcategories },
            toonOptions,
        );
    }

    // YAML format (default)
    const lines: string[] = [];

    // Memories section
    if (result.memories.length === 0) {
        lines.push('memories: []');
    }
    else {
        lines.push('memories:');
        for (const memory of result.memories) {
            lines.push(`  - path: ${memory.path}`);
            lines.push(`    token_estimate: ${memory.tokenEstimate}`);
            if (memory.summary) {
                lines.push(`    summary: ${memory.summary}`);
            }
            if (memory.expiresAt) {
                lines.push(`    expires_at: ${memory.expiresAt.toISOString()}`);
            }
            if (memory.isExpired) {
                lines.push('    expired: true');
            }
        }
    }

    // Subcategories section
    if (result.subcategories.length === 0) {
        lines.push('subcategories: []');
    }
    else {
        lines.push('subcategories:');
        for (const subcategory of result.subcategories) {
            lines.push(`  - path: ${subcategory.path}`);
            lines.push(`    memory_count: ${subcategory.memoryCount}`);
            if (subcategory.description) {
                lines.push(`    description: ${subcategory.description}`);
            }
        }
    }

    return lines.join('\n');
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
    category: string | undefined,
    options: ListCommandOptions,
    storeName: string | undefined,
    deps: ListHandlerDeps = {},
): Promise<void> {
    // 1. Resolve store context
    const storeResult = await resolveStoreAdapter(storeName);
    if (!storeResult.ok()) {
        throwCoreError(storeResult.error);
    }

    const now = deps.now ?? new Date();
    const adapter = deps.adapter ?? storeResult.value.adapter;
    const normalizedCategory = category ? category.replace(/^\/+/, '') : undefined;

    // 2. Collect memories and subcategories
    const listResult = await listMemories(adapter, {
        category: normalizedCategory,
        includeExpired: options.includeExpired ?? false,
        now,
    });
    if (!listResult.ok()) {
        throwCoreError(listResult.error);
    }

    const result: ListResult = {
        memories: listResult.value.memories.map((memory) => ({
            path: memory.path,
            tokenEstimate: memory.tokenEstimate,
            summary: memory.summary,
            expiresAt: memory.expiresAt,
            isExpired: memory.isExpired,
        })),
        subcategories: listResult.value.subcategories.map((subcategory) => ({
            path: subcategory.path,
            memoryCount: subcategory.memoryCount,
            description: subcategory.description,
        })),
    };

    // 3. Format and output
    const VALID_FORMATS: OutputFormat[] = [
        'yaml',
        'json',
        'toon',
    ];
    const requestedFormat = options.format as OutputFormat;
    const format: OutputFormat = VALID_FORMATS.includes(requestedFormat) ? requestedFormat : 'yaml';
    const output = formatOutput(result, format);

    const out = deps.stdout ?? process.stdout;
    out.write(output + '\n');
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
        await handleList(category, options, storeName);
    });
