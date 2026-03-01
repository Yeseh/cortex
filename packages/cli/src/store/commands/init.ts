/**
 * Store init command for initializing a new memory store.
 *
 * This command creates a new memory store at the specified path (or current
 * directory) and registers it in the global registry. The store name is
 * either explicitly provided via --name or auto-detected from the git
 * repository name.
 *
 * @example
 * ```bash
 * # Initialize store with auto-detected name from git repo
 * cortex store init
 *
 * # Initialize store with explicit name
 * cortex store init --name my-project
 *
 * # Initialize store at a specific path
 * cortex store init ./my-store --name my-project
 *
 * # Initialize store with tilde expansion
 * cortex store init ~/memories --name personal
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { resolve } from 'node:path';
import { stdin, stdout as processStdout } from 'node:process';
import { resolveStoreName } from '../utils/resolve-store-name.ts';
import { throwCliError } from '../../errors.ts';
import { type StoreData, initializeStore } from '@yeseh/cortex-core/store';
import { type CategoryMode, type CortexContext } from '@yeseh/cortex-core';
import { serializeOutput, type OutputStoreInit, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../utils/paths.ts';
import { createCliConfigContext } from '../../context.ts';
import { isTTY, defaultPromptDeps, type PromptDeps } from '../../utils/prompts.ts';
import type { FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Explicit store name (otherwise auto-detected from git) */
    name?: string;
    /** Category mode for the store */
    categoryMode?: CategoryMode;
    /** Output format (yaml, json, toon) */
    format?: string;
    /** Optional description for the store */
    description?: string;
}

/**
 * Writes the serialized output to the output stream.
 *
 * @param output - The store init output payload
 * @param format - The output format
 * @param stdout - The output stream
 */
function writeOutput(
    output: OutputStoreInit,
    format: OutputFormat,
    stdout: NodeJS.WritableStream,
): void {
    const serialized = serializeOutput({ kind: 'store-init', value: output }, format);
    if (!serialized.ok()) {
        throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Prompts the user to confirm or change the resolved store name and path.
 *
 * Prompts are selectively skipped:
 * - Name prompt skipped when `explicit.name` is provided
 * - Path prompt skipped when `explicit.path` is provided
 * - All prompts skipped when stdin is not a TTY
 *
 * @param ctx - Cortex context used for TTY detection via `ctx.stdin`
 * @param resolved - Default store name and path to present as suggestions
 * @param explicit - Which values were provided explicitly by the user
 * @param promptDeps - Injectable prompt functions for testability
 * @returns Finalized store name and path
 */
async function promptStoreInitOptions(
    ctx: CortexContext,
    resolved: { storeName: string; storePath: string },
    explicit: { name?: string; path?: string },
    promptDeps: PromptDeps,
): Promise<{ storeName: string; storePath: string }> {
    if (!isTTY(ctx.stdin)) return resolved;

    const storeName = explicit.name
        ? resolved.storeName
        : await promptDeps.input({ message: 'Store name:', default: resolved.storeName });

    let storePath: string;
    if (explicit.path) {
        storePath = resolved.storePath;
    }
    else {
        const promptedPath = await promptDeps.input({
            message: 'Store path:',
            default: resolved.storePath,
        });
        const trimmedPath = promptedPath.trim();
        storePath = resolveUserPath(trimmedPath, process.cwd());
    }

    return { storeName, storePath };
}

/**
 * Tries to resolve the store name. Returns an empty string when resolution
 * fails and stdin is a TTY (allowing the interactive prompt to take over).
 * Re-throws when stdin is not a TTY.
 *
 * @param cwd - Current working directory for git detection
 * @param explicitName - Optional explicit name from `--name` flag
 * @param tty - Whether stdin is a TTY
 */
async function resolveStoreNameOrEmpty(
    cwd: string,
    explicitName: string | undefined,
    tty: boolean,
): Promise<string> {
    try {
        return await resolveStoreName(cwd, explicitName);
    }
    catch (e) {
        // When running in a TTY, only swallow errors (and fall back to prompting)
        // if no explicit name was provided. If the user passed an explicit --name,
        // re-throw so they see the actual invalid-name error.
        if (tty && !explicitName) return '';
        throw e;
    }
}

/**
 * Handles the store init command execution.
 *
 * This function:
 * 1. Resolves the store name (explicit or git detection; falls back to empty for TTY prompt)
 * 2. Resolves target path (default to .cortex in cwd)
 * 3. When stdin is a TTY, prompts for unresolved name and/or path
 * 4. Uses `store.initialize` to create directory, index, and register
 * 5. Outputs the result
 *
 * Interactive mode activates automatically when `ctx.stdin.isTTY === true`.
 * In non-TTY environments (CI, pipes) the command behaves exactly as before —
 * no behavioral regression.
 *
 * @param ctx - The Cortex context (stdin TTY state used for interactive detection)
 * @param targetPath - Optional path for the store (defaults to .cortex in cwd)
 * @param options - Command options (name, format, categoryMode, description)
 * @param promptDeps - Injectable prompt functions; defaults to real `@inquirer/prompts` functions
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store already exists or init fails
 *
 * @example
 * ```typescript
 * // Explicit name + path (no prompts even in TTY):
 * await handleInit(ctx, './my-store', { name: 'my-project' });
 *
 * // Interactive (TTY detected, no --name given):
 * await handleInit(ctx, undefined, {}, defaultPromptDeps);
 * ```
 */
export async function handleInit(
    ctx: CortexContext,
    targetPath: string | undefined,
    options: InitCommandOptions = {},
    promptDeps: PromptDeps = defaultPromptDeps,
): Promise<void> {
    const cwd = ctx.cwd ?? process.cwd();
    const stdout = ctx.stdout ?? process.stdout;

    const storeName = await resolveStoreNameOrEmpty(cwd, options.name, isTTY(ctx.stdin));

    const storePath = targetPath
        ? resolveUserPath(targetPath.trim(), cwd)
        : resolve(cwd, '.cortex');

    const resolved = await promptStoreInitOptions(
        ctx,
        { storeName, storePath },
        { name: options.name, path: targetPath },
        promptDeps,
    );

    const finalStoreName = resolved.storeName;
    const finalStorePath = resolved.storePath;

    if (!finalStoreName) {
        throwCliError({
            code: 'INVALID_STORE_NAME',
            message: 'Store name is required. Use --name to specify one.',
        });
    }

    const storeData: StoreData = {
        kind: 'filesystem',
        categoryMode: (options.categoryMode as CategoryMode) ?? 'free',
        categories: [],
        properties: {
            path: finalStorePath,
        },
        description: options.description,
    };

    const adapter = new FilesystemStorageAdapter(ctx.config as FilesystemConfigAdapter, {
        rootDirectory: finalStorePath,
    });
    const createResult = await initializeStore(adapter, finalStoreName, storeData);
    if (!createResult.ok()) {
        throwCliError(createResult.error);
    }

    const output: OutputStoreInit = { path: finalStorePath, name: finalStoreName };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, stdout);
}

/**
 * The `init` subcommand for initializing a new memory store.
 *
 * Creates a new store at the specified path (or .cortex in current directory)
 * and registers it in the global registry. The store name is auto-detected
 * from the git repository name or can be explicitly provided.
 *
 * @example
 * ```bash
 * cortex store init                        # Auto-detect name from git
 * cortex store init --name my-project      # Explicit name
 * cortex store init ./store --name custom  # Custom path and name
 * ```
 */
export const initCommand = new Command('init')
    .description('Initialize a new memory store')
    .argument('[path]', 'Path for the store (defaults to .cortex in current directory)')
    .option('-n, --name <name>', 'Explicit store name (otherwise auto-detected from git)')
    .option('-d, --description <description>', 'Optional description for the store')
    .option('-c, --category-mode <mode>', 'Category mode (free, strict, flat)', 'free')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (path, options) => {
        const configCtx = await createCliConfigContext();
        if (!configCtx.ok()) {
            throwCliError(configCtx.error);
        }

        const { configAdapter, effectiveCwd } = configCtx.value;

        // Build a minimal context for handleInit. The init command cannot go
        // through the full CortexContext/adapterFactory because the store is
        // not yet registered — the adapter factory would throw STORE_NOT_FOUND.
        // handleInit only needs cwd, stdin, stdout, and config (to construct
        // its own adapter directly via initializeStore).
        const ctx = {
            config: configAdapter,
            cwd: effectiveCwd,
            stdin,
            stdout: processStdout,
        } as unknown as CortexContext;

        await handleInit(ctx, path, {
            name: options.name,
            description: options.description,
            categoryMode: options.categoryMode as CategoryMode,
            format: options.format,
        });
    });
