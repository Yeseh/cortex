# CLI Integration Test Plan (Direct Command Execution + Output Assertions)

**Goal:** Add integration tests for the CLI that execute real CLI commands directly and assert command output and exit behavior.

**Scope:** `packages/cli/tests/**` (new integration test suite under CLI module root)

**Primary requirements:**
- Tests must execute CLI commands directly (subprocess invocation of the CLI entrypoint).
- Tests must validate stdout/stderr and exit codes.
- Integration tests must live under `packages/cli/tests/`.

---

## 1) Directory and file layout

Create this structure:

- `packages/cli/tests/test-helpers.ts`
- `packages/cli/tests/fixtures/` (sample files used by `--file` scenarios)
- `packages/cli/tests/cli-basic.integration.spec.ts`
- `packages/cli/tests/cli-memory.integration.spec.ts`
- `packages/cli/tests/cli-store.integration.spec.ts`
- `packages/cli/tests/cli-output-formats.integration.spec.ts`
- `packages/cli/tests/cli-errors.integration.spec.ts`
- `packages/cli/tests/cli-workflow.integration.spec.ts`

Optional split (if suite grows):
- `packages/cli/tests/cli-memory-input.integration.spec.ts`
- `packages/cli/tests/cli-memory-lifecycle.integration.spec.ts`

---

## 2) Command execution strategy

Use a shared helper that runs the CLI as a real subprocess, for example via Bun spawn APIs:

- command target: `bun run packages/cli/src/run.ts <args...>` (from repo root), or
- command target: `bun run src/run.ts <args...>` (with cwd at `packages/cli`)

The helper should return:
- `exitCode`
- `stdout`
- `stderr`
- optionally merged output for easier assertions

Include options for:
- custom `cwd`
- custom env (especially isolated `HOME` and `XDG_CONFIG_HOME`)
- stdin text piping for `memory add` stdin cases
- timeout and debug logging on failure

---

## 3) Test isolation model

Each integration spec (or each test) should use a fresh temp workspace:

1. Create temp root via `mkdtemp()`.
2. Set isolated env:
   - `HOME=<tempHome>`
   - optional `XDG_CONFIG_HOME=<tempHome/.config>`
3. Initialize CLI state explicitly (`cortex init` or `store init` depending on scenario).
4. Run assertions.
5. Cleanup temp directories in `afterEach`/`afterAll`.

This avoids cross-test contamination from the developer’s real config.

---

## 4) Shared helper API (`packages/cli/tests/test-helpers.ts`)

Implement reusable integration helpers:

- `createIntegrationSandbox()`
  - returns `{ rootDir, homeDir, projectDir, env, cleanup }`
- `runCli(args: string[], options?)`
  - executes CLI command
  - supports `cwd`, `env`, `stdin`, `timeoutMs`
- `expectSuccess(result, containsText?)`
- `expectFailure(result, containsText?)`
- `readMemoryFile(storeRoot, relativePath)`
- `parseYamlOrJsonOutput(output)` for structured format checks

Keep helpers integration-focused (subprocess + filesystem), not unit-style mocks.

---

## 5) Integration scenarios and assertions

## 5.1 Basic CLI (`cli-basic.integration.spec.ts`)
- `--help` returns usage and exits 0
- `--version` returns version and exits 0
- `init` creates global config and reports success output
- repeated `init` without force fails with clear message

## 5.2 Memory lifecycle (`cli-memory.integration.spec.ts`)
- add memory with `--content`, assert success message
- show memory, assert content and metadata fields
- list category, assert created memory appears
- update memory content/tags/citations, assert update output and show result
- move memory path, assert old path unavailable and new path available
- remove memory, assert deletion output and not found behavior

## 5.3 Input modes (`cli-memory.integration.spec.ts` or split file)
- add from `--file` fixture and assert saved content
- add from stdin pipe and assert success
- conflict (`--content` + `--file`) returns failure with correct message
- update with no update fields fails with invalid args messaging

## 5.4 Store operations (`cli-store.integration.spec.ts`)
- `store init` creates `.cortex` store path and index files
- `store list` includes initialized store(s)
- `store add` registers external path and returns serialized result
- `store remove` unregisters store and confirms via `store list`
- `store reindex` success message
- `store prune --dry-run` and normal prune output shape

## 5.5 Output formats (`cli-output-formats.integration.spec.ts`)
- list/show/store list with `-o yaml`, `-o json`, `-o toon`
- assert valid parse for json outputs
- assert key markers for yaml/toon outputs
- invalid format falls back or errors according to current behavior (lock to observed behavior)

## 5.6 Error handling (`cli-errors.integration.spec.ts`)
- invalid memory path returns non-zero and argument error
- invalid expiration format returns non-zero with actionable message
- unknown store returns non-zero with store error
- missing required args returns usage + error

## 5.7 End-to-end workflow (`cli-workflow.integration.spec.ts`)
- full user journey:
  1) init/store setup
  2) add multiple memories
  3) list/show/update/move/remove
  4) final list verification
- assert both output text and resulting filesystem state

---

## 6) Output assertion policy

Each integration test should assert:

1. **Process-level behavior**
   - exit code
   - expected stderr presence/absence

2. **User-facing output**
   - essential success/error message text
   - structured output content for JSON mode

3. **Persistent state (where relevant)**
   - file exists/removed
   - command effects reflected by subsequent CLI commands

Avoid overfitting to exact whitespace or full serialized blobs; assert stable, meaningful fields.

---

## 7) Execution commands and CI fit

Preferred local execution commands:

- `bun test packages/cli/tests`
- `bun test packages/cli/tests/cli-memory.integration.spec.ts`

If needed, add package script in `packages/cli/package.json`:
- `"test:integration": "bun test tests"`

CI recommendation:
- run unit tests first
- then run integration suite
- fail fast on integration non-zero exits

---

## 8) Implementation order

1. Add `packages/cli/tests/test-helpers.ts` and sandbox runner.
2. Implement basic and error suites first (`cli-basic`, `cli-errors`).
3. Add memory lifecycle suite.
4. Add store and format suites.
5. Add full workflow suite last.
6. Run full integration suite and stabilize flaky tests.

---

## 9) Acceptance criteria

- Integration tests are located under `packages/cli/tests/`.
- Tests execute CLI commands directly through subprocess invocation.
- Tests assert exit codes and output text/structured content.
- Core command families (basic, memory, store, output formats, errors, workflow) are covered.
- `bun test packages/cli/tests` passes consistently in a clean environment.

---

## 10) Handoff notes for next agent

- Keep integration tests black-box: invoke CLI like a user and assert externally observable behavior.
- Use isolated HOME/config per test to avoid accidental mutation of real user data.
- Prefer multiple focused scenarios over one giant test except for the explicit workflow spec.
- If command text changes frequently, assert key phrases and semantic fields rather than full snapshots.
