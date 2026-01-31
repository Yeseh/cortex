# Change: Abstract Storage from CLI and Server

## Why

Currently, the CLI and MCP Server directly import and instantiate `FilesystemStorageAdapter`:

```typescript
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
```

This creates tight coupling between application layers (CLI/Server) and a specific storage implementation. Problems:

1. **Violates Dependency Inversion**: High-level modules depend on low-level implementation details
2. **Limits extensibility**: Cannot swap storage backends (e.g., SQLite, remote) without modifying CLI/Server
3. **Complicates testing**: Tests must use filesystem even when testing application logic
4. **Monorepo awkwardness**: CLI and Server packages must depend on `@yeseh/cortex-storage-fs` directly

The target architecture has CLI and Server depend only on `@yeseh/cortex-core` (ports/interfaces), receiving storage adapters through dependency injection or configuration.

## What Changes

**Add storage factory to core:**

- Create `StorageFactory` interface in core that creates `StorageAdapter` instances
- Factory receives configuration and returns appropriate adapter
- Default implementation provided by storage-fs package

**Update CLI for dependency injection:**

- CLI receives storage factory at initialization
- Commands use factory to create adapters instead of direct instantiation
- Default factory uses filesystem storage (maintains current behavior)

**Update Server for dependency injection:**

- Server receives storage factory in configuration
- MCP tools use factory to create adapters
- Default factory uses filesystem storage

**Configuration-based adapter selection:**

- Add `storageAdapter` config option (default: "filesystem")
- Future: Allow "sqlite", "remote", etc.

## Impact

- Affected specs: `storage-filesystem`, `mcp-server-core`
- Affected code:
    - `src/core/storage/adapter.ts` - Add StorageFactory interface
    - `src/cli/context.ts` - Add factory injection
    - `src/cli/commands/**/*.ts` - Use factory instead of direct instantiation
    - `src/server/index.ts` - Add factory injection
    - `src/server/memory/tools.ts` - Use factory
    - `src/server/category/tools.ts` - Use factory
- **NOT breaking for users**: Default behavior unchanged, internal refactoring only
