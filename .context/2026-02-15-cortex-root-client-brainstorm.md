# Cortex Root Client Brainstorm

**Date:** February 15, 2026  
**Participant:** Jesse Wellenberg  
**Topic:** Evolving Registry into the Cortex Root Client

---

## Problem Statement

The current `Registry` (specifically `FilesystemRegistry`) is being instantiated directly in **10+ locations** across CLI and Server packages. Every handler follows the same boilerplate pattern:

```typescript
const registry = new FilesystemRegistry(registryPath);
const loadResult = await registry.load();
if (!loadResult.ok()) {
    /* handle error */
}
const storeResult = registry.getStore(storeName);
```

### Issues Identified

1. **Direct coupling**: Every CLI and Server handler creates `FilesystemRegistry` directly
2. **No dependency injection**: Cannot easily swap implementations for testing
3. **Duplicated instantiation logic**: Same pattern repeated across 10+ files
4. **Separate config systems**: `CortexConfig` (YAML) and `StoreRegistry` are separate concerns
5. **No shared context**: Each tool invocation creates fresh Registry, no caching across calls
6. **Inconsistent error handling**: `REGISTRY_MISSING` handled differently across locations

### Current Usage Locations

| Package | Files with direct `new FilesystemRegistry()`                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| CLI     | `context.ts` (3x), `store/add.ts`, `store/remove.ts`, `store/init.ts`, `init/command.ts`                              |
| Server  | `memory/tools/shared.ts`, `health.ts`, `store/tools.ts`, `store/index.ts`, `category/tools.ts`, `memory/resources.ts` |

The only place with proper DI is `initializeStore()` in core which accepts a `Registry` interface.

---

## Design Goals

1. **Single root client**: `Cortex` becomes the main entry point for interacting with the memory system
2. **Session-scoped**: One instance per CLI invocation or MCP server lifetime (no reloading)
3. **Unified config**: Merge `CortexConfig` and store definitions into single `config.yaml`
4. **Dependency injection**: Enable injecting mocks into handlers for testing
5. **Clean factory pattern**: `fromConfig()` for production, `init()` for testing

---

## Agreed Design

### Naming Changes

| Old Name               | New Name          | Notes                                  |
| ---------------------- | ----------------- | -------------------------------------- |
| `Registry` (interface) | `Cortex` (class)  | Now the root client                    |
| `StoreRegistry` (type) | `Registry` (type) | Collection of store definitions        |
| `FilesystemRegistry`   | Removed           | Logic moves into `Cortex.fromConfig()` |

### Config File Structure

Single `config.yaml` file at `~/.config/cortex/config.yaml`:

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

**Key decisions:**

- `settings:` key for configuration options
- `stores:` key for store definitions
- All store paths **must be absolute** (no relative path resolution)
- Settings have sensible defaults when omitted

### Cortex Class API

```typescript
interface CortexSettings {
    output_format: 'yaml' | 'json' | 'toon';
    auto_summary: boolean;
    strict_local: boolean;
}

interface StoreDefinition {
    path: string; // Always absolute
    description?: string;
}

type Registry = Record<string, StoreDefinition>;

type AdapterFactory = (storePath: string) => ScopedStorageAdapter;

interface CortexOptions {
    rootDirectory: string; // Required
    settings?: Partial<CortexSettings>; // Overrides defaults
    registry?: Registry; // Overrides empty default
    adapterFactory?: AdapterFactory; // Defaults to FilesystemStorageAdapter
}

class Cortex {
    readonly rootDirectory: string;
    readonly settings: CortexSettings;
    readonly registry: Registry;

    private constructor(options: CortexOptions) {
        /* ... */
    }

    /**
     * Production factory - reads config.yaml from configDir.
     * Errors if config doesn't exist (fail fast).
     * Always uses FilesystemStorageAdapter.
     */
    static fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>>;

    /**
     * Testing/programmatic factory - sync, no filesystem.
     * Options are overrides of sensible defaults.
     * Supports custom adapterFactory for mocking.
     */
    static init(options: CortexOptions): Cortex;

    /**
     * Creates folder structure and config file if needed.
     * Idempotent - safe to call multiple times.
     */
    initialize(): Promise<Result<void, InitializeError>>;

    /**
     * Factory method for store adapters.
     * Uses cached registry, returns scoped adapter.
     */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;
}
```

### Default Values

When using `Cortex.init()`, these defaults apply:

```typescript
const DEFAULT_SETTINGS: CortexSettings = {
    output_format: 'yaml',
    auto_summary: false,
    strict_local: false,
};

const DEFAULT_REGISTRY: Registry = {};

const DEFAULT_ADAPTER_FACTORY: AdapterFactory = (storePath) =>
    new FilesystemStorageAdapter({ rootDirectory: storePath });
```

---

## Usage Examples

### Production (CLI/MCP Server)

```typescript
// Read config from filesystem - errors if missing
const cortexResult = await Cortex.fromConfig('~/.config/cortex');
if (!cortexResult.ok) {
    // Config doesn't exist - fail fast
    throw new Error(cortexResult.error.message);
}
const cortex = cortexResult.value;

// Get store adapter
const storeResult = cortex.getStore('default');
if (!storeResult.ok) {
    /* handle missing store */
}
const adapter = storeResult.value;
```

### First-Time Setup

```typescript
const cortex = Cortex.init({
    rootDirectory: '~/.config/cortex',
    registry: {
        default: { path: '~/.config/cortex/memory' },
    },
});
await cortex.initialize(); // Creates config.yaml and folder structure
```

### Testing with Mock Adapter

```typescript
const mockAdapter = createMockAdapter();
const cortex = Cortex.init({
    rootDirectory: '/tmp/test',
    registry: {
        test: { path: '/tmp/test/memory' },
    },
    adapterFactory: () => mockAdapter,
});

// getStore() now returns mock adapter
const store = cortex.getStore('test');
```

### Testing with Defaults

```typescript
// Minimal - uses filesystem adapter, empty registry, default settings
const cortex = Cortex.init({ rootDirectory: '/tmp/test' });
```

---

## Handler Context Pattern

Handlers receive a shared context object as first parameter:

```typescript
interface CortexContext {
    cortex: Cortex;
    // Future additions:
    // logger?: Logger;
    // user?: UserContext;
}
```

### CLI Handler Example

```typescript
export interface AddHandlerDeps {
    stdout?: NodeJS.WritableStream;
    // Other deps...
}

export async function handleAdd(
    ctx: CortexContext,
    args: AddArgs,
    options: AddOptions,
    deps: AddHandlerDeps = {}
): Promise<void> {
    const storeResult = ctx.cortex.getStore(args.store);
    if (!storeResult.ok) {
        throw new InvalidArgumentError(storeResult.error.message);
    }
    const adapter = storeResult.value;
    // Use adapter for operations...
}
```

### MCP Tool Example

```typescript
// Server startup
const cortexResult = await Cortex.fromConfig(process.env.CORTEX_DATA_PATH);
if (!cortexResult.ok) {
    throw new Error('Cortex config not found');
}
const ctx: CortexContext = { cortex: cortexResult.value };

// Tool registration
server.tool('cortex_add_memory', schema, async (input) => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok) {
        return errorResponse(storeResult.error);
    }
    // Use storeResult.value...
});
```

---

## Key Design Decisions

| Decision                     | Choice                   | Rationale                                     |
| ---------------------------- | ------------------------ | --------------------------------------------- |
| Scope                        | Session-scoped singleton | Avoid reloading config on every operation     |
| Config format                | Single `config.yaml`     | Unified config reduces complexity             |
| Store paths                  | Always absolute          | Eliminates path resolution ambiguity          |
| `fromConfig` on missing      | Error (fail fast)        | Explicit handling required, MCP needs env var |
| `init()` sync                | Yes                      | No filesystem access, just object creation    |
| `fromConfig()` async         | Yes                      | Reads config file from disk                   |
| `initialize()` idempotent    | Yes                      | Safe to call multiple times                   |
| Adapter factory              | Optional in `init()`     | Defaults to filesystem, override for testing  |
| `fromConfig` adapter factory | Not supported            | Production always uses filesystem             |
| Settings in `init()`         | Partial overrides        | Merge with sensible defaults                  |

---

## Deferred Decisions

### Local Config Discovery

Currently deferred for MCP compatibility. Future enhancement:

- `fromConfig` could accept `cwd` parameter
- Discover `.cortex/config.yaml` in project
- Merge local config over global (local takes precedence)
- MCP server would skip local config (no meaningful cwd)

### Additional Context Fields

The `CortexContext` can expand over time:

```typescript
interface CortexContext {
    cortex: Cortex;
    logger?: Logger; // Future: structured logging
    user?: UserContext; // Future: user identity/preferences
    request?: RequestContext; // Future: request tracing
}
```

---

## Migration Path

### Phase 1: Add Cortex Class

- Create `Cortex` class in `packages/core`
- Implement `fromConfig()` and `init()` factories
- Keep `FilesystemRegistry` temporarily for backward compatibility

### Phase 2: Update Handlers

- Add `CortexContext` to handler signatures
- Update CLI commands to create `Cortex` at entry point
- Update MCP server to create `Cortex` at startup
- Pass context to all handlers

### Phase 3: Cleanup

- Remove direct `FilesystemRegistry` usage
- Deprecate and remove old patterns
- Update tests to use `Cortex.init()` with mock adapters

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Entry Points                                 │
│                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────────────┐   │
│  │       CLI           │         │        MCP Server           │   │
│  │                     │         │                             │   │
│  │ const cortex =      │         │ const cortex =              │   │
│  │   await Cortex      │         │   await Cortex              │   │
│  │   .fromConfig(...)  │         │   .fromConfig(...)          │   │
│  │                     │         │                             │   │
│  │ ctx = { cortex }    │         │ ctx = { cortex }            │   │
│  └─────────────────────┘         └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Cortex (Root Client)                         │
│                                                                      │
│  class Cortex {                                                      │
│      readonly rootDirectory: string;                                 │
│      readonly settings: CortexSettings;                              │
│      readonly registry: Registry;                                    │
│                                                                      │
│      static fromConfig(path): Promise<Result<Cortex, Error>>        │
│      static init(options): Cortex                                   │
│                                                                      │
│      initialize(): Promise<Result<void, Error>>                     │
│      getStore(name): Result<ScopedStorageAdapter, Error>            │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Handler Context                                  │
│                                                                      │
│  interface CortexContext {                                          │
│      cortex: Cortex;                                                │
│      // Future: logger, user, request...                            │
│  }                                                                   │
│                                                                      │
│  // CLI Handler                      // MCP Tool                    │
│  handleAdd(ctx, args, opts)          toolHandler(ctx, input)        │
│      ctx.cortex.getStore(...)            ctx.cortex.getStore(...)   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Storage Layer                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ScopedStorageAdapter                                         │   │
│  │   memories: MemoryStorage                                    │   │
│  │   indexes: IndexStorage                                      │   │
│  │   categories: CategoryStorage                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│         ┌────────────────────┴────────────────────┐                 │
│         ▼                                         ▼                 │
│  ┌──────────────────┐                  ┌──────────────────┐         │
│  │Filesystem Adapter│                  │   Mock Adapter   │         │
│  │   (production)   │                  │    (testing)     │         │
│  └──────────────────┘                  └──────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- [Registry Brainstorm (2026-01-29)](.context/registry-brainstorm.md) - Original Registry pattern design
- [Todo: Review Registry Implementation](cortex:todo/review-registry-implementation) - Audit task that prompted this session
- [Todo: Decrease MCP FS Coupling](cortex:todo/decrease-mcp-fs-coupling) - Related decoupling work

---

## Next Steps

1. Create OpenSpec proposal for this change
2. Define `CortexSettings` schema and validation
3. Implement `Cortex` class with both factories
4. Update CLI entry point to create `Cortex` and pass context
5. Update MCP server startup to create `Cortex` and pass context
6. Migrate handlers one by one to use `CortexContext`
7. Remove `FilesystemRegistry` direct usage
8. Update tests to use `Cortex.init()` with mock adapters
