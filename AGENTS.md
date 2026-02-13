# Cortex

Hierarchical memory system for AI coding agents. Provides persistent, structured storage that agents use to maintain context across sessions.

## Project information

- **Repository**: https://github.com/yeseh/cortex
- **License**: MIT
- **Runtime**: Bun (v1.3.6+) — no Node.js-specific APIs
- **Language**: TypeScript 5.x (strict mode, ESM)
- **Test framework**: Bun test (`bun test`)
- **Build**: `tsc` per package + `bun build --compile` for binaries
- **Linter**: ESLint 9.x (flat config) with `@typescript-eslint` and `@stylistic/eslint-plugin`
- **Formatter**: Prettier
- **Package manager**: Bun workspaces
- **Versioning**: Changesets (fixed versioning — all packages share a version)

Use the `gh` CLI tool to interact with the repository, issues, pull requests, and CI/CD workflows.

## Monorepo structure

```
packages/
├── core/          # @yeseh/cortex-core — domain logic, types, validation
├── storage-fs/    # @yeseh/cortex-storage-fs — filesystem storage adapter
├── cli/           # @yeseh/cortex-cli — command-line interface (Commander.js)
└── server/        # @yeseh/cortex-server — MCP server (Model Context Protocol)
```

**Dependency graph**: `core ← storage-fs ← cli` and `core ← storage-fs ← server`

### Key scripts

| Script            | Command                                    | Purpose                         |
| ----------------- | ------------------------------------------ | ------------------------------- |
| `build`           | `bun run --filter '*' build`               | TypeScript compile all packages |
| `test`            | `bun test packages`                        | Run all tests                   |
| `test:core`       | `bun test packages/core`                   | Core tests only                 |
| `test:cli`        | `bun test packages/cli`                    | CLI tests only                  |
| `test:server`     | `bun test packages/server`                 | Server tests only               |
| `test:storage-fs` | `bun test packages/storage-fs`             | Storage tests only              |
| `lint`            | `bunx eslint packages/*/src/**/*.ts --fix` | Lint + autofix                  |
| `typecheck`       | `bunx tsc --build`                         | Full type check                 |
| `compile:mcp`     | `bun build --compile ...`                  | Standalone MCP binary           |
| `compile:cli`     | `bun build --compile ...`                  | Standalone CLI binary           |

### CI/CD workflows (`.github/workflows/`)

- **core.yml** — Lint → Type Check → Test → Build (triggers on `packages/core/**`, `packages/storage-fs/**`)
- **cli.yml** — Lint → Type Check → Test → Build + upload artifact
- **mcp-server.yml** — Lint → Type Check → Test → Build + upload artifact
- **release.yml** — Tag `v*` or manual dispatch → Build & Test → Publish via Changesets

All workflows run on `ubuntu-latest` with `oven-sh/setup-bun@v2`.

## Architecture

Cortex follows **ports and adapters** (hexagonal) architecture.

### Core principles

1. **Thin entrypoints**: Server (MCP) and CLI are thin wrappers — business logic belongs in core
2. **Abstract interfaces**: Core defines ports (interfaces); storage-fs provides adapters (implementations)
3. **Result types**: All fallible operations return `Result<T, E>` — never throw
4. **Interface segregation**: Storage is split into `MemoryStorage`, `IndexStorage`, `CategoryStorage`, `StoreStorage` composed via `ScopedStorageAdapter`
5. **Registry as factory**: `Registry.getStore(name)` returns a `ScopedStorageAdapter`

### Module file structure

```
src/{module}/
├── index.ts           # Barrel exports (selective, explicit)
├── types.ts           # Port interface, error codes, result types
├── operations.ts      # Pure business logic (storage port as first param)
└── operations.spec.ts # Tests with mock factory
```

When `operations.ts` exceeds ~500 lines, split into named files (`create.ts`, `delete.ts`, etc.) with colocated `*.spec.ts` files.

### Type conventions

- Use `type` for data structures, error types, result types, and unions
- Use `interface` for contracts/ports meant to be implemented
- Use discriminated union error codes (e.g., `MemoryErrorCode`, `CategoryErrorCode`)
- Error messages MUST include actionable guidance for the caller

### Function signatures

```typescript
// Business logic: storage port always first
export const operationName = async (
    storage: StoragePort,
    ...params: T[]
): Promise<Result<OperationResult, DomainError>> => { ... };

// Pure helpers: no storage, synchronous
export const isRootCategory = (path: string): boolean => { ... };
```

### Naming conventions

- No "Port" suffix on interface names — use `CategoryStorage` not `CategoryStoragePort`
- With composition, simplify method names: `adapter.memories.read(path)` not `adapter.memories.readMemoryFile(path)`
- Optional arrays default to `[]`, never `undefined`
- No boolean flag arguments — prefer nullable fields, distinct methods, or enums

### Memory file format

Files use YAML frontmatter with **snake_case** keys, internal API uses **camelCase**:

```yaml
---
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
tags: [example, test]
source: user
expires_at: 2024-12-31T23:59:59.000Z # optional
---
Memory content here.
```

### Documentation

Every exported function MUST have JSDoc with `@module`, `@param`, `@returns`, `@example`, and edge case documentation.

## Rules

1. **Preexisting failing tests MUST be fixed before implementing new features.** Do not proceed with proposals or archiving until the test suite is green. If tests fail, dispatch a subagent to fix them before continuing.
2. **Storage adapters handle persistence only** — coordination logic (e.g., updating indexes after writes) belongs in the business layer.
3. **Cross-platform paths**: Always use `node:path` (`join`, `resolve`, `isAbsolute`) and `node:os` (`homedir`, `tmpdir`). Never hardcode slashes.

## Testing

- **Files**: Colocated `*.spec.ts` next to source
- **Naming**: `describe` per function, `it("should {expected behavior}")`
- **Both paths**: Test success and error cases, including edge cases
- **Isolation**: NEVER use global module mocking (`mock.module()`). Use real temp directories via `mkdtemp()` with cleanup in `afterEach`.
- **Mock factory**: Create factory functions returning mock port implementations with `Partial<T>` overrides.
- **Result assertions**:
    ```typescript
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('expected');
    if (!result.ok) expect(result.error.code).toBe('ERROR_CODE');
    ```

## Entrypoint patterns

### CLI commands

Commands use dependency injection for testability:

```typescript
export interface HandlerDeps {
    stdout?: NodeJS.WritableStream;
    stdin?: NodeJS.ReadableStream;
    now?: Date;
    adapter?: ScopedStorageAdapter;
}

export async function handleCommand(
    arg: string, options: CommandOptions,
    storeName: string | undefined, deps: HandlerDeps = {}
): Promise<void> { ... }
```

Use `mapCoreError()` to translate domain errors to Commander exceptions (`InvalidArgumentError` for input errors, `CommanderError` for system errors).

### MCP tools

Follow the thin wrapper pattern with Zod validation:

```typescript
server.tool('cortex_tool_name', 'Description', inputSchema.shape, async (input) => {
    const parsed = parseInput(schema, input);
    return handler(ctx, parsed);
});
```

MCP tools must NOT contain business logic, directly call filesystem operations, or duplicate core logic.

## Conventional commits

Format: `<type>(<scope>): <description>`

**Scopes:**

- `core` — core domain logic
- `mcp` — MCP server
- `cli` — command-line interface
- `storage-fs` — filesystem storage adapter

**Types:** `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

Example: `feat(core): add new caching mechanism for improved performance`

## Using memory

When interacting with the memory system use `cortex` as the project store.
Start every session by retrieving the most recent memories from the `cortex` store to build context, and save new memories back to it as you work.

### Memory stores

| Store     | Path                               | Purpose                                              |
| --------- | ---------------------------------- | ---------------------------------------------------- |
| `cortex`  | `.cortex/memory` (project-local)   | Project knowledge: standards, decisions, maps, todos |
| `default` | `~/.config/cortex/memory` (global) | User identity, preferences, cross-project knowledge  |

### Category conventions

| Category            | Store     | Purpose                                       |
| ------------------- | --------- | --------------------------------------------- |
| `human/profile`     | `default` | User identity                                 |
| `human/preferences` | `default` | Coding style, workflow preferences            |
| `standards/`        | `cortex`  | Architecture decisions, coding standards      |
| `decisions/`        | `cortex`  | Specific development decisions with rationale |
| `map/`              | `cortex`  | Codebase maps (package overviews, file lists) |
| `runbooks/`         | `cortex`  | Debugging and operational procedures          |
| `todo/`             | `cortex`  | Outstanding work items                        |
| `features/`         | `cortex`  | Planned or in-progress feature descriptions   |
| `investigations/`   | `cortex`  | Temporary research (set expiration)           |
| `standup/`          | `cortex`  | Daily standup summaries (7-day expiry)        |

### Store resolution order

1. Explicit: `--store` flag / `store` parameter
2. Local: `.cortex/memory` in current working directory
3. Global: `~/.config/cortex/memory`

### Expiration policy

- **Session context / standups**: 1–7 days
- **Sprint notes**: 2–4 weeks
- **Experiments / investigations**: 1–2 weeks
- **Never expires**: Architecture decisions, user preferences, coding standards, runbooks

<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
