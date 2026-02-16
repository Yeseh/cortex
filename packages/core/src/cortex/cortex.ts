/**
 * Cortex - Root client for the memory system.
 *
 * Provides the main entry point for creating and managing Cortex instances.
 * Supports both programmatic creation via `init()` and config-file-based
 * creation via `fromConfig()`.
 *
 * @module core/cortex/cortex
 *
 * @example
 * ```typescript
 * // Create programmatically (for testing or embedded use)
 * const cortex = Cortex.init({
 *     rootDirectory: '/path/to/config',
 *     registry: { 'my-store': { path: '/path/to/store' } },
 * });
 *
 * // Get a store adapter
 * const adapter = cortex.getStore('my-store');
 * if (adapter.ok()) {
 *     const memory = await adapter.value.memories.read(memoryPath);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Load from config file
 * const result = await Cortex.fromConfig('~/.config/cortex');
 * if (result.ok()) {
 *     const cortex = result.value;
 *     console.log('Loaded stores:', Object.keys(cortex.registry));
 * }
 * ```
 */

import { mkdir } from 'node:fs/promises';
import { resolve, isAbsolute } from 'path';
import os from 'os';

import z from 'zod';
import { type Result, ok, err } from '@/result.ts';
import type { ScopedStorageAdapter, StoreNotFoundError } from '@/storage/adapter.ts';
import type { StoreRegistry, StoreDefinition } from '@/store/registry.ts';
import {
    type CortexOptions,
    type CortexSettings,
    type ConfigError,
    type InitializeError,
    type AdapterFactory,
    DEFAULT_SETTINGS,
} from './types.ts';
import { raw } from 'express';

// =============================================================================
// Zod Schemas for Config Validation
// =============================================================================

/**
 * Schema for settings section of config.yaml.
 */
const settingsSchema = z
    .object({
        output_format: z.enum(['yaml', 'json']).optional(),
        auto_summary_threshold: z.number().int().nonnegative().optional(),
        strict_local: z.boolean().optional(),
    })
    .strict()
    .optional();

/**
 * Schema for a single store definition.
 */
const storeDefinitionSchema = z.object({
    path: z.string().min(1, 'Store path must be a non-empty string'),
    description: z.string().optional(),
});

/**
 * Schema for stores section of config.yaml.
 */
const storesSchema = z
    .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Store name must be a lowercase slug'),
        storeDefinitionSchema
    )
    .optional();

/**
 * Schema for the entire config.yaml file.
 */
const configFileSchema = z.object({
    settings: settingsSchema,
    stores: storesSchema,
});

type ParsedConfigFile = z.infer<typeof configFileSchema>;

// =============================================================================
// Cortex Class
// =============================================================================

/**
 * Root client for the Cortex memory system.
 *
 * The Cortex class manages configuration, store registry, and provides
 * factory access to scoped storage adapters for each registered store.
 *
 * **Creation patterns:**
 * - `Cortex.init(options)` - Synchronous, programmatic creation
 * - `Cortex.fromConfig(configDir)` - Async, loads from config.yaml
 *
 * **Lifecycle:**
 * 1. Create via `init()` or `fromConfig()`
 * 2. Optionally call `initialize()` to create folder structure
 * 3. Use `getStore(name)` to get adapters for specific stores
 */
export class Cortex {
    /** Path to the Cortex configuration directory */
    public readonly rootDirectory: string;

    /** Current runtime settings */
    public readonly settings: CortexSettings;

    /** Store definitions mapping store names to their configuration */
    private readonly registry: StoreRegistry;

    /** Factory for creating scoped storage adapters */
    private readonly adapterFactory: AdapterFactory;

    /** Cache of created adapters by store name */
    private readonly adapterCache: Map<string, ScopedStorageAdapter> = new Map();

    /**
     * Private constructor - use `Cortex.init()` or `Cortex.fromConfig()`.
     */
    private constructor(options: CortexOptions & { adapterFactory: AdapterFactory }) {
        this.rootDirectory = resolve(options.rootDirectory);
        this.settings = { ...DEFAULT_SETTINGS, ...options.settings };
        this.registry = options.registry ?? {};
        this.adapterFactory = options.adapterFactory;
    }

    /**
     * Creates a Cortex instance programmatically.
     *
     * This is a synchronous factory that does not perform any filesystem
     * operations. Use this for testing with mock adapters or when you
     * want full control over configuration.
     *
     * @param options - Configuration options
     * @returns A new Cortex instance
     *
     * @example
     * ```typescript
     * // Minimal usage with defaults
     * const cortex = Cortex.init({ rootDirectory: '/path/to/config' });
     *
     * // With custom settings and registry
     * const cortex = Cortex.init({
     *     rootDirectory: '/path/to/config',
     *     settings: { outputFormat: 'json' },
     *     registry: {
     *         'my-store': { path: '/data/my-store' },
     *     },
     * });
     *
     * ```
     */
    static init(options: CortexOptions): Cortex {
        // Use provided adapter factory or defer to a lazy default
        const adapterFactory = options.adapterFactory ?? createDefaultAdapterFactory();
        return new Cortex({ ...options, adapterFactory });
    }

    /**
     * Loads a Cortex instance from a configuration directory.
     *
     * Reads `config.yaml` from the specified directory and parses both
     * settings and store definitions using YAML parsing and Zod validation.
     *
     * @param configDir - Path to the configuration directory
     * @returns Result with the loaded Cortex instance or a ConfigError
     *
     * @example
     * ```typescript
     * const result = await Cortex.fromConfig('~/.config/cortex');
     * if (result.ok()) {
     *     console.log('Output format:', result.value.settings.outputFormat);
     *     console.log('Stores:', Object.keys(result.value.registry));
     * } else {
     *     console.error('Failed to load:', result.error.message);
     * }
     * ```
     */
    static async fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>> {
        const resolvedDir = resolvePath(configDir);
        const configPath = resolve(resolvedDir, 'config.yaml');

        // Read config file using Bun.file()
        const configFile = Bun.file(configPath);
        let contents: string;
        try {
            if (!(await configFile.exists())) {
                return err({
                    code: 'CONFIG_NOT_FOUND',
                    message: `Config file not found at ${configPath}. Run 'cortex init' to create one.`,
                    path: configPath,
                });
            }
            contents = await configFile.text();
        } catch (error) {
            return err({
                code: 'CONFIG_READ_FAILED',
                message: `Failed to read config file at ${configPath}.`,
                path: configPath,
                cause: error,
            });
        }

        // Parse and validate config file
        const parseResult = parseConfigFile(contents, configPath);
        if (!parseResult.ok()) {
            return parseResult;
        }

        const { settings, registry } = parseResult.value;

        return ok(
            Cortex.init({
                rootDirectory: resolvedDir,
                settings,
                registry,
            })
        );
    }

    /**
     * Creates the folder structure and config file for this Cortex instance.
     *
     * This operation is idempotent - calling it multiple times is safe.
     * If the directory and config already exist, they are preserved.
     *
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const cortex = Cortex.init({
     *     rootDirectory: '/path/to/new/config',
     *     registry: { 'default': { path: '/path/to/store' } },
     * });
     *
     * const result = await cortex.initialize();
     * if (result.ok()) {
     *     console.log('Cortex initialized successfully');
     * }
     * ```
     */
    async initialize(): Promise<Result<void, InitializeError>> {
        const configPath = resolve(this.rootDirectory, 'config.yaml');
        const configFile = Bun.file(configPath);

        // Check if config already exists using Bun.file()
        if (await configFile.exists()) {
            // Config exists, preserve it (idempotent)
            return ok(undefined);
        }

        // Create directory structure
        try {
            await mkdir(this.rootDirectory, { recursive: true });
        } catch (error) {
            return err({
                code: 'DIRECTORY_CREATE_FAILED',
                message: `Failed to create directory at ${this.rootDirectory}. Check that the parent directory exists and you have write permissions.`,
                path: this.rootDirectory,
                cause: error,
            });
        }

        // Write config file using Bun.write()
        try {
            const configContent = serializeConfig(this.settings, this.registry);
            await Bun.write(configPath, configContent);
        } catch (error) {
            return err({
                code: 'CONFIG_WRITE_FAILED',
                message: `Failed to write config file at ${configPath}. Check that you have write permissions to the directory.`,
                path: configPath,
                cause: error,
            });
        }

        return ok(undefined);
    }

    /**
     * Returns a scoped storage adapter for the specified store.
     *
     * The adapter provides access to memory, index, and category operations
     * within the store's context. Adapters are cached for reuse.
     *
     * @param name - The store name to get an adapter for
     * @returns Result with the adapter or StoreNotFoundError
     *
     * @example
     * ```typescript
     * const adapter = cortex.getStore('my-project');
     * if (adapter.ok()) {
     *     // Read a memory
     *     const memory = await adapter.value.memories.read(memoryPath);
     *
     *     // Write a memory
     *     await adapter.value.memories.write(memory);
     *
     *     // Reindex the store
     *     await adapter.value.indexes.reindex();
     * } else {
     *     console.error(`Store not found: ${adapter.error.store}`);
     * }
     * ```
     */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError> {
        const definition = this.registry[name];
        if (!definition) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${name}' is not registered. Available stores: ${Object.keys(this.registry).join(', ') || '(none)'}`,
                store: name,
            });
        }

        // Check cache first
        const cached = this.adapterCache.get(name);
        if (cached) {
            return ok(cached);
        }

        // Create new adapter
        const adapter = this.adapterFactory(definition.path);
        this.adapterCache.set(name, adapter);
        return ok(adapter);
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolves a path, expanding ~ to home directory using Bun-native API.
 */
const resolvePath = (pathStr: string): string => {
    if (pathStr.startsWith('~')) {
        return resolve(os.homedir(), pathStr.slice(1).replace(/^[/\\]/, ''));
    }
    return isAbsolute(pathStr) ? pathStr : resolve(pathStr);
};

/**
 * Creates a default adapter factory that throws until storage-fs is available.
 *
 * The actual FilesystemStorageAdapter is in the storage-fs package, which
 * depends on core. To avoid circular dependencies, we provide a factory
 * that throws a helpful error message. Users should either:
 * 1. Provide their own adapterFactory in options
 * 2. Use the pre-configured factory from storage-fs
 */
const createDefaultAdapterFactory = (): AdapterFactory => {
    return (_storePath: string): ScopedStorageAdapter => {
        throw new Error(
            'No adapter factory provided. Either provide an adapterFactory in CortexOptions, ' +
                'or use createFilesystemCortex() from @yeseh/cortex-storage-fs.'
        );
    };
};

/**
 * Transforms settings from snake_case (config file format) to camelCase (internal format).
 */
const transformSettings = (rawSettings: ParsedConfigFile['settings']): Partial<CortexSettings> => {
    if (!rawSettings) return {};

    const settings: Partial<CortexSettings> = {
        outputFormat: rawSettings.output_format,
        autoSummaryThreshold: rawSettings.auto_summary_threshold,
        strictLocal: rawSettings.strict_local, 
    };

    return settings;
};

/**
 * Transforms stores from config file format to StoreRegistry format.
 */
const transformStores = (rawStores: ParsedConfigFile['stores']): StoreRegistry => {
    if (!rawStores) return {};
    const registry: StoreRegistry = {};
    for (const [name, def] of Object.entries(rawStores)) {
        const storeDefinition: StoreDefinition = { path: def.path };
        if (def.description !== undefined) {
            storeDefinition.description = def.description;
        }
        registry[name] = storeDefinition;
    }
    return registry;
};

/**
 * Parses a config.yaml file content using YAML parsing and Zod validation.
 */
const parseConfigFile = (
    contents: string,
    configPath: string
): Result<{ settings: Partial<CortexSettings>; registry: StoreRegistry }, ConfigError> => {
    // Parse YAML
    let parsed: unknown;
    try {
        parsed = Bun.YAML.parse(contents);
    } catch (error) {
        const yamlError = error as { message?: string };
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: `Invalid YAML in config file: ${yamlError.message ?? 'Unknown parse error'}`,
            path: configPath,
            cause: error,
        });
    }

    // Handle empty file
    if (parsed === null || parsed === undefined) {
        return ok({ settings: {}, registry: {} });
    }

    // Validate with Zod
    const validation = configFileSchema.safeParse(parsed);
    if (!validation.success) {
        const firstError = validation.error.issues[0];
        const fieldPath = firstError?.path.join('.') || 'unknown';
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Invalid config: ${firstError?.message ?? 'Validation failed'} at '${fieldPath}'`,
            path: configPath,
            cause: validation.error,
        });
    }

    const config = validation.data;

    return ok({
        settings: transformSettings(config.settings),
        registry: transformStores(config.stores),
    });
};

/**
 * Serializes settings and registry to config.yaml format.
 */
const serializeConfig = (settings: CortexSettings, registry: StoreRegistry): string => {
    const config: ParsedConfigFile = {
        settings: {
            output_format: settings.outputFormat,
            auto_summary_threshold: settings.autoSummaryThreshold,
            strict_local: settings.strictLocal,
        },
        stores: {},
    };

    // Add stores
    for (const [name, def] of Object.entries(registry)) {
        config.stores![name] = {
            path: def.path,
            ...(def.description !== undefined && { description: def.description }),
        };
    }

    return Bun.YAML.stringify(config);
};
