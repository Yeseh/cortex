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
import { spawn } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { throwCoreError } from '../../errors.ts';
import { getDefaultRegistryPath } from '../../context.ts';
import { isValidStoreName, initializeStore } from '@yeseh/cortex-core/store';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { serializeOutput, type OutputStoreInit, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Explicit store name (otherwise auto-detected from git) */
    name?: string;
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Executes a git command and returns the trimmed stdout.
 */
const runGitCommand = (
    args: string[],
    cwd: string,
): Promise<{ ok: true; value: string } | { ok: false }> => {
    return new Promise((resolvePromise) => {
        const proc = spawn('git', args, { cwd });
        let stdout = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        proc.on('close', (code: number | null) => {
            if (code === 0) {
                resolvePromise({ ok: true, value: stdout.trim() });
            }
            else {
                resolvePromise({ ok: false });
            }
        });
        proc.on('error', () => {
            resolvePromise({ ok: false });
        });
    });
};

/**
 * Detects the git repository name from the current working directory.
 *
 * Uses `git rev-parse --show-toplevel` to find the repository root,
 * then extracts the directory name as the repository name.
 *
 * @param cwd - The current working directory to check for git repository
 * @returns The repository directory name, or `null` if not in a git repository
 */
const detectGitRepoName = async (cwd: string): Promise<string | null> => {
    const result = await runGitCommand([
        'rev-parse', '--show-toplevel',
    ], cwd);
    if (!result.ok) {
        return null;
    }
    return basename(result.value);
};

/**
 * Resolves the store name using a priority-based strategy.
 *
 * Name resolution follows this precedence:
 * 1. **Explicit name** - If `--name` option is provided, use it directly
 * 2. **Git detection** - Auto-detect from git repository directory name
 * 3. **Error** - Fail with guidance to use `--name` flag
 *
 * Git repository names are normalized to valid store name format:
 * - Converted to lowercase
 * - Non-alphanumeric characters replaced with hyphens
 * - Leading/trailing hyphens removed
 *
 * @param cwd - Current working directory
 * @param explicitName - Optional explicit name provided via `--name` option
 * @returns The validated store name
 * @throws {InvalidArgumentError} When the name is invalid
 * @throws {CommanderError} When git detection fails and no name provided
 */
async function resolveStoreName(cwd: string, explicitName?: string): Promise<string> {
    // 1. Use explicit name if provided
    if (explicitName) {
        const trimmed = explicitName.trim();
        if (!trimmed) {
            throwCoreError({ code: 'INVALID_STORE_NAME', message: 'Store name is required.' });
        }
        if (!isValidStoreName(trimmed)) {
            throwCoreError({
                code: 'INVALID_STORE_NAME',
                message: 'Store name must be a lowercase slug.',
            });
        }
        return trimmed;
    }

    // 2. Try git detection
    const gitName = await detectGitRepoName(cwd);
    if (gitName) {
        // Convert to valid store name (lowercase slug)
        const normalized = gitName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        if (!isValidStoreName(normalized)) {
            throwCoreError({
                code: 'INVALID_STORE_NAME',
                message: 'Could not derive valid store name from git repo.',
            });
        }
        return normalized;
    }

    // 3. Error: require --name
    throwCoreError({
        code: 'GIT_REPO_REQUIRED',
        message: 'Not in a git repository. Use --name to specify the store name.',
    });
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
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. Resolves the store name (explicit or git detection)
 * 2. Resolves target path (default to .cortex in cwd)
 * 3. Uses initializeStore to create directory, index, and register
 * 4. Outputs the result
 *
 * @param ctx - CortexContext with output stream
 * @param targetPath - Optional path for the store (defaults to .cortex in cwd)
 * @param options - Command options (name, format)
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store already exists or init fails
 */
export async function handleInit(
    ctx: CortexContext,
    targetPath: string | undefined,
    options: InitCommandOptions = {},
): Promise<void> {
    const cwd = process.cwd();
    const registryPath = getDefaultRegistryPath();

    // 1. Resolve store name (explicit or git detection)
    const storeName = await resolveStoreName(cwd, options.name);

    // 2. Resolve target path (default to .cortex in cwd)
    const rootPath = targetPath ? resolveUserPath(targetPath.trim(), cwd) : resolve(cwd, '.cortex');

    // 3. Use initializeStore to handle directory creation, index, and registration
    const registry = new FilesystemRegistry(registryPath);
    const result = await initializeStore(registry, storeName, rootPath);
    if (!result.ok()) {
        // Map InitStoreError to CLI error
        const errorCode =
            result.error.code === 'STORE_ALREADY_EXISTS'
                ? 'STORE_ALREADY_EXISTS'
                : result.error.code === 'INVALID_STORE_NAME'
                    ? 'INVALID_STORE_NAME'
                    : 'STORE_INIT_FAILED';
        throwCoreError({ code: errorCode, message: result.error.message });
    }

    // 4. Output result
    const output: OutputStoreInit = { path: rootPath, name: storeName };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, ctx.stdout);
}

/**
 * Builds the `init` subcommand for initializing a new memory store.
 *
 * Creates a new store at the specified path (or .cortex in current directory)
 * and registers it in the global registry. The store name is auto-detected
 * from the git repository name or can be explicitly provided.
 *
 * @param ctx - CortexContext providing the Cortex client and output stream.
 * @returns A configured Commander subcommand for `store init`.
 *
 * @example
 * ```bash
 * cortex store init                        # Auto-detect name from git
 * cortex store init --name my-project      # Explicit name
 * cortex store init ./store --name custom  # Custom path and name
 * ```
 */
export const createInitCommand = (ctx: CortexContext) => {
    return new Command('init')
        .description('Initialize a new memory store')
        .argument('[path]', 'Path for the store (defaults to .cortex in current directory)')
        .option('-n, --name <name>', 'Explicit store name (otherwise auto-detected from git)')
        .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
        .action(async (path, options) => {
            await handleInit(ctx, path, options);
        });
};
