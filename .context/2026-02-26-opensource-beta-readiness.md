# Open-Source Beta Readiness Brainstorm

**Date:** 2026-02-26
**Goal:** Identify everything needed before letting colleagues beta-test Cortex as an open-source project.
**Primary audience:** Colleagues using Cortex as an MCP server plugged into their AI coding agents (Claude Desktop, OpenCode).

---

## Current State Assessment

### Build Health

- **Tests:** 921 pass, 16 fail (all MCP server integration tests)
- **TypeScript:** 16 compilation errors across `packages/server` and `packages/storage-fs`
- **Repo:** Private on GitHub, no LICENSE file, no open PRs
- **Working tree:** Uncommitted changes + 17 untracked files on `main`
- **Branches:** 20+ branches, many stale from completed work

### OpenSpec Changes

- `add-scoped-prune-reindex` — complete, needs archiving
- `add-category-mode-enforcement` — stale (0/19 tasks), to be archived
- `add-cli-category-bootstrapping` — deferred to post-1.0 (depends on category mode enforcement)
- `add-sqlite-index` — post-1.0, kept as-is

---

## High Priority (Beta Blockers)

### 1. Fix TypeScript Compilation Errors

16 errors across `packages/server` and `packages/storage-fs`:

- Missing exports (`McpToolResponse`, `CategoryDefinition`, `configStoreToStore`)
- Type mismatches in `config-adapter.ts` (`CONFIG_WRITE_FAILED` not in `ConfigErrorCode`)
- Parameter type incompatibilities in `FilesystemConfigAdapter.getStore()`
- Unused variable warnings treated as errors

### 2. Fix 16 Failing MCP Server Integration Tests

All failures trace to the same root cause: `TypeError: null is not an object (evaluating 'store?.value.categoryMode')` in `packages/server/src/index.ts:196`.

### 3. Make MCP Server Self-Bootstrapping

Three bugs prevent the server from starting on a fresh machine without prior `cortex init`:

**Bug 1: Adapter factory uses store name as filesystem path**

- File: `packages/server/src/context.ts` lines 117-121
- The `adapterFactory` receives the store name (e.g., `"default"`) but passes it directly as `rootDirectory` to `FilesystemStorageAdapter`. Should look up path from `config.stores[name].properties.path`.

**Bug 2: Null store guard doesn't catch ok(null)**

- File: `packages/server/src/index.ts` line 187
- `StoreClient.load()` returns `ok(null)` when store data isn't found. The guard `if (!store.ok())` passes because `ok(null).ok()` is `true`. Then accessing `.categoryMode` on null crashes.

**Bug 3: Auto-init doesn't fully initialize the default store**

- File: `packages/server/src/context.ts` lines 58-84
- Creates config directory and writes `config.yaml`, but combined with Bug 1 the adapter points at the wrong location.

**Expected behavior:** MCP server starts cleanly on a fresh machine. Auto-creates config and default store, serves tools immediately.

- Memory: `todo/fix-mcp-server-self-bootstrap`

### 4. Add LICENSE File

README and package.json say MIT, but no `LICENSE` file exists. GitHub reports `licenseInfo: null`.

### 5. Include Memory Skills in Repo

Three memory skills currently live in `~/.config/opencode/skills/` (global, not in repo):

| Skill                | Files                                              | Purpose                                        |
| -------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `memory/`            | 11 files (SKILL.md + README.md + 8 reference docs) | Core memory management instructions for agents |
| `memory-review/`     | 1 file (SKILL.md)                                  | Memory quality review and pruning              |
| `memory-synthesize/` | 1 file (SKILL.md)                                  | Extract facts from conversations into memory   |

**Approach:** Add a `skills/` directory to the repo with a README explaining how to copy them into `~/.config/opencode/skills/`. Keep it simple for beta.

---

## Medium Priority (Should-Fix)

### 6. Archive Stale OpenSpec: `add-category-mode-enforcement`

0/19 tasks, feature deferred to post-1.0 as part of the broader "Category Policies" redesign.

### 7. Defer OpenSpec: `add-cli-category-bootstrapping`

0/14 tasks, depends on category mode enforcement. Moved to post-1.0 roadmap.

### 8. Restructure README for MCP-First Audience

Current README leads with CLI quick-start. Should reorder for colleagues using MCP server:

1. What is Cortex (brief)
2. MCP Server setup (Claude Desktop / OpenCode config)
3. Skills installation (copy `skills/` directory)
4. CLI (secondary, for manual memory management)
5. Development (for contributors)

Also fix inaccuracies:

- Remove `autoSummaryThreshold` and `strictLocal` references (not implemented)
- Remove category modes docs (`free`/`subcategories`/`strict`) — deferred
- Fix "As a Library" code example (`writeMemory` → `save`)
- Add build-from-source instructions (packages not on npm yet)

- Memory: `todo/restructure-readme-for-beta`

### 9. Clean Up Uncommitted Work on Main

Modified files and 17+ untracked files sitting on `main`. Stage, commit, or stash before release.

### 10. Clean Up Stale Branches

20+ branches, many from completed work. Delete merged/stale branches.

### 11. Generate Initial CHANGELOG

Changesets infrastructure exists but no `CHANGELOG.md`. Need at least a "v0.x - Initial beta" entry.

### 12. Make Repo Public on GitHub

Currently `visibility: "PRIVATE"`. Flip when ready.

---

## Low Priority (Nice-to-Have)

### 13. GitHub Issue/PR Templates

No `.github/ISSUE_TEMPLATE/` or `pull_request_template.md`. Helpful for structuring feedback from beta testers.

---

## Decisions Made

| Decision                                                     | Rationale                                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP server should self-bootstrap (no `cortex init` required) | Primary use case is MCP; first-run must just work                                                                                                           |
| Skills distributed as files in repo with copy instructions   | Simple for beta, no tooling needed                                                                                                                          |
| `add-category-mode-enforcement` archived                     | Stale, superseded by category policies (post-1.0)                                                                                                           |
| `add-cli-category-bootstrapping` deferred to post-1.0        | Depends on category mode enforcement                                                                                                                        |
| `add-sqlite-index` left as-is                                | Already marked post-1.0 in roadmap                                                                                                                          |
| Cleaned up resolved TODOs                                    | `decrease-mcp-fs-coupling`, `categorypath-error-coupling`, `remove-unused-config-options`, `add-cortex-mutation-methods` — all addressed in recent refactor |
| README restructured MCP-first                                | Matches primary beta audience                                                                                                                               |

## Cleaned Up Memories

Removed obsolete TODO memories:

- `todo/decrease-mcp-fs-coupling` — addressed in recent refactor
- `todo/categorypath-error-coupling` — addressed in recent refactor
- `todo/remove-unused-config-options` — addressed in recent refactor
- `todo/add-cortex-mutation-methods` — addressed in recent refactor

## Updated Memories

- `roadmap/post-10` — added CLI Category Bootstrapping as post-1.0 item

## New Memories

- `todo/fix-mcp-server-self-bootstrap` — three bugs blocking cold-start
- `todo/restructure-readme-for-beta` — README reorder + fix inaccuracies
