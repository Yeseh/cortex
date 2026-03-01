# Cortex

Hierarchical memory system for AI coding agents. Provides persistent, structured storage that agents use to maintain context across sessions.

## Project information

- **Repository**: https://github.com/yeseh/cortex
- **Runtime**: Bun (v1.3.6+) — no Node.js-specific APIs
- **Language**: TypeScript 5.x (strict mode, ESM)
- **Test framework**: Bun test (`bun test`)
- **Build**: `tsc` per package + `bun build --compile` for binaries
- **Linter**: ESLint 9.x (flat config) with `@typescript-eslint` and `@stylistic/eslint-plugin`
- **Formatter**: Prettier
- **Package manager**: Bun workspaces
- **Versioning**: Changesets (fixed versioning — all packages share a version)

Use the `gh` CLI tool to interact with the repository, issues, pull requests, and CI/CD workflows.

## Architecture

Cortex follows **ports and adapters** (hexagonal) architecture.

### Core principles

1. **Thin entrypoints**: Server (MCP) and CLI are thin wrappers — business logic belongs in core
2. **Abstract interfaces**: Core defines ports (interfaces); storage-fs provides adapters (implementations)
3. **Result types**: All fallible operations return `Result<T, E>` — never throw
4. **Interface segregation**: Storage is split into `MemoryStorage`, `IndexStorage`, `CategoryStorage`, `StoreStorage` composed via `ScopedStorageAdapter`

### Type conventions

- Use `type` for data structures, error types, result types, and unions
- Use `interface` for contracts/ports meant to be implemented
- Use discriminated union error codes (e.g., `MemoryErrorCode`, `CategoryErrorCode`)
- Error messages MUST include actionable guidance for the caller

### Naming conventions

- No "Port" suffix on interface names — use `CategoryStorage` not `CategoryStoragePort`
- With composition, simplify method names: `adapter.memories.read(path)` not `adapter.memories.readMemoryFile(path)`
- Optional arrays default to `[]`, never `undefined`
- No boolean flag arguments — prefer nullable fields, distinct methods, or enums

## Rules

1. **Preexisting failing tests MUST be fixed before implementing new features.** Do not proceed with proposals or archiving until the test suite is green. If tests fail, dispatch a subagent to fix them before continuing.
2. **Storage adapters handle persistence only** — coordination logic (e.g., updating indexes after writes) belongs in the business layer.
3. **Cross-platform paths**: Always use `node:path` (`join`, `resolve`, `isAbsolute`) and `node:os` (`homedir`, `tmpdir`). Never hardcode slashes.

## Testing

- **Both paths**: Test success and error cases, including edge cases
- **Isolation**: NEVER use global module mocking (`mock.module()`). Use real temp directories via `mkdtemp()` with cleanup in `afterEach`.
- **Mock factory**: Create factory functions returning mock port implementations with `Partial<T>` overrides.
- **Result assertions**:
    ```typescript
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('expected');
    if (!result.ok) expect(result.error.code).toBe('ERROR_CODE');
    ```

## Conventional commits

Format: `<type>(<scope>): <description>`

**Scopes:**

- `core` — core domain logic
- `skill` — Updates to skill prompts
- `mcp` — MCP server
- `cli` — command-line interface
- `storage-fs` — filesystem storage adapter

**Types:** `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

Example: `feat(core): add new caching mechanism for improved performance`

## Creating PRs
When creating PRs, use the labels specified in `.github/release.yaml` when creating pull requests to ensure changes are automatically included in release notes.

## Using memory

When interacting with the memory system use `cortex` as the project store. Use the `memory` skill for more information.

- Create new memories often
- Check for relevant memories often


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
