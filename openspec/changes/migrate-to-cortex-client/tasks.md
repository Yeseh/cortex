# Tasks: Migrate to Cortex client

## 1. CortexContext Pattern

- [x] 1.1 Define `CortexContext` interface in core
- [x] 1.2 Export `CortexContext` from core package

## 2. CLI Migration

- [x] 2.1 Create `Cortex` instance at CLI entry point (`packages/cli/src/index.ts`)
- [x] 2.2 Define CLI-specific context and pass to command handlers
- [x] 2.3 Update `handleAdd` to accept `CortexContext` as first parameter
- [x] 2.4 Update `handleShow` to accept `CortexContext` as first parameter
- [x] 2.5 Update `handleUpdate` to accept `CortexContext` as first parameter
- [x] 2.6 Update `handleRemove` to accept `CortexContext` as first parameter
- [x] 2.7 Update `handleMove` to accept `CortexContext` as first parameter
- [x] 2.8 Update `handleList` to accept `CortexContext` as first parameter
- [x] 2.9 Update store command handlers to use `CortexContext`
- [x] 2.10 Update `handleInit` to use `Cortex.init()` and `initialize()`
- [x] 2.11 Remove direct `FilesystemRegistry` instantiation from `context.ts`
- [x] 2.12 Update CLI tests to use `Cortex.init()` with mock adapters

## 3. MCP Server Migration

- [x] 3.1 Create `Cortex` instance at server startup
- [x] 3.2 Create `CortexContext` and pass to tool handlers
- [x] 3.3 Update `resolveStoreAdapter` in `shared.ts` to use context
- [x] 3.4 Update memory tool handlers to use `CortexContext`
- [x] 3.5 Update store tool handlers to use `CortexContext`
- [x] 3.6 Update category tool handlers to use `CortexContext`
- [x] 3.7 Update health endpoint to use `CortexContext`
- [x] 3.8 Remove direct `FilesystemRegistry` instantiation
- [x] 3.9 Update server tests to use `Cortex.init()` with mock adapters

## 4. Cleanup (Deferred)

> **Note**: `FilesystemRegistry` cannot be fully removed yet because it provides
> mutable operations (`load()`, `save()`) for store management commands (add/remove
> stores). The `Cortex` class is currently read-only after initialization.
> 
> A follow-up proposal should add `addStore()` and `removeStore()` methods to
> `Cortex` before `FilesystemRegistry` can be removed.

- [x] ~~4.1 Remove `FilesystemRegistry` class from `packages/storage-fs`~~ (deferred)
- [x] ~~4.2 Update storage-fs exports~~ (deferred)
- [ ] 4.3 Create migration guide documentation
- [ ] 4.4 Update AGENTS.md with new patterns

## 5. Validation

- [x] 5.1 Run `bun test` - all tests pass
- [x] 5.2 Run `bun run lint` - no errors
- [x] 5.3 Run `bun run typecheck` - no errors
- [ ] 5.4 Manual test: CLI commands work with new context
- [ ] 5.5 Manual test: MCP server starts and responds to tools
