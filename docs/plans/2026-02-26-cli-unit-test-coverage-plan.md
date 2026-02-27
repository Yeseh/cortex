# CLI Unit Test Coverage Plan (Colocated Specs + Shared Helpers)

**Goal:** Add comprehensive unit tests for all CLI module logic with colocated `*.spec.ts` files, while centralizing reusable mocks and common test operations in a single `test-helpers.spec.ts` module.

**Scope:** `packages/cli/src/**`

**Primary constraints:**
- Every implementation file under `packages/cli/src` that contains logic must have a colocated spec file path `*.spec.ts`.
- Common operations, mock factories, and reusable assertions must be extracted into `packages/cli/src/test-helpers.spec.ts`.
- Follow existing Bun test conventions and strict TypeScript settings.
- Per project rules, fix preexisting CLI test failures before adding net-new tests.

---

## 1) Baseline and guardrails

1. Run CLI tests first and ensure baseline status is known:
   - `bun test packages/cli`
2. If tests are failing before new work, fix those failures first.
3. During implementation, run tests in layers:
   - targeted single spec
   - command-group subset
   - full CLI package test run

**Exit criteria:** baseline failures are either resolved or explicitly documented before adding new coverage.

---

## 2) Shared helper module design

Create:
- `packages/cli/src/test-helpers.spec.ts`

Put all reusable testing primitives here (no command-specific business logic):

### 2.1 Result helpers
- `okResult<T>(value: T)` and `errResult<E>(error: E)` wrappers matching core Result-like shape used by handlers.

### 2.2 Stream and output helpers
- `createWritableCapture()` to collect writes from handlers.
- `createReadableFromText(text: string, opts?)` for stdin/file-content simulation.

### 2.3 Clock helpers
- `fixedNow(iso: string): () => Date`
- `FIXED_NOW` constants for deterministic expiration checks.

### 2.4 CLI error assertion helpers
- `expectInvalidArgumentError(fn, messagePart?)`
- `expectCommanderError(fn, code?, messagePart?)`

### 2.5 Context + Cortex mock factories
- `createMockContext(overrides?)`
- `createMockCortex(overrides?)`
- `createMockStoreClient(overrides?)`
- `createMockCategoryClient(overrides?)`
- `createMockMemoryClient(overrides?)`

Factories should use `Partial<T>` overrides and return complete objects used by command handlers.

### 2.6 Serialization helpers
- small fixture builders for memory/store payloads used repeatedly in output assertions.

**Exit criteria:** other spec files import helpers from `test-helpers.spec.ts` instead of duplicating mocks/utilities.

---

## 3) Required colocated spec files

Add these files (colocated with implementations):

### Root CLI modules
- `packages/cli/src/create-cli-command.spec.ts`
- `packages/cli/src/program.spec.ts`
- `packages/cli/src/run.spec.ts`
- `packages/cli/src/input.spec.ts`
- `packages/cli/src/output.spec.ts`
- `packages/cli/src/errors.spec.ts`
- `packages/cli/src/paths.spec.ts`
- `packages/cli/src/context.spec.ts`
- `packages/cli/src/toon.spec.ts`

### Command groups and shared command logic
- `packages/cli/src/memory/index.spec.ts`
- `packages/cli/src/memory/parsing.spec.ts`
- `packages/cli/src/store/index.spec.ts`
- `packages/cli/src/commands/init.spec.ts`
- `packages/cli/src/utils/git.spec.ts`

### Memory commands
- `packages/cli/src/memory/commands/add.spec.ts`
- `packages/cli/src/memory/commands/show.spec.ts`
- `packages/cli/src/memory/commands/update.spec.ts`
- `packages/cli/src/memory/commands/remove.spec.ts`
- `packages/cli/src/memory/commands/move.spec.ts`
- `packages/cli/src/memory/commands/list.spec.ts`

### Store commands
- `packages/cli/src/store/commands/add.spec.ts`
- `packages/cli/src/store/commands/remove.spec.ts`
- `packages/cli/src/store/commands/list.spec.ts`
- `packages/cli/src/store/commands/init.spec.ts`
- `packages/cli/src/store/commands/prune.spec.ts`
- `packages/cli/src/store/commands/reindexs.spec.ts`

---

## 4) Test matrix by module

## 4.1 `input.ts`
- resolves content from `--content`
- resolves content from `--file`
- resolves content from stdin only when `stdinRequested: true`
- rejects multiple sources
- handles empty/invalid file path
- maps file read failures

## 4.2 `output.ts`
- successful serialization for yaml/json/toon
- invalid format mapping to `INVALID_FORMAT`
- non-format serialization failures mapped to `SERIALIZE_FAILED`

## 4.3 `errors.ts`
- argument error codes throw `InvalidArgumentError`
- non-argument codes throw `CommanderError` with code/message

## 4.4 `paths.ts` + `context.ts`
- absolute detection (unix/windows/UNC)
- `~` expansion
- relative path resolution against cwd
- default config/store path generation

## 4.5 `create-cli-command.ts`
- `validateStorePath` accepts absolute and rejects relative
- context creation success path (config init + context shape)
- adapter factory: store not found, invalid kind, missing path, filesystem success

## 4.6 `program.ts` + `run.ts`
- program metadata and command registration
- `runProgram` success path
- `runProgram` unexpected error sets exit code and logs message
- `run.ts` delegates to `runProgram`

## 4.7 `memory/parsing.ts`
- tags parsing (comma-separated/repeated/trim/dedupe behavior as implemented)
- expires parsing valid/invalid handling

## 4.8 `utils/git.ts` + `store/index.ts` (`resolveStoreName`)
- git command success/failure
- explicit name precedence
- git-derived normalization
- folder-name fallback
- final error requiring `--name`

## 4.9 `toon.ts`
- primitive encoding
- quoting conditions
- nested objects with/without key folding
- uniform array tabular encoding
- non-uniform arrays fallback behavior
- custom delimiter behavior

## 4.10 Memory command handlers
For each handler (`add`, `show`, `update`, `remove`, `move`, `list`):
- successful execution and expected stdout
- store resolution failure path
- root/category/memory client failure path
- validation failures (path, arguments, content)
- option semantics (`includeExpired`, `format`, citations, expiry flags)

## 4.11 Store command handlers
For each handler (`add`, `remove`, `list`, `init`, `prune`, `reindexs`):
- successful execution and expected stdout/serialization
- invalid input and duplicate/missing store cases
- config read/parse/write failures where applicable
- dry-run vs real prune output behavior
- default store fallback and explicit store behavior

## 4.12 Command wiring (`memory/index.ts`, `store/index.ts`, `commands/init.ts`)
- expected subcommands are registered
- inherited options are present
- action path propagates context errors through CLI error mapping

---

## 5) Execution order

1. `test-helpers.spec.ts`
2. utility specs (`input/output/errors/paths/context/parsing`)
3. command-group/wiring specs (`memory/index`, `store/index`, `program`, `run`, `commands/init`)
4. memory command handler specs
5. store command handler specs
6. `toon.spec.ts` and remaining edge coverage
7. final full CLI test run and cleanup

---

## 6) Quality bar and acceptance criteria

All items below must be true before handoff completion:

- Every logic-bearing `packages/cli/src/**/*.ts` file has a colocated `*.spec.ts`, except pure barrel files with zero behavior.
- Reusable mocks/ops are centralized in `packages/cli/src/test-helpers.spec.ts`.
- Tests are deterministic (fixed time and controlled streams).
- No global module mocking pattern prohibited by project guidance.
- `bun test packages/cli` passes.

Optional but recommended:
- Run `bunx tsc --build` if test edits introduce typing risk.

---

## 7) Handoff notes for next agent

- Prioritize behavior-level assertions over snapshot-heavy tests.
- Keep command action wiring tests minimal; focus depth on exported handlers.
- If touching difficult-to-mock internals (e.g., Bun file APIs), add small seams only when necessary and keep them minimal/surgical.
- If a preexisting bug blocks tests, fix the bug first, then continue coverage work in the same branch.
