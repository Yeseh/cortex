# Tasks: Migrate to Cortex client

## 1. CortexContext Pattern

- [ ] 1.1 Define `CortexContext` interface in core
- [ ] 1.2 Export `CortexContext` from core package

## 2. CLI Migration

- [ ] 2.1 Create `Cortex` instance at CLI entry point (`packages/cli/src/index.ts`)
- [ ] 2.2 Define CLI-specific context and pass to command handlers
- [ ] 2.3 Update `handleAdd` to accept `CortexContext` as first parameter
- [ ] 2.4 Update `handleShow` to accept `CortexContext` as first parameter
- [ ] 2.5 Update `handleUpdate` to accept `CortexContext` as first parameter
- [ ] 2.6 Update `handleRemove` to accept `CortexContext` as first parameter
- [ ] 2.7 Update `handleMove` to accept `CortexContext` as first parameter
- [ ] 2.8 Update `handleList` to accept `CortexContext` as first parameter
- [ ] 2.9 Update store command handlers to use `CortexContext`
- [ ] 2.10 Update `handleInit` to use `Cortex.init()` and `initialize()`
- [ ] 2.11 Remove direct `FilesystemRegistry` instantiation from `context.ts`
- [ ] 2.12 Update CLI tests to use `Cortex.init()` with mock adapters

## 3. MCP Server Migration

- [ ] 3.1 Create `Cortex` instance at server startup
- [ ] 3.2 Create `CortexContext` and pass to tool handlers
- [ ] 3.3 Update `resolveStoreAdapter` in `shared.ts` to use context
- [ ] 3.4 Update memory tool handlers to use `CortexContext`
- [ ] 3.5 Update store tool handlers to use `CortexContext`
- [ ] 3.6 Update category tool handlers to use `CortexContext`
- [ ] 3.7 Update health endpoint to use `CortexContext`
- [ ] 3.8 Remove direct `FilesystemRegistry` instantiation
- [ ] 3.9 Update server tests to use `Cortex.init()` with mock adapters

## 4. Cleanup

- [ ] 4.1 Remove `FilesystemRegistry` class from `packages/storage-fs`
- [ ] 4.2 Update storage-fs exports
- [ ] 4.3 Create migration guide documentation
- [ ] 4.4 Update AGENTS.md with new patterns

## 5. Validation

- [ ] 5.1 Run `bun test` - all tests pass
- [ ] 5.2 Run `bun run lint` - no errors
- [ ] 5.3 Run `bun run typecheck` - no errors
- [ ] 5.4 Manual test: CLI commands work with new context
- [ ] 5.5 Manual test: MCP server starts and responds to tools
