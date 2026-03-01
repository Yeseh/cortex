# Interactive Init Commands Implementation Plan

**Goal:** Add TTY-aware interactive prompts (via `@inquirer/prompts`) to both `cortex init` and `cortex store init`, asking users to confirm/change the resolved path and store name before writing anything to disk.

**Architecture:** Interactive mode activates automatically when `stdin` is a TTY (auto-detect, like git). In non-TTY environments (CI, pipes, scripts), commands behave exactly as today — no regression. Prompts live in a thin `prompt` layer injected via `CortexContext` (or a narrow `PromptFn` parameter) so handlers remain fully testable without spawning real terminals.

**Tech Stack:** `@inquirer/prompts` (ESM-first, Bun-compatible), Bun test, Commander.js

**Session Id:** ses_356b85babffevFoo0zd1E2l9X9

---

## Background & Key Decisions

### Why auto-detect TTY?

`process.stdin.isTTY` is `undefined` in pipes/CI and `true` in real terminals. This is the same heuristic git and npm use — no extra flags needed, no behavior change in automated contexts.

### Why NOT a `--interactive` flag?

Flags are additive noise. Developers already know that piped/scripted runs shouldn't get prompts; TTY detection achieves this for free.

### Inquirer injection pattern

`@inquirer/prompts` functions (`input`, `confirm`) are pure async functions. We pass them in as optional overrides on a `PromptDeps` object (defaulting to the real inquirer functions). Tests pass stub implementations that resolve immediately — no global module mocking required.

### Scope

- `packages/cli/src/commands/init.ts` — `cortex init`
    - Prompt 1: confirm/change global store **path** (default `~/.config/cortex/memory`)
    - Prompt 2: confirm/change global **store name** (default `global`)
- `packages/cli/src/store/commands/init.ts` — `cortex store init`
    - Prompt 1: confirm/change **store name** (default: git-detected or empty)
    - Prompt 2: confirm/change store **path** (default `.cortex` in cwd)

### Files touched

| File                                           | Change                                                   |
| ---------------------------------------------- | -------------------------------------------------------- |
| `packages/cli/package.json`                    | Add `@inquirer/prompts` dependency                       |
| `packages/cli/src/prompts.ts`                  | New: shared TTY detection + PromptDeps type              |
| `packages/cli/src/commands/init.ts`            | Add interactive path via `promptInitOptions()`           |
| `packages/cli/src/commands/init.spec.ts`       | Tests for interactive & non-interactive branches         |
| `packages/cli/src/store/commands/init.ts`      | Add interactive name/path via `promptStoreInitOptions()` |
| `packages/cli/src/store/commands/init.spec.ts` | Tests for interactive & non-interactive branches         |

---

## Tasks

### 1. Install dependency

- [ ] 1.1 Add `@inquirer/prompts` to `packages/cli/package.json` dependencies
- [ ] 1.2 Run `bun install` from the repo root to update lockfile
- [ ] 1.3 Verify `bun test packages/cli` still passes (no regressions)
- [ ] 1.4 Commit: `chore(cli): add @inquirer/prompts dependency`

---

### 2. Create shared prompts module

- [ ] 2.1 Write a failing test in a new file `packages/cli/src/prompts.spec.ts`:
    - `isTTY(stream)` returns `true` when `stream.isTTY === true`
    - `isTTY(stream)` returns `false` when `stream.isTTY` is `undefined` or `false`
    - `isTTY(undefined)` returns `false`
- [ ] 2.2 Run the test to confirm it fails: `bun test packages/cli/src/prompts.spec.ts`
- [ ] 2.3 Create `packages/cli/src/prompts.ts` with:

    ```typescript
    import { input, confirm } from '@inquirer/prompts';

    export type InputFn = (opts: { message: string; default?: string }) => Promise<string>;
    export type ConfirmFn = (opts: { message: string; default?: boolean }) => Promise<boolean>;

    export interface PromptDeps {
        input: InputFn;
        confirm: ConfirmFn;
    }

    export const defaultPromptDeps: PromptDeps = { input, confirm };

    export function isTTY(stream: NodeJS.ReadableStream | undefined): boolean {
        return (stream as NodeJS.ReadStream | undefined)?.isTTY === true;
    }
    ```

- [ ] 2.4 Run the test again to confirm it passes
- [ ] 2.5 Commit: `feat(cli): add shared prompts module with TTY detection`

---

### 3. Interactive `cortex init`

#### 3.1 Tests first

- [ ] 3.1.1 Open `packages/cli/src/commands/init.spec.ts`
- [ ] 3.1.2 Add a test group `describe('interactive mode')` with these cases:
    - **When stdin is a TTY and no flags given**: `handleInit` calls `promptDeps.input` twice (path, store name), uses the returned values, calls `saveStore` with the prompted store name
    - **When stdin is NOT a TTY**: `handleInit` does NOT call `promptDeps.input`, proceeds with defaults
    - **When `--name` and path are both given explicitly**: even if TTY, prompts are skipped (values already resolved)
    - **Prompted path is used**: `saveStore` receives the store name returned by `promptDeps.input`
- [ ] 3.1.3 Stub `promptDeps` in tests:
    ```typescript
    const promptDeps: PromptDeps = {
        input: mock(async ({ default: d }) => d ?? 'prompted-value'),
        confirm: mock(async () => true),
    };
    ```
    Mark stdin as TTY by assigning `(ctx.stdin as any).isTTY = true`
- [ ] 3.1.4 Run tests to confirm new tests fail: `bun test packages/cli/src/commands/init.spec.ts`

#### 3.2 Implementation

- [ ] 3.2.1 Add `PromptDeps` and optional `promptDeps?: PromptDeps` to `InitCommandOptions` (or as a separate last parameter)
- [ ] 3.2.2 Add a `promptInitOptions()` helper inside `init.ts`:

    ```typescript
    async function promptInitOptions(
        ctx: CortexContext,
        resolved: { storeName: string; storePath: string },
        promptDeps: PromptDeps
    ): Promise<{ storeName: string; storePath: string }> {
        if (!isTTY(ctx.stdin)) return resolved;

        const storePath = await promptDeps.input({
            message: 'Global store path:',
            default: resolved.storePath,
        });
        const storeName = await promptDeps.input({
            message: 'Global store name:',
            default: resolved.storeName,
        });
        return { storePath, storeName };
    }
    ```

- [ ] 3.2.3 Update `handleInit` to call `promptInitOptions()` after resolving defaults, before the `ensureNotInitialized` check
- [ ] 3.2.4 Thread the prompted `storeName` through to `saveStore` (currently hardcoded `'global'`)
- [ ] 3.2.5 Run tests: `bun test packages/cli/src/commands/init.spec.ts`
- [ ] 3.2.6 Fix any failures, then run full CLI suite: `bun test packages/cli`
- [ ] 3.2.7 Commit: `feat(cli): add interactive prompts to cortex init`

---

### 4. Interactive `cortex store init`

#### 4.1 Tests first

- [ ] 4.1.1 Open `packages/cli/src/store/commands/init.spec.ts`
- [ ] 4.1.2 Add `describe('interactive mode')` with cases:
    - **TTY + no `--name`**: prompts for store name; uses prompted value
    - **TTY + `--name` given**: skips name prompt, still prompts for path (or skips both if path also given)
    - **TTY + explicit path argument**: skips path prompt
    - **Non-TTY**: no prompts called at all
- [ ] 4.1.3 Run tests to confirm new tests fail: `bun test packages/cli/src/store/commands/init.spec.ts`

#### 4.2 Implementation

- [ ] 4.2.1 Add `promptDeps?: PromptDeps` to `InitCommandOptions` in `store/commands/init.ts`
- [ ] 4.2.2 Add a `promptStoreInitOptions()` helper:

    ```typescript
    async function promptStoreInitOptions(
        ctx: CortexContext,
        resolved: { storeName: string; storePath: string },
        explicit: { name?: string; path?: string },
        promptDeps: PromptDeps
    ): Promise<{ storeName: string; storePath: string }> {
        if (!isTTY(ctx.stdin)) return resolved;

        const storeName = explicit.name
            ? resolved.storeName
            : await promptDeps.input({ message: 'Store name:', default: resolved.storeName });

        const storePath = explicit.path
            ? resolved.storePath
            : await promptDeps.input({ message: 'Store path:', default: resolved.storePath });

        return { storeName, storePath };
    }
    ```

- [ ] 4.2.3 Update `handleInit` to call `promptStoreInitOptions()` after resolving `storeName` and `storePath`, before creating the store client
- [ ] 4.2.4 Run tests: `bun test packages/cli/src/store/commands/init.spec.ts`
- [ ] 4.2.5 Fix any failures, then run full CLI suite: `bun test packages/cli`
- [ ] 4.2.6 Commit: `feat(cli): add interactive prompts to cortex store init`

---

### 5. Spec delta (OpenSpec)

- [ ] 5.1 Create `openspec/changes/add-interactive-init/` directory with:
    - `proposal.md`
    - `tasks.md` (link to this plan)
    - `specs/cli-store/spec.md` with `## MODIFIED Requirements` for "Store Init Command" and "Global Init Command"
- [ ] 5.2 Run `openspec validate add-interactive-init --strict --no-interactive`
- [ ] 5.3 Fix any validation issues
- [ ] 5.4 Commit: `docs(cli): add openspec change for interactive init commands`

---

### 6. Final verification

- [ ] 6.1 Run `bun test packages/cli` — all tests pass
- [ ] 6.2 Run `bunx tsc --build` — no type errors
- [ ] 6.3 Run `bunx eslint packages/cli/src/**/*.ts --fix` — no lint errors
- [ ] 6.4 Manual smoke test: `bun run packages/cli/src/run.ts init` in a temp dir (should show prompts in a real terminal)
- [ ] 6.5 Manual smoke test: pipe to confirm non-interactive: `echo "" | bun run packages/cli/src/run.ts init --force` (should skip prompts)

---

## Testing Strategy

### What NOT to do

- Do NOT use `mock.module('@inquirer/prompts', ...)` — global module mocking is prohibited.
- Do NOT spawn real TTYs in tests.
- Do NOT call real `@inquirer/prompts` functions in tests (they block waiting for keyboard input).

### How to test interactive branches

Inject `promptDeps` as the last parameter of `handleInit`. Tests pass a stub:

```typescript
const promptDeps: PromptDeps = {
    input: mock(async ({ default: d }) => d ?? 'stubbed'),
    confirm: mock(async () => true),
};
```

Set TTY state on the context's stdin stream:

```typescript
(ctx.stdin as any).isTTY = true;
```

This makes `isTTY(ctx.stdin)` return `true` without touching the real terminal.

### Non-TTY path (existing tests)

Existing tests use `PassThrough` streams which have `isTTY = undefined`. They will continue to work without modification — the interactive branch simply won't execute.

---

## Gotchas & Edge Cases

1. **`@inquirer/prompts` is ESM-only** — matches the CLI package's `"type": "module"`. No additional config needed.
2. **Bun compatibility** — `@inquirer/prompts` v8+ works with Bun. Avoid v7 which had CJS/ESM dual-package issues.
3. **`ctx.stdin` vs `process.stdin`** — Always check `ctx.stdin` first (for testability), then fall back to `process.stdin` for TTY detection.
4. **Store name `'global'` is currently hardcoded** in `commands/init.ts` (`saveStore('global', ...)`) — threading the prompted name through requires touching `ensureNotInitialized` and `createGlobalStore` as well.
5. **`resolveStoreName` can throw** (when not in a git repo and no `--name` given) — the store init interactive flow should catch this and fall back to prompting for a name instead of erroring out.
