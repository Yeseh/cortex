## Context

The CLI and MCP Server currently have direct dependencies on `FilesystemStorageAdapter`. This creates coupling that prevents:

- Easy testing with mock storage
- Future storage backends (SQLite, remote APIs)
- Clean package boundaries in monorepo

This design document outlines how to abstract storage through dependency injection.

## Goals / Non-Goals

**Goals:**

- Remove direct `FilesystemStorageAdapter` imports from CLI and Server
- Provide clean factory interface for creating storage adapters
- Maintain backward compatibility (default behavior unchanged)
- Enable future storage backend implementations

**Non-Goals:**

- Implement alternative storage backends (separate proposals)
- Change storage interface contracts
- Modify how storage adapters work internally

## Decisions

### Factory Pattern vs Service Locator

- **Decision**: Use Factory pattern with explicit injection
- **Alternatives**:
    - Service Locator - Hidden dependency, harder to test
    - Constructor injection everywhere - Too invasive for current architecture
- **Rationale**: Factory is explicit, testable, and minimally invasive

### Factory Interface Location

- **Decision**: Define `StorageFactory` in `core/storage/adapter.ts`
- **Alternatives**:
    - Separate `core/storage/factory.ts` file
    - In storage-fs package
- **Rationale**: Core owns interfaces, keeps related code together

### Default Factory Behavior

- **Decision**: CLI and Server provide default filesystem factory if none injected
- **Alternatives**:
    - Require explicit factory always
    - Configuration file determines factory
- **Rationale**: Zero config for common case, opt-in for advanced use

### Factory Scope

- **Decision**: Factory creates adapter per-store (stateless factory)
- **Alternatives**:
    - Factory caches adapters
    - Single adapter for all stores
- **Rationale**: Matches current behavior, simple and predictable

## Interface Design

```typescript
// core/storage/adapter.ts
export interface StorageFactory {
    /**
     * Creates a storage adapter for the given store root directory.
     *
     * @param storeRoot - Absolute path to the store root directory
     * @returns Configured storage adapter instance
     */
    createAdapter(storeRoot: string): StorageAdapter;
}
```

```typescript
// storage-fs/index.ts
export class FilesystemStorageFactory implements StorageFactory {
    createAdapter(storeRoot: string): StorageAdapter {
        return new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    }
}

export const defaultStorageFactory = new FilesystemStorageFactory();
```

## CLI Integration

```typescript
// cli/context.ts
export interface CLIContext {
    storeRoot: string;
    storeName?: string;
    storageFactory: StorageFactory;
}

// Default factory provider
import { defaultStorageFactory } from '@yeseh/cortex-storage-fs';

export const createCLIContext = (
    options: CLIContextOptions,
    factory: StorageFactory = defaultStorageFactory
): CLIContext => {
    // ... resolution logic
    return { storeRoot, storeName, storageFactory: factory };
};
```

```typescript
// cli/commands/memory/add/command.ts
export const addMemory = async (context: CLIContext, options: AddOptions) => {
    const adapter = context.storageFactory.createAdapter(context.storeRoot);
    // ... use adapter
};
```

## Server Integration

```typescript
// server/config.ts
export interface ServerConfig {
    // ... existing fields
    storageFactory?: StorageFactory;
}

// server/index.ts
import { defaultStorageFactory } from '@yeseh/cortex-storage-fs';

const createServer = (config: ServerConfig) => {
    const factory = config.storageFactory ?? defaultStorageFactory;
    // Pass factory to tool handlers
};
```

## Migration Path

1. Add `StorageFactory` interface to core
2. Add `FilesystemStorageFactory` to storage-fs
3. Update CLI commands one at a time (parallel safe)
4. Update Server tools
5. Update tests to use mock factory where appropriate
6. Remove direct `FilesystemStorageAdapter` imports

Each step is independently deployable - no big-bang migration required.

## Risks / Trade-offs

| Risk                 | Mitigation                                     |
| -------------------- | ---------------------------------------------- |
| Factory overhead     | Negligible - one object creation per operation |
| API surface increase | Minimal - single interface with one method     |
| Learning curve       | Document factory pattern usage clearly         |

## Testing Strategy

```typescript
// tests/mocks/storage.ts
export class MockStorageFactory implements StorageFactory {
    public calls: string[] = [];
    public mockAdapter: StorageAdapter;

    constructor(mockAdapter: StorageAdapter) {
        this.mockAdapter = mockAdapter;
    }

    createAdapter(storeRoot: string): StorageAdapter {
        this.calls.push(storeRoot);
        return this.mockAdapter;
    }
}
```

Unit tests inject `MockStorageFactory`, integration tests use `FilesystemStorageFactory`.

## Open Questions

- [ ] Should factory accept additional options beyond storeRoot?
- [ ] Should we add async `createAdapter` for future remote backends?
