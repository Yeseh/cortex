/**
 * Store management commands for the CLI.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import type {
    OutputPayload,
    OutputStore,
    OutputStoreRegistry,
    OutputStoreInit,
} from '../output.ts';
import {
    isValidStoreName,
    loadStoreRegistry,
    saveStoreRegistry,
    removeStoreRegistry,
} from '../../core/store/registry.ts';
import { serializeIndex } from '../../core/serialization.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
import { serializeMemoryFile, type MemoryFileContents } from '../../core/memory/index.ts';

export interface StoreCommandOptions {
    args: string[];
    cwd: string;
    registryPath: string;
}

export interface StoreCommandResult {
    output: OutputPayload;
}

export type StoreCommandErrorCode =
    | 'INVALID_COMMAND'
    | 'INVALID_STORE_NAME'
    | 'INVALID_STORE_PATH'
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_REGISTRY_FAILED'
    | 'STORE_INIT_FAILED'
    | 'GIT_COMMAND_FAILED'
    | 'GIT_REPO_REQUIRED';

export interface StoreCommandError {
    code: StoreCommandErrorCode;
    message: string;
    cause?: unknown;
}

type StoreRegistryPayload = Record<string, { path: string }>;
type LoadRegistryResult = Result<StoreRegistryPayload, StoreCommandError>;
type StoreResult = Result<StoreCommandResult, StoreCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const formatRegistry = (registry: Record<string, { path: string }>): OutputStoreRegistry => ({
    stores: Object.entries(registry)
        .map(([
            name, definition,
        ]) => ({ name, path: definition.path }))
        .sort((left, right) => left.name.localeCompare(right.name)),
});

const formatStore = (name: string, path: string): OutputStore => ({ name, path });

const formatStoreInit = (path: string, name: string): OutputStoreInit => ({ path, name });

const validateStoreNameInput = (name: string): Result<string, StoreCommandError> => {
    const trimmed = name.trim();
    if (!trimmed) {
        return err({
            code: 'INVALID_STORE_NAME',
            message: 'Store name is required.',
        });
    }
    if (!isValidStoreName(trimmed)) {
        return err({
            code: 'INVALID_STORE_NAME',
            message: 'Store name must be a lowercase slug.',
        });
    }
    return ok(trimmed);
};

const validateStorePathInput = (path: string): Result<string, StoreCommandError> => {
    const trimmed = path.trim();
    if (!trimmed) {
        return err({
            code: 'INVALID_STORE_PATH',
            message: 'Store path is required.',
        });
    }
    return ok(trimmed);
};

/**
 * Checks if a path is absolute (Unix or Windows style).
 *
 * Detects:
 * - Unix absolute paths starting with `/`
 * - Windows drive paths like `C:/` or `C:\`
 * - Windows UNC paths like `\\server\share` or `//server/share`
 *
 * @param inputPath - The path to check
 * @returns `true` if the path is absolute, `false` otherwise
 */
const isAbsolutePath = (inputPath: string): boolean => {
    // Unix absolute path
    if (inputPath.startsWith('/')) {
        return true;
    }
    // Windows absolute path (e.g., C:/ or C:\)
    if (/^[a-zA-Z]:[/\\]/.test(inputPath)) {
        return true;
    }
    // Windows UNC paths (e.g., \\server\share or //server/share)
    if (inputPath.startsWith('\\\\') || inputPath.startsWith('//')) {
        return true;
    }
    return false;
};

/**
 * Resolves a store path to an absolute path.
 *
 * Path resolution rules:
 * - Tilde (`~`) is expanded to the user's home directory
 * - Relative paths are resolved against the current working directory
 * - Absolute paths are normalized (resolving `.` and `..` segments)
 *
 * Note: The `~username` syntax (Unix convention for other users' home directories)
 * is not supported. Paths like `~bob` will be resolved as `<home>/bob`.
 *
 * @param inputPath - The path provided by the user
 * @param cwd - The current working directory for relative path resolution
 * @returns The resolved absolute path
 *
 * @example
 * // Relative paths
 * resolveStorePath('./store', '/home/user')  // '/home/user/store'
 * resolveStorePath('../other', '/home/user') // '/home/other'
 *
 * @example
 * // Tilde expansion
 * resolveStorePath('~/memories', '/anywhere') // '/home/user/memories' (on Unix)
 *
 * @example
 * // Absolute paths (normalized)
 * resolveStorePath('/opt/../etc', '/anywhere') // '/etc'
 */
const resolveStorePath = (inputPath: string, cwd: string): string => {
    // Handle tilde expansion
    if (inputPath.startsWith('~')) {
        const home = homedir();
        return resolve(home, inputPath.slice(1).replace(/^[/\\]/, ''));
    }
    // Normalize absolute paths (resolves .. and . segments)
    if (isAbsolutePath(inputPath)) {
        return resolve(inputPath);
    }
    // Resolve relative paths against cwd
    return resolve(cwd, inputPath);
};

const loadRegistryOrEmpty = async (registryPath: string): Promise<LoadRegistryResult> => {
    const loaded = await loadStoreRegistry(registryPath, { allowMissing: true });
    if (!loaded.ok) {
        return err({
            code: 'STORE_REGISTRY_FAILED',
            message: loaded.error.message,
            cause: loaded.error,
        });
    }
    return ok(loaded.value);
};

const saveRegistry = async (
    registryPath: string,
    registry: Record<string, { path: string }>,
): Promise<Result<void, StoreCommandError>> => {
    const saved = await saveStoreRegistry(registryPath, registry);
    if (!saved.ok) {
        return err({
            code: 'STORE_REGISTRY_FAILED',
            message: saved.error.message,
            cause: saved.error,
        });
    }
    return ok(undefined);
};

const buildEmptyRootIndex = (): Result<string, StoreCommandError> => {
    const serialized = serializeIndex({ memories: [], subcategories: [] });
    if (!serialized.ok) {
        return err({
            code: 'STORE_INIT_FAILED',
            message: 'Failed to serialize root index.',
            cause: serialized.error,
        });
    }
    return ok(serialized.value);
};

/**
 * Executes a git command and returns the trimmed stdout.
 */
const runGitCommand = (
    args: string[],
    cwd: string,
): Promise<Result<string, StoreCommandError>> => {
    return new Promise((resolve) => {
        const proc = spawn('git', args, { cwd });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
        proc.on('close', (code: number | null) => {
            if (code === 0) {
                resolve(ok(stdout.trim()));
            }
            else {
                resolve(err({
                    code: 'GIT_COMMAND_FAILED',
                    message: stderr.trim() || `Git command failed with code ${code}`,
                }));
            }
        });
        proc.on('error', (error: Error) => {
            resolve(err({
                code: 'GIT_COMMAND_FAILED',
                message: error.message,
                cause: error,
            }));
        });
    });
};

/**
 * Detects the git repository name from the current working directory.
 *
 * Uses `git rev-parse --show-toplevel` to find the repository root,
 * then extracts the directory name as the repository name. This enables
 * automatic store naming based on the project context.
 *
 * @param cwd - The current working directory to check for git repository
 * @returns The repository directory name, or `null` if not in a git repository
 *
 * @example
 * ```ts
 * // Inside /home/user/projects/my-app (a git repo)
 * const name = await detectGitRepoName('/home/user/projects/my-app');
 * // Returns: 'my-app'
 *
 * // Outside any git repository
 * const name = await detectGitRepoName('/tmp');
 * // Returns: null
 * ```
 */
export const detectGitRepoName = async (cwd: string): Promise<string | null> => {
    const result = await runGitCommand([
        'rev-parse', '--show-toplevel',
    ], cwd);
    if (!result.ok) {
        return null;
    }
    return basename(result.value);
};

interface StoreInitOptions {
    targetPath?: string;
    name?: string;
}

const parseStoreInitArgs = (args: string[]): StoreInitOptions => {
    const options: StoreInitOptions = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--name' && args[i + 1]) {
            options.name = args[i + 1];
            i++; // Skip next arg
        }
        else if (arg && !arg.startsWith('--')) {
            options.targetPath = arg;
        }
    }
    return options;
};

/**
 * Resolves the store name using a priority-based strategy.
 *
 * Name resolution follows this precedence:
 * 1. **Explicit name** - If `--name` flag is provided, use it directly
 * 2. **Git detection** - Auto-detect from git repository directory name
 * 3. **Error** - Fail with guidance to use `--name` flag
 *
 * Git repository names are normalized to valid store name format:
 * - Converted to lowercase
 * - Non-alphanumeric characters replaced with hyphens
 * - Leading/trailing hyphens removed
 *
 * @param options - Command options containing current working directory
 * @param explicitName - Optional explicit name provided via `--name` flag
 * @returns Validated store name, or error if name cannot be resolved
 *
 * @example
 * ```ts
 * // With explicit name
 * const result = await resolveStoreName(options, 'my-store');
 * // Returns: { ok: true, value: 'my-store' }
 *
 * // Auto-detect from git repo 'My-Project'
 * const result = await resolveStoreName(options);
 * // Returns: { ok: true, value: 'my-project' }
 *
 * // Not in git repo, no explicit name
 * const result = await resolveStoreName(options);
 * // Returns: { ok: false, error: { code: 'GIT_REPO_REQUIRED', ... } }
 * ```
 */
const resolveStoreName = async (
    options: StoreCommandOptions,
    explicitName?: string,
): Promise<Result<string, StoreCommandError>> => {
    // 1. Use explicit name if provided
    if (explicitName) {
        return validateStoreNameInput(explicitName);
    }

    // 2. Try git detection
    const gitName = await detectGitRepoName(options.cwd);
    if (gitName) {
        // Convert to valid store name (lowercase slug)
        const normalized = gitName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return validateStoreNameInput(normalized);
    }

    // 3. Error: require --name
    return err({
        code: 'GIT_REPO_REQUIRED',
        message: 'Not in a git repository. Use --name to specify the store name.',
    });
};

/**
 * Checks if a store name already exists in the registry.
 *
 * Prevents accidental overwriting of existing stores by verifying
 * the proposed name is not already registered. This is a safety check
 * performed before creating a new store.
 *
 * @param registryPath - Path to the store registry file
 * @param name - The proposed store name to check
 * @returns Success if name is available, error if name already exists
 *
 * @example
 * ```ts
 * // Name is available
 * const result = await checkNameCollision(registryPath, 'new-store');
 * // Returns: { ok: true, value: undefined }
 *
 * // Name already exists
 * const result = await checkNameCollision(registryPath, 'existing-store');
 * // Returns: { ok: false, error: { code: 'STORE_ALREADY_EXISTS', ... } }
 * ```
 */
const checkNameCollision = async (
    registryPath: string,
    name: string,
): Promise<Result<void, StoreCommandError>> => {
    const registry = await loadRegistryOrEmpty(registryPath);
    if (!registry.ok) {
        return registry;
    }
    if (registry.value[name]) {
        return err({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${name}' is already registered.`,
        });
    }
    return ok(undefined);
};

/**
 * Creates a project entry in the default store for discoverability.
 *
 * When a new project store is initialized, this function creates a memory
 * entry in the default store's `projects/` category. This enables users
 * to discover and track all project stores from a central location.
 *
 * The project entry includes:
 * - Store name and path
 * - Initialization timestamp
 * - Tags: `project`, `store`
 *
 * This operation is **best effort** - failures are silently ignored to
 * ensure store initialization succeeds even if:
 * - No default store exists
 * - The `projects/` category doesn't exist
 * - Write permissions are restricted
 *
 * @param registryPath - Path to the store registry file
 * @param storeName - Name of the newly created store
 * @param storePath - Filesystem path to the new store
 * @returns Success (always succeeds, even if entry creation fails)
 *
 * @example
 * ```ts
 * // Creates entry at 'projects/my-app' in default store
 * await createProjectEntry(registryPath, 'my-app', '/home/user/my-app/.cortex');
 * ```
 */
const createProjectEntry = async (
    registryPath: string,
    storeName: string,
    storePath: string,
): Promise<Result<void, StoreCommandError>> => {
    // Load registry to find default store
    const registry = await loadRegistryOrEmpty(registryPath);
    if (!registry.ok) {
        return registry;
    }

    // Find the default store
    const defaultStore = registry.value['default'];
    if (!defaultStore) {
        // No default store configured, skip project entry creation
        return ok(undefined);
    }

    // Create project memory content
    const now = new Date();
    const content = `# Project: ${storeName}

Store path: ${storePath}
Initialized: ${now.toISOString()}
`;

    const memoryContents: MemoryFileContents = {
        frontmatter: {
            createdAt: now,
            updatedAt: now,
            tags: [
                'project', 'store',
            ],
            source: 'cli',
        },
        content,
    };

    const serialized = serializeMemoryFile(memoryContents);
    if (!serialized.ok) {
        // Serialization failed, but don't fail the whole init
        return ok(undefined);
    }

    // Write to the default store
    const adapter = new FilesystemStorageAdapter({ rootDirectory: defaultStore.path });
    const slugPath = `projects/${storeName}`;

    const writeResult = await adapter.writeMemoryFile(slugPath, serialized.value, {
        allowIndexCreate: true,
        allowIndexUpdate: true,
    });

    if (!writeResult.ok) {
        // Write failed (e.g., projects category doesn't exist), but don't fail init
        return ok(undefined);
    }

    return ok(undefined);
};

const runStoreList = async (options: StoreCommandOptions): Promise<StoreResult> => {
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }

    return ok({
        output: {
            kind: 'store-registry',
            value: formatRegistry(registryResult.value),
        },
    });
};

const runStoreAdd = async (
    options: StoreCommandOptions,
    name: string,
    path: string,
): Promise<StoreResult> => {
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }

    if (registryResult.value[name]) {
        return err({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${name}' is already registered.`,
        });
    }

    registryResult.value[name] = { path };
    const saved = await saveRegistry(options.registryPath, registryResult.value);
    if (!saved.ok) {
        return saved;
    }

    return ok({
        output: {
            kind: 'store',
            value: formatStore(name, path),
        },
    });
};

const runStoreRemove = async (options: StoreCommandOptions, name: string): Promise<StoreResult> => {
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }

    if (!registryResult.value[name]) {
        return err({
            code: 'STORE_REGISTRY_FAILED',
            message: `Store '${name}' is not registered.`,
        });
    }

    const { [name]: removed, ...rest } = registryResult.value;
    const remainingEntries = Object.keys(rest).length;
    if (remainingEntries === 0) {
        const removedRegistry = await removeStoreRegistry(options.registryPath);
        if (!removedRegistry.ok) {
            return err({
                code: 'STORE_REGISTRY_FAILED',
                message: removedRegistry.error.message,
                cause: removedRegistry.error,
            });
        }
    }
    else {
        const saved = await saveRegistry(options.registryPath, rest);
        if (!saved.ok) {
            return saved;
        }
    }

    const removedPath = removed?.path ?? '';
    return ok({
        output: {
            kind: 'store',
            value: formatStore(name, removedPath),
        },
    });
};

/**
 * Initializes a new memory store with automatic naming and registration.
 *
 * This is the main entry point for the `store init` command. It performs
 * a complete store initialization workflow:
 *
 * 1. **Resolve store name** - Uses explicit `--name` or auto-detects from git
 * 2. **Check for collisions** - Ensures name isn't already registered
 * 3. **Resolve target path** - Defaults to `.cortex` in current directory
 * 4. **Create store directory** - Creates directory and empty root index
 * 5. **Register in global registry** - Adds store to `stores.yaml`
 * 6. **Create project entry** - Adds discoverable entry in default store
 *
 * The function supports two primary workflows:
 *
 * **Git repository workflow** (recommended):
 * ```bash
 * cd my-project   # A git repository
 * cortex store init
 * # Creates: ./cortex with name 'my-project'
 * ```
 *
 * **Manual naming workflow**:
 * ```bash
 * cortex store init --name custom-store ./path/to/store
 * # Creates: ./path/to/store with name 'custom-store'
 * ```
 *
 * @param options - Command options including cwd and registry path
 * @param initOptions - Optional init-specific options (name, targetPath)
 * @returns Store initialization result with path and name, or error
 *
 * @example
 * ```ts
 * // Basic init in git repo
 * const result = await runStoreInit(options);
 * if (result.ok) {
 *     console.log(`Created store '${result.value.output.value.name}'`);
 *     console.log(`Path: ${result.value.output.value.path}`);
 * }
 *
 * // Init with explicit name and custom path
 * const result = await runStoreInit(options, {
 *     name: 'my-memories',
 *     targetPath: '~/memories',
 * });
 * ```
 *
 * @see {@link resolveStoreName} for name resolution strategy
 * @see {@link checkNameCollision} for collision detection
 * @see {@link createProjectEntry} for project entry creation
 */
const runStoreInit = async (
    options: StoreCommandOptions,
    initOptions?: StoreInitOptions,
): Promise<StoreResult> => {
    // 1. Resolve store name
    const nameResult = await resolveStoreName(options, initOptions?.name);
    if (!nameResult.ok) {
        return nameResult;
    }
    const storeName = nameResult.value;

    // 2. Check for name collision
    const collisionCheck = await checkNameCollision(options.registryPath, storeName);
    if (!collisionCheck.ok) {
        return collisionCheck;
    }

    // 3. Resolve target path
    const targetPath = initOptions?.targetPath?.trim();
    const rootPath = targetPath 
        ? resolveStorePath(targetPath, options.cwd) 
        : resolve(options.cwd, '.cortex');
    const indexPath = resolve(rootPath, 'index.yaml');

    // 4. Create store directory and index
    try {
        await mkdir(rootPath, { recursive: true });
        const serializedIndex = buildEmptyRootIndex();
        if (!serializedIndex.ok) {
            return serializedIndex;
        }
        await writeFile(indexPath, serializedIndex.value, 'utf8');
    }
    catch (error) {
        return err({
            code: 'STORE_INIT_FAILED',
            message: `Failed to initialize store at ${rootPath}.`,
            cause: error,
        });
    }

    // 5. Register in global registry
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }
    registryResult.value[storeName] = { path: rootPath };
    const saved = await saveRegistry(options.registryPath, registryResult.value);
    if (!saved.ok) {
        return saved;
    }

    // 6. Create project entry in default store (best effort, non-blocking)
    await createProjectEntry(options.registryPath, storeName, rootPath);

    return ok({
        output: {
            kind: 'store-init',
            value: formatStoreInit(rootPath, storeName),
        },
    });
};

const runStoreAction = (
    options: StoreCommandOptions,
    command: string,
    args: string[],
): Promise<StoreResult> => {
    const handlers: Record<string, (args: string[]) => Promise<StoreResult>> = {
        list: () => runStoreList(options),
        add: ([
            name, path,
        ]) => runStoreAddCommand(options, name, path),
        remove: ([name]) => runStoreRemoveCommand(options, name),
        init: (args) => runStoreInitCommand(options, args),
    };

    const handler = handlers[command];
    if (!handler) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: `Unknown store command: ${command}.`,
            }),
        );
    }

    return handler(args);
};

const runStoreAddCommand = (
    options: StoreCommandOptions,
    name: string | undefined,
    path: string | undefined,
): Promise<StoreResult> => {
    if (!name || !path) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: 'Store add requires a name and a path.',
            }),
        );
    }
    const parsedName = validateStoreNameInput(name);
    if (!parsedName.ok) {
        return Promise.resolve(parsedName);
    }
    const parsedPath = validateStorePathInput(path);
    if (!parsedPath.ok) {
        return Promise.resolve(parsedPath);
    }
    const resolvedPath = resolveStorePath(parsedPath.value, options.cwd);
    return runStoreAdd(options, parsedName.value, resolvedPath);
};

const runStoreRemoveCommand = (
    options: StoreCommandOptions,
    name: string | undefined,
): Promise<StoreResult> => {
    if (!name) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: 'Store remove requires a name.',
            }),
        );
    }
    const parsedName = validateStoreNameInput(name);
    if (!parsedName.ok) {
        return Promise.resolve(parsedName);
    }
    return runStoreRemove(options, parsedName.value);
};

const runStoreInitCommand = (
    options: StoreCommandOptions,
    args: string[],
): Promise<StoreResult> => {
    const initOptions = parseStoreInitArgs(args);
    return runStoreInit(options, initOptions);
};

export const runStoreCommand = async (options: StoreCommandOptions): Promise<StoreResult> => {
    const [
        command, ...rest
    ] = options.args;
    if (!command) {
        return err({
            code: 'INVALID_COMMAND',
            message: 'Store command is required.',
        });
    }
    return runStoreAction(options, command, rest);
};
