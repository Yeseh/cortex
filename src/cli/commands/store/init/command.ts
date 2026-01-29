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
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { mapCoreError } from '../../../errors.ts';
import { getDefaultRegistryPath } from '../../../context.ts';
import {
    loadStoreRegistry,
    saveStoreRegistry,
    isValidStoreName,
} from '../../../../core/store/registry.ts';
import { serializeIndex } from '../../../../core/serialization.ts';
import { serializeOutput, type OutputStoreInit, type OutputFormat } from '../../../output.ts';
import { resolveUserPath } from '../../../paths.ts';

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
 * Dependencies for the init command handler.
 * Allows injection for testing.
 */
export interface InitHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Current working directory (defaults to process.cwd()) */
    cwd?: string;
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
async function resolveStoreName(
    cwd: string,
    explicitName?: string,
): Promise<string> {
    // 1. Use explicit name if provided
    if (explicitName) {
        const trimmed = explicitName.trim();
        if (!trimmed) {
            mapCoreError({ code: 'INVALID_STORE_NAME', message: 'Store name is required.' });
        }
        if (!isValidStoreName(trimmed)) {
            mapCoreError({ code: 'INVALID_STORE_NAME', message: 'Store name must be a lowercase slug.' });
        }
        return trimmed;
    }

    // 2. Try git detection
    const gitName = await detectGitRepoName(cwd);
    if (gitName) {
        // Convert to valid store name (lowercase slug)
        const normalized = gitName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!isValidStoreName(normalized)) {
            mapCoreError({ code: 'INVALID_STORE_NAME', message: 'Could not derive valid store name from git repo.' });
        }
        return normalized;
    }

    // 3. Error: require --name
    mapCoreError({ code: 'GIT_REPO_REQUIRED', message: 'Not in a git repository. Use --name to specify the store name.' });
}

/**
 * Builds an empty root index for the store.
 *
 * @returns The serialized empty index YAML string
 * @throws {CommanderError} When serialization fails
 */
function buildEmptyRootIndex(): string {
    const serialized = serializeIndex({ memories: [], subcategories: [] });
    if (!serialized.ok) {
        mapCoreError({ code: 'STORE_INIT_FAILED', message: 'Failed to serialize root index.' });
    }
    return serialized.value;
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
    if (!serialized.ok) {
        mapCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Loads the registry and checks for name collision.
 *
 * @param registryPath - Path to the store registry
 * @param storeName - The store name to check
 * @returns The loaded registry
 * @throws {CommanderError} When registry load fails or name already exists
 */
async function loadRegistryAndCheckCollision(
    registryPath: string,
    storeName: string,
): Promise<Record<string, { path: string }>> {
    const registryResult = await loadStoreRegistry(registryPath, { allowMissing: true });
    if (!registryResult.ok) {
        mapCoreError({ code: 'STORE_REGISTRY_FAILED', message: registryResult.error.message });
    }
    if (registryResult.value[storeName]) {
        mapCoreError({ code: 'STORE_ALREADY_EXISTS', message: `Store '${storeName}' is already registered.` });
    }
    return registryResult.value;
}

/**
 * Creates the store directory and root index file.
 *
 * @param rootPath - The path to create the store at
 * @throws {CommanderError} When store creation fails
 */
async function createStoreDirectory(rootPath: string): Promise<void> {
    try {
        await mkdir(rootPath, { recursive: true });
        const serializedIndex = buildEmptyRootIndex();
        await writeFile(resolve(rootPath, 'index.yaml'), serializedIndex, 'utf8');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        mapCoreError({ code: 'STORE_INIT_FAILED', message: `Failed to initialize store at ${rootPath}: ${message}` });
    }
}

/**
 * Registers the store in the global registry.
 *
 * @param registryPath - Path to the store registry
 * @param registry - The current registry contents
 * @param storeName - The store name to register
 * @param rootPath - The store path to register
 * @throws {CommanderError} When registry save fails
 */
async function registerStore(
    registryPath: string,
    registry: Record<string, { path: string }>,
    storeName: string,
    rootPath: string,
): Promise<void> {
    registry[storeName] = { path: rootPath };
    const saved = await saveStoreRegistry(registryPath, registry);
    if (!saved.ok) {
        mapCoreError({ code: 'STORE_REGISTRY_FAILED', message: saved.error.message });
    }
}

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. Resolves the store name (explicit or git detection)
 * 2. Checks for name collision in registry
 * 3. Resolves target path (default to .cortex in cwd)
 * 4. Creates store directory and empty root index
 * 5. Registers in global registry
 * 6. Outputs the result
 *
 * @param targetPath - Optional path for the store (defaults to .cortex in cwd)
 * @param options - Command options (name, format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store already exists or init fails
 */
export async function handleInit(
    targetPath: string | undefined,
    options: InitCommandOptions = {},
    deps: InitHandlerDeps = {},
): Promise<void> {
    const cwd = deps.cwd ?? process.cwd();
    const registryPath = getDefaultRegistryPath();

    // 1. Resolve store name (explicit or git detection)
    const storeName = await resolveStoreName(cwd, options.name);

    // 2. Check for name collision in registry
    const registry = await loadRegistryAndCheckCollision(registryPath, storeName);

    // 3. Resolve target path (default to .cortex in cwd)
    const rootPath = targetPath
        ? resolveUserPath(targetPath.trim(), cwd)
        : resolve(cwd, '.cortex');

    // 4. Create store directory and empty root index
    await createStoreDirectory(rootPath);

    // 5. Register in global registry
    await registerStore(registryPath, registry, storeName, rootPath);

    // 6. Output result
    const output: OutputStoreInit = { path: rootPath, name: storeName };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, deps.stdout ?? process.stdout);
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
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (path, options) => {
        await handleInit(path, options);
    });
