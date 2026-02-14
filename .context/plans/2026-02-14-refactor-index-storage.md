# Refactor IndexStorage Implementation Plan

**Goal:** Implement the OpenSpec change `refactor-index-storage` by moving index serialization into storage-fs, simplifying storage interfaces, and updating consumers/tests.
**Architecture:** Keep core domain operations working with structured `CategoryIndex` only, with storage-fs handling YAML serialization internally. Update ports and adapters to remove filesystem-leaking methods and align naming. Consumers (CLI/server) should use the new interfaces without touching serialization details.
**Tech Stack:** TypeScript (ESM), Bun, OpenSpec, YAML via `yaml` package
**Session Id:** ses_3a704c840ffeGNj5Wn7xrixWih

---

## 0. Prep & Validation

- [ ] 0.1 Re-open `openspec/changes/refactor-index-storage/proposal.md` to confirm scope
- [ ] 0.2 Re-open `openspec/changes/refactor-index-storage/tasks.md` to confirm task list
- [ ] 0.3 Re-open delta specs under `openspec/changes/refactor-index-storage/specs/**` for acceptance criteria
- [ ] 0.4 Confirm baseline tests are green in worktree (`bun test packages`)

## 1. Core Interface Updates (Implementation)

- [ ] 1.1 Update `IndexStorage` interface signatures to use `CategoryIndex`
- [ ] 1.2 Remove index read/write methods from `CategoryStorage`
- [ ] 1.3 Rename `CategoryStorage` methods: `categoryExists`→`exists`, `ensureCategoryDirectory`→`ensure`, `deleteCategoryDirectory`→`delete`
- [ ] 1.4 Update core operations to use new `IndexStorage` and `CategoryStorage` names

## 2. Serialization Relocation (Implementation)

- [ ] 2.1 Add storage-fs internal index parse/serialize helpers
- [ ] 2.2 Remove index parse/serialize exports from core

## 3. Storage-FS Adapter Updates (Implementation)

- [ ] 3.1 Update `FilesystemIndexStorage` to return/accept structured `CategoryIndex`
- [ ] 3.2 Update `FilesystemCategoryStorage` to remove index methods and rename directory methods

## 4. Consumer Updates (Implementation)

- [ ] 4.1 Update core memory/category operations to use `indexes.read()` and new category method names
- [ ] 4.2 Update CLI commands to use structured index data from `IndexStorage`
- [ ] 4.3 Update MCP server handlers/resources to use structured index data

## 5. Tests (Testing)

- [ ] 5.1 Update core operation tests for new interfaces
- [ ] 5.2 Update storage-fs tests for structured `IndexStorage`
- [ ] 5.3 Update CLI and server tests for interface changes
- [ ] 5.4 Run `bun test packages` and fix any failures

## 6. Docs & Review (Documentation/Review)

- [ ] 6.1 Run code review pass and address findings
- [ ] 6.2 Add/adjust JSDoc if public APIs changed
- [ ] 6.3 Mark tasks in `openspec/changes/refactor-index-storage/tasks.md` as complete

## 7. Finish (Release/PR)

- [ ] 7.1 Create commit(s) using conventional commits
- [ ] 7.2 Open PR with summary and testing results
