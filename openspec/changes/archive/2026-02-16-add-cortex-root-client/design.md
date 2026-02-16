# Design: Cortex Root Client

## Context

The Cortex memory system currently uses `FilesystemRegistry` as the entry point for accessing stores. This class is instantiated directly in 10+ locations across CLI and Server packages, leading to:

- Duplicated boilerplate (`new FilesystemRegistry(path) → load() → getStore()`)
- Tight coupling to filesystem implementation
- Difficult to test (no mock injection)
- Separate config systems (`config.yaml` vs `stores.yaml`)

## Goals

1. Single root client object for the memory system
2. Session-scoped instance (one per CLI invocation / MCP server lifetime)
3. Unified configuration (settings + stores in one file)
4. Testable via dependency injection (mock adapter factory)
5. Clean separation between production and testing factories

## Non-Goals

- Local config discovery (`.cortex/config.yaml` merging) - deferred for MCP compatibility
- Request-scoped context additions (logger, user context) - future enhancement
- Alternative storage backends (SQLite registry) - separate proposal

## Decisions

### Decision: Rename Registry → Cortex

The `Registry` interface becomes the `Cortex` class, serving as the root client.

**Rationale**: The object now represents more than just a registry of stores - it's the main entry point for all Cortex operations, holding both settings and store definitions.

**Alternatives considered**:

- `CortexClient` - too verbose
- `CortexContext` - conflicts with handler context pattern
- Keep `Registry` - doesn't reflect expanded scope

### Decision: Merge config files

Combine `config.yaml` (settings) and `stores.yaml` (store definitions) into a single `config.yaml`:

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

**Rationale**: Reduces cognitive overhead of managing two config files. Settings and stores are closely related - both configure how Cortex behaves.

**Alternatives considered**:

- Keep separate files - more files to manage, separate concerns that aren't really separate
- Single flat structure - less organized, harder to parse

### Decision: Two factory methods

- `Cortex.fromConfig(path)` - async, reads from filesystem, fails if missing
- `Cortex.init(options)` - sync, no filesystem, options override defaults

**Rationale**: Production code uses `fromConfig()` for simplicity. Tests use `init()` for control. Clear separation of concerns.

**Alternatives considered**:

- Single factory with options - confusing API
- Constructor with async init - anti-pattern

### Decision: Absolute store paths only

Store paths in config must be absolute. No relative path resolution.

**Rationale**: Eliminates ambiguity about what paths are relative to. Absolute paths are explicit and unambiguous.

**Alternatives considered**:

- Relative to config directory - confusing for project-local stores
- Relative to cwd - varies based on where command is run
- Path markers (`cwd:`, `config:`) - adds complexity

### Decision: AdapterFactory for testing

`Cortex.init()` accepts optional `adapterFactory: (storePath: string) => ScopedStorageAdapter`.

**Rationale**: Enables injecting mock adapters without filesystem access. Default factory creates `FilesystemStorageAdapter`.

**Alternatives considered**:

- Separate `TestCortex` class - duplicates code
- Global mock injection - hard to isolate tests

### Decision: CortexContext for handlers

Handlers receive `CortexContext` as first parameter, containing `cortex: Cortex`.

**Rationale**: Extensible pattern - can add `logger`, `user`, etc. later. Consistent across CLI and MCP.

**Alternatives considered**:

- Pass Cortex directly - less extensible
- Multiple parameters - verbose signatures

## Risks / Trade-offs

### Breaking change: stores.yaml removal

**Risk**: Existing users have `stores.yaml` files that will be ignored.

**Mitigation**:

- Document migration steps clearly
- Consider CLI command to migrate: `cortex config migrate`
- Error message if `stores.yaml` exists without `stores:` in `config.yaml`

### Breaking change: FilesystemRegistry removal

**Risk**: External code depending on `FilesystemRegistry` will break.

**Mitigation**:

- `FilesystemRegistry` is not part of public API
- Internal package, not published separately
- Document in changelog

### Session-scoped caching

**Risk**: Config changes during session not reflected.

**Mitigation**:

- CLI invocations are short-lived - not an issue
- MCP server is long-running but config changes are rare
- Can add `reload()` method later if needed

## Migration Plan

### Phase 1: Add Cortex class (non-breaking)

- Create `Cortex` class alongside existing `FilesystemRegistry`
- Both coexist temporarily
- No changes to existing code paths

### Phase 2: Migrate handlers

- Update CLI commands to use `CortexContext`
- Update MCP tools to use `CortexContext`
- Tests updated to use `Cortex.init()`

### Phase 3: Remove old code

- Remove `FilesystemRegistry`
- Remove `stores.yaml` support
- Update documentation

### Rollback plan

- Revert to previous commit
- `stores.yaml` files preserved (not deleted by migration)

## Resolved Questions

1. **Config migration CLI**: No - users migrate manually by moving store definitions into `config.yaml`
2. **Deprecation period**: None - `stores.yaml` is no longer supported, clean break
3. **Environment variable override**: Yes - `CORTEX_CONFIG_PATH` overrides the default `~/.config/cortex` location
