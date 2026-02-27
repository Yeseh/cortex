# Cortex Root Client Implementation Plan

**Goal:** Replace `FilesystemRegistry` with a unified `Cortex` class that serves as the root client, merges config files, and enables dependency injection for testing.
**Architecture:** Factory pattern with `Cortex.fromConfig()` for production and `Cortex.init()` for programmatic/test usage. CortexContext pattern for handler DI.
**Tech Stack:** TypeScript 5.x, Bun, Result types, Zod validation
**Session Id:** ses_39e67f9a2ffeDyzk2MtZpINdbT

---

## Implementation Phases

This plan is organized into 7 phases following the proposal's task breakdown. Each phase can be worked on independently after Phase 1 and 2 are complete.

### Dependency Graph

```
Phase 1 (Types) → Phase 2 (Config) → Phase 3 (Cortex Class)
                                   ↓
                    ┌──────────────┼──────────────┐
                    ↓              ↓              ↓
               Phase 4         Phase 5        Phase 6
              (CLI Migration) (MCP Migration) (Cleanup)
                    ↓              ↓              ↓
                    └──────────────┴──────────────┘
                                   ↓
                              Phase 7 (Validation)
```

---

## Phase 1: Core Types and Interfaces

**Files to modify:**

- `packages/core/src/config.ts` - Add CortexSettings
- `packages/core/src/store/registry.ts` - Rename StoreRegistry → Registry
- `packages/core/src/storage/adapter.ts` - Add AdapterFactory, CortexOptions, CortexContext

### Task 1.1: Define `CortexSettings` interface

**File:** `packages/core/src/config.ts`

Add after the existing `CortexConfig` interface:

```typescript
/**
 * Settings for the Cortex client.
 * These are loaded from the `settings:` section of config.yaml.
 */
export interface CortexSettings {
    /** Output format for CLI and API responses */
    outputFormat: 'yaml' | 'json' | 'toon';
    /** Whether to enable auto-summary for large content */
    autoSummary: boolean;
    /** If true, only use local .cortex store, never fall back to global */
    strictLocal: boolean;
}

/** Default settings when not specified in config */
export const DEFAULT_CORTEX_SETTINGS: CortexSettings = {
    outputFormat: 'yaml',
    autoSummary: false,
    strictLocal: false,
};
```

### Task 1.2: Rename `StoreRegistry` type to `Registry`

**File:** `packages/core/src/store/registry.ts`

```typescript
// Change line 17:
// FROM: export type StoreRegistry = Record<string, StoreDefinition>;
// TO:
export type Registry = Record<string, StoreDefinition>;

// Add deprecated alias for backward compatibility during migration:
/** @deprecated Use Registry instead */
export type StoreRegistry = Registry;
```

### Task 1.3: Verify `StoreDefinition` interface exists

Already exists in `packages/core/src/store/registry.ts` (lines 12-15):

```typescript
export interface StoreDefinition {
    path: string;
    description?: string;
}
```

### Task 1.4: Define `AdapterFactory` type alias

**File:** `packages/core/src/storage/adapter.ts`

Add after the existing interfaces:

```typescript
/**
 * Factory function for creating scoped storage adapters.
 *
 * Used for dependency injection - production code uses the default
 * FilesystemStorageAdapter, tests can inject mock adapters.
 *
 * @param storePath - Absolute path to the store root directory
 * @returns A scoped storage adapter for the store
 */
export type AdapterFactory = (storePath: string) => ScopedStorageAdapter;
```

### Task 1.5: Define `CortexOptions` interface

**File:** `packages/core/src/storage/adapter.ts` (or new file `packages/core/src/cortex/types.ts`)

```typescript
import type { Registry } from '../store/registry.ts';
import type { CortexSettings } from '../config.ts';

/**
 * Options for programmatic Cortex creation via Cortex.init().
 */
export interface CortexOptions {
    /** Path to the config directory (e.g., ~/.config/cortex) */
    rootDirectory: string;
    /** Settings override (merged with defaults) */
    settings?: Partial<CortexSettings>;
    /** Store definitions (default: empty) */
    registry?: Registry;
    /** Custom adapter factory for testing (default: filesystem) */
    adapterFactory?: AdapterFactory;
}
```

### Task 1.6: Define `CortexContext` interface

**File:** `packages/core/src/storage/adapter.ts`

```typescript
import type { Cortex } from '../cortex/cortex.ts';

/**
 * Context object passed to CLI and MCP handlers.
 * Provides access to the root Cortex client.
 */
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: Cortex;
}
```

### Task 1.7: Update imports for StoreRegistry → Registry rename

Search and replace across:

- `packages/core/src/store/*.ts`
- `packages/storage-fs/src/*.ts`
- `packages/cli/src/**/*.ts`
- `packages/server/src/**/*.ts`

Use the deprecated alias initially, then fully migrate.

---

## Phase 2: Merged Config Schema

**Files to modify:**

- `packages/core/src/config.ts` - Update parsing logic

### Task 2.1: Update config schema for merged format

The merged config format:

```yaml
settings:
    output_format: yaml
    auto_summary: false
    strict_local: false

stores:
    default:
        path: /home/user/.config/cortex/memory
        description: Global user memory
```

**File:** `packages/core/src/config.ts`

Add new types:

```typescript
/**
 * Merged config file structure with settings and stores sections.
 */
export interface MergedConfig {
    settings: CortexSettings;
    stores: Registry;
}

export type MergedConfigLoadErrorCode =
    | 'CONFIG_NOT_FOUND'
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'INVALID_STORE_PATH';

export interface MergedConfigLoadError {
    code: MergedConfigLoadErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}
```

### Task 2.2: Write `parseMergedConfig()` function

```typescript
import { isAbsolute } from 'node:path';

/**
 * Parses a merged config file containing settings and stores sections.
 */
export const parseMergedConfig = (raw: string): Result<MergedConfig, MergedConfigLoadError> => {
    // Use Bun.YAML.parse for YAML parsing
    let parsed: unknown;
    try {
        parsed = Bun.YAML.parse(raw);
    } catch (error) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Failed to parse config YAML',
            cause: error,
        });
    }

    if (typeof parsed !== 'object' || parsed === null) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Config must be a YAML object',
        });
    }

    const config = parsed as Record<string, unknown>;

    // Parse settings section
    const settings = parseSettingsSection(config.settings);
    if (!settings.ok()) return settings;

    // Parse stores section
    const stores = parseStoresSection(config.stores);
    if (!stores.ok()) return stores;

    return ok({
        settings: settings.value,
        stores: stores.value,
    });
};
```

### Task 2.3: Write `serializeMergedConfig()` function

```typescript
/**
 * Serializes a merged config to YAML format.
 */
export const serializeMergedConfig = (config: MergedConfig): string => {
    const obj = {
        settings: {
            output_format: config.settings.outputFormat,
            auto_summary: config.settings.autoSummary,
            strict_local: config.settings.strictLocal,
        },
        stores: Object.fromEntries(
            Object.entries(config.stores).map(([name, def]) => [
                name,
                {
                    path: def.path,
                    ...(def.description && { description: def.description }),
                },
            ])
        ),
    };
    return Bun.YAML.stringify(obj);
};
```

### Task 2.4: Add validation for absolute store paths

```typescript
const validateStorePath = (
    path: string,
    storeName: string
): Result<void, MergedConfigLoadError> => {
    if (!isAbsolute(path)) {
        return err({
            code: 'INVALID_STORE_PATH',
            message: `Store '${storeName}' has relative path '${path}'. Store paths must be absolute.`,
        });
    }
    return ok(undefined);
};
```

### Tasks 2.5-2.7: Tests

Create `packages/core/src/config-merged.spec.ts` with tests for:

- Config with both settings and stores
- Config with only stores (uses defaults)
- Config with only settings (empty registry)
- Absolute path validation
- Default values

---

## Phase 3: Cortex Class Implementation

**New file:** `packages/core/src/cortex/cortex.ts`

### Task 3.1: Create `Cortex` class

```typescript
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { err, ok, type Result } from '../result.ts';
import type { CortexSettings, MergedConfig, MergedConfigLoadError } from '../config.ts';
import { DEFAULT_CORTEX_SETTINGS, parseMergedConfig, serializeMergedConfig } from '../config.ts';
import type { Registry, StoreDefinition } from '../store/registry.ts';
import type {
    ScopedStorageAdapter,
    StoreNotFoundError,
    AdapterFactory,
} from '../storage/adapter.ts';

export type CortexErrorCode =
    | 'CONFIG_NOT_FOUND'
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'INVALID_STORE_PATH'
    | 'INITIALIZE_FAILED'
    | 'STORE_NOT_FOUND';

export interface CortexError {
    code: CortexErrorCode;
    message: string;
    cause?: unknown;
}

/**
 * Root client for the Cortex memory system.
 *
 * Provides unified access to stores, settings, and storage adapters.
 * Use `Cortex.fromConfig()` to load from filesystem or `Cortex.init()`
 * for programmatic creation (e.g., in tests).
 */
export class Cortex {
    /** Config directory path */
    readonly rootDirectory: string;
    /** Current settings */
    readonly settings: CortexSettings;
    /** Store definitions */
    readonly registry: Registry;
    /** Factory for creating adapters */
    private readonly adapterFactory: AdapterFactory;

    private constructor(options: Required<CortexOptions>) {
        this.rootDirectory = options.rootDirectory;
        this.settings = { ...DEFAULT_CORTEX_SETTINGS, ...options.settings };
        this.registry = options.registry;
        this.adapterFactory = options.adapterFactory;
    }

    // ... methods in following tasks
}
```

### Task 3.2: Private constructor (done above)

### Task 3.3: Implement `static fromConfig()`

```typescript
/**
 * Load Cortex from a config directory.
 *
 * Reads config.yaml from the specified directory and initializes
 * the Cortex instance with settings and store definitions.
 *
 * @param configDir - Path to config directory (e.g., ~/.config/cortex)
 * @returns Result with Cortex instance or error
 */
static async fromConfig(
    configDir: string,
    defaultAdapterFactory?: AdapterFactory,
): Promise<Result<Cortex, CortexError>> {
    const resolvedDir = configDir.startsWith('~')
        ? join(homedir(), configDir.slice(1))
        : resolve(configDir);

    const configPath = join(resolvedDir, 'config.yaml');

    let contents: string;
    try {
        contents = await readFile(configPath, 'utf8');
    } catch (error) {
        if (isNotFoundError(error)) {
            return err({
                code: 'CONFIG_NOT_FOUND',
                message: `Config file not found at ${configPath}`,
            });
        }
        return err({
            code: 'CONFIG_READ_FAILED',
            message: `Failed to read config at ${configPath}`,
            cause: error,
        });
    }

    const parsed = parseMergedConfig(contents);
    if (!parsed.ok()) {
        return err({
            code: parsed.error.code as CortexErrorCode,
            message: parsed.error.message,
            cause: parsed.error.cause,
        });
    }

    // Import here to avoid circular dependency
    const { createFilesystemAdapterFactory } = await import('@yeseh/cortex-storage-fs');

    return ok(new Cortex({
        rootDirectory: resolvedDir,
        settings: parsed.value.settings,
        registry: parsed.value.stores,
        adapterFactory: defaultAdapterFactory ?? createFilesystemAdapterFactory(),
    }));
}
```

### Task 3.4: Implement `static init()`

```typescript
/**
 * Create Cortex programmatically without filesystem access.
 *
 * Useful for testing with mock adapters or programmatic configuration.
 * Does not read from or write to the filesystem.
 *
 * @param options - Configuration options
 * @returns Cortex instance
 */
static init(options: CortexOptions): Cortex {
    // Import synchronously for init path
    const defaultFactory = options.adapterFactory ?? createFilesystemAdapterFactory();

    return new Cortex({
        rootDirectory: options.rootDirectory,
        settings: { ...DEFAULT_CORTEX_SETTINGS, ...options.settings },
        registry: options.registry ?? {},
        adapterFactory: defaultFactory,
    });
}
```

### Task 3.5: Implement `initialize()`

```typescript
/**
 * Initialize the config directory structure.
 *
 * Creates the config directory and config.yaml if they don't exist.
 * Idempotent - safe to call multiple times.
 *
 * @returns Result indicating success or failure
 */
async initialize(): Promise<Result<void, CortexError>> {
    try {
        await mkdir(this.rootDirectory, { recursive: true });

        const configPath = join(this.rootDirectory, 'config.yaml');

        // Check if config exists
        try {
            await readFile(configPath, 'utf8');
            // Already exists, nothing to do
            return ok(undefined);
        } catch (error) {
            if (!isNotFoundError(error)) {
                return err({
                    code: 'INITIALIZE_FAILED',
                    message: `Failed to check config at ${configPath}`,
                    cause: error,
                });
            }
        }

        // Write new config
        const configYaml = serializeMergedConfig({
            settings: this.settings,
            stores: this.registry,
        });

        await writeFile(configPath, configYaml, 'utf8');
        return ok(undefined);
    } catch (error) {
        return err({
            code: 'INITIALIZE_FAILED',
            message: 'Failed to initialize config directory',
            cause: error,
        });
    }
}
```

### Task 3.6: Implement `getStore()`

```typescript
/**
 * Get a scoped storage adapter for a named store.
 *
 * @param name - Store name from the registry
 * @returns Result with adapter or STORE_NOT_FOUND error
 */
getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError> {
    const definition = this.registry[name];
    if (!definition) {
        return err({
            code: 'STORE_NOT_FOUND',
            message: `Store '${name}' is not registered. Available stores: ${Object.keys(this.registry).join(', ') || 'none'}`,
            store: name,
        });
    }

    return ok(this.adapterFactory(definition.path));
}
```

### Tasks 3.7-3.13: Tests

Create `packages/core/src/cortex/cortex.spec.ts` with comprehensive tests.

---

## Phase 4: CLI Migration

**Files to modify:**

- `packages/cli/src/context.ts` - Use CortexContext
- `packages/cli/src/commands/**/*.ts` - Update handler signatures

### Task 4.1-4.2: Create Cortex at CLI entry point

Update `packages/cli/src/context.ts` to export a function that creates CortexContext:

```typescript
export interface CortexContext {
    cortex: Cortex;
}

export const createCortexContext = async (options?: {
    configPath?: string;
}): Promise<Result<CortexContext, StoreContextError>> => {
    const configPath =
        options?.configPath ??
        process.env.CORTEX_CONFIG_PATH ??
        join(homedir(), '.config', 'cortex');

    const cortexResult = await Cortex.fromConfig(configPath);
    if (!cortexResult.ok()) {
        return err({
            code: 'CONFIG_LOAD_FAILED',
            message: cortexResult.error.message,
            cause: cortexResult.error,
        });
    }

    return ok({ cortex: cortexResult.value });
};
```

### Tasks 4.3-4.10: Update handlers

Each handler's signature changes from:

```typescript
export const handleAdd = async (
    pathArg: string,
    options: AddOptions,
    storeName?: string,
    deps?: HandlerDeps,
): Promise<void> => { ... }
```

To:

```typescript
export const handleAdd = async (
    ctx: CortexContext,
    pathArg: string,
    options: AddOptions,
    storeName?: string
): Promise<void> => {
    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    // ...
};
```

### Tasks 4.11-4.12: Remove FilesystemRegistry usage

Delete direct instantiation and update tests.

---

## Phase 5: MCP Server Migration

**Files to modify:**

- `packages/server/src/mcp.ts` - Create Cortex at startup
- `packages/server/src/memory/tools/shared.ts` - Update resolveStoreAdapter
- `packages/server/src/**/*.ts` - Update tool handlers

### Task 5.1-5.2: Create Cortex at server startup

```typescript
// In mcp.ts
const cortexResult = await Cortex.fromConfig(config.dataPath);
if (!cortexResult.ok()) {
    throw new Error(`Failed to initialize Cortex: ${cortexResult.error.message}`);
}

const ctx: CortexContext = { cortex: cortexResult.value };
// Pass ctx to tool registration
```

### Task 5.3: Update `resolveStoreAdapter`

```typescript
export const resolveStoreAdapter = (
    ctx: CortexContext,
    storeName: string
): Result<ScopedStorageAdapter, McpError> => {
    const result = ctx.cortex.getStore(storeName);
    if (!result.ok()) {
        return err(new McpError(ErrorCode.InvalidParams, result.error.message));
    }
    return ok(result.value);
};
```

---

## Phase 6: Cleanup and Migration

### Task 6.1: Remove `FilesystemRegistry` class

Delete `packages/storage-fs/src/filesystem-registry.ts` and its tests.

### Task 6.2: Remove stores.yaml handling

Config merged - remove any code that reads stores.yaml separately.

### Task 6.3: Update storage-fs exports

Update `packages/storage-fs/src/index.ts` to export new factory function:

```typescript
export const createFilesystemAdapterFactory = (): AdapterFactory => {
    return (storePath: string): ScopedStorageAdapter => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storePath });
        return {
            memories: adapter.memories,
            indexes: adapter.indexes,
            categories: adapter.categories,
        };
    };
};
```

### Tasks 6.4-6.7: Documentation and validation

---

## Phase 7: Validation

### Task 7.1: Run full test suite

```bash
bun test packages
```

### Task 7.2: Run linting

```bash
bunx eslint packages/*/src/**/*.ts --fix
```

### Task 7.3: Type check

```bash
bunx tsc --build
```

### Task 7.4-7.5: Manual testing

Test CLI and MCP server with new config format.

---

## Parallelization Strategy

**Can be parallelized:**

- Phase 4 (CLI Migration) and Phase 5 (MCP Server Migration) after Phase 3 complete

**Must be sequential:**

- Phase 1 → Phase 2 → Phase 3 (dependencies)
- Phase 6 after Phase 4 and 5 complete
- Phase 7 after all phases

---

## Risk Mitigation

1. **Breaking change**: Keep deprecated `StoreRegistry` alias during transition
2. **Config migration**: Document manual migration steps clearly
3. **Test isolation**: Use temp directories with cleanup in afterEach

---

## Code Snippets Reference

### Create mock adapter factory for tests

```typescript
import { createMockStorageAdapter } from './test-utils';

const mockFactory: AdapterFactory = (path) => createMockStorageAdapter({ path });

const cortex = Cortex.init({
    rootDirectory: '/tmp/test',
    registry: { test: { path: '/tmp/test/store' } },
    adapterFactory: mockFactory,
});
```

### Environment variable support

```typescript
// CORTEX_CONFIG_PATH overrides default location
const configDir = process.env.CORTEX_CONFIG_PATH ?? join(homedir(), '.config', 'cortex');
const cortex = await Cortex.fromConfig(configDir);
```
