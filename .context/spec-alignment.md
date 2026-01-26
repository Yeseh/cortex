# Spec/Implementation Alignment: Store Layout

## Target End State

Running `cortex init` MUST create this exact layout under the global config dir (`~/.config/cortex`):

```
~/.config/cortex/
  config.yaml
  stores.yaml
  memory/
    index.yaml
    global/
    projects/
```

Interpretation implied by existing design docs: category indexes live _inside_ the category directory as `index.yaml` (no separate `indexes/` tree), and memories live alongside categories as markdown files (no separate `memories/` tree).

## What We Have Today (Observed)

- Global config is loaded from `~/.config/cortex/config.yaml` (`src/core/config.ts:339`).
- CLI default global store root is `~/.config/cortex/memory` (`src/cli/index.ts:419-424`).
- `cortex init` currently creates `~/.config/cortex/memory/` but then mixes two models:
    - Writes `config.yaml` + a root `index.yaml` into `~/.config/cortex/memory/`.
    - Creates `~/.config/cortex/memory/memory/` (memory files) and `~/.config/cortex/memory/indexes/<category>/index.yaml` (indexes) (`src/cli/commands/init.ts:118-164`).
- Filesystem adapter uses separate directories by default:
    - memories: `<storeRoot>/memories/**/*.md`
    - indexes: `<storeRoot>/indexes/**/*.yml`
      (`src/core/storage/filesystem.ts:100-114`).
- Integration tests also assume `memories/` + `indexes/` with `.yml` index files (`tests/cli.integration.spec.ts:145-189`).

## 1) Where The Specs/Design Went Wrong

### A. Specs omit the on-disk layout (allowed drift)

- `openspec/specs/index/spec.md` defines the _format_ but not the _location_ (no requirement about `index.yaml` living in the category directory vs a separate index tree).
- `openspec/specs/storage-filesystem/spec.md` mentions “memory files and indexes” but doesn’t define a normative directory layout.
- `openspec/specs/cli-store/spec.md` only specifies `.cortex` contains `config.yaml` + `index.yaml`, but does not specify where category directories, memory files, or category indexes live.

Net effect: implementation picked a split-tree (`memories/` + `indexes/`) that conflicts with the earlier “index lives in-folder” intent.

### B. Existing design docs explicitly show in-folder indexes

These are not OpenSpec specs, but they _are_ the project’s recorded design intent and they contradict the current implementation:

- `.context/memory-design.md:23-38` shows `memory/<category>/index.yaml` living alongside memory files.
- `.context/memory-brainstorm.md:36-52` shows `.cortex/<category>/index.yaml` living alongside memory files.

### C. A later change proposal reinforced the wrong model

- `openspec/changes/add-memory-migration-script/proposal.md:47-51` and `openspec/changes/add-memory-migration-script/design.md:89-104` describe the target store as `memories/` + `indexes/`, which is inconsistent with the in-folder index model and with the requested end state.

### D. Config spec vs init behavior mismatch

- Global config spec implies global config is under `~/.config/cortex/config.yaml` (`openspec/specs/config/spec.md`), which matches `src/core/config.ts`.
- But `cortex init` writes config under the _store root_ (`~/.config/cortex/memory/config.yaml`) (`src/cli/commands/init.ts:120-163`).

## 2) Commands That Don’t Align With The Model

### `cortex init`

- Wrong placement: writes `config.yaml` into `~/.config/cortex/memory/` instead of `~/.config/cortex/config.yaml`.
- Wrong structure: creates `memory/` and `indexes/` under the store root and stores category indexes separately.
- Does not create `~/.config/cortex/stores.yaml` at all.

Files: `src/cli/commands/init.ts`, `src/cli/commands/help.ts`.

### `cortex store add`

- Creates `<storePath>/memory/` (a single folder) when registering a store (`src/cli/commands/store.ts:161-172`), but the implementation elsewhere treats store roots as having `memories/` + `indexes/`.
- This is a third layout variant and likely the source of “mixing two models” reports.

### `cortex store init`

- Creates only `<path>/{config.yaml,index.yaml}` and no `memory/` subtree (`src/cli/commands/store.ts:229-261`).
- Under the requested model, initializing a store should create the canonical “memory store” layout (indexes in-folder).

### `cortex reindex`, `cortex list`, `cortex prune`, `cortex add` (and friends)

- All are implemented against the split-tree storage model via `FilesystemStorageAdapter` (`src/core/storage/filesystem.ts`) which assumes `memories/` and `indexes/` directories.
- `src/cli/commands/list.ts` and `src/cli/commands/prune.ts` read indexes via `adapter.readIndexFile(categoryPath)` which currently maps to `<storeRoot>/indexes/<category>.yml`.

## 3) Plan To Align Specs + Implementation + Tests

### Phase 0: Agree on the canonical store layout (document it)

Define (in OpenSpec) a single, normative filesystem layout for a store root `STORE_ROOT`:

```
STORE_ROOT/
  index.yaml                 # root category index
  <category>/
    index.yaml               # category index
    <memory>.md              # memory file
    <subcat>/
      index.yaml
      <memory>.md
```

Also define the global config dir layout:

```
~/.config/cortex/
  config.yaml
  stores.yaml
  memory/                    # default global store root
    index.yaml
    global/
    projects/
```

Recommendation: keep `IndexMemoryEntry.path` as the full slug path (current behavior) to avoid a large ripple into CLI logic; only change _where_ `index.yaml` lives.

### Phase 1: Update OpenSpec specs (source of truth)

Update / extend these specs to pin the layout:

1. `openspec/specs/storage-filesystem/spec.md`
    - Add a requirement that memory files live under `STORE_ROOT` as `**/*.md` and that each category directory contains an `index.yaml`.
2. `openspec/specs/index/spec.md`
    - Add a requirement: category index file name is `index.yaml` and location is the category directory.
    - Add scenario(s) for nested categories.
3. `openspec/specs/config/spec.md`
    - Clarify global config path `~/.config/cortex/config.yaml` and registry path `~/.config/cortex/stores.yaml`.
4. `openspec/specs/cli-store/spec.md`
    - Define that `cortex store init` initializes a store root with `index.yaml` and optionally precreates top-level categories if a “template” is used.
5. Add (or extend) a spec for `cortex init` (currently only code + help text).
    - Normative requirement: creates global config dir files + default global store at `~/.config/cortex/memory/` with `global/` and `projects/` categories.

Also fix/retire the conflicting description in:

- `openspec/changes/add-memory-migration-script/proposal.md`
- `openspec/changes/add-memory-migration-script/design.md`

(Even though it’s “tooling-only”, it’s currently the only OpenSpec artifact that spells out a storage layout, and it’s wrong for the desired end state.)

### Phase 2: Implementation changes (filesystem model)

1. Replace split-tree storage in `FilesystemStorageAdapter` (`src/core/storage/filesystem.ts`):
    - Remove `memoryRoot`/`indexRoot` separation.
    - Resolve memory file path as `${STORE_ROOT}/${slugPath}.md`.
    - Resolve category index path as `${STORE_ROOT}/${categoryPath}/index.yaml` (root category index is `${STORE_ROOT}/index.yaml`).
    - Update reindex implementation to write `index.yaml` files in-place (or via per-file temp + rename) instead of rebuilding a whole `indexes/` directory.
2. Ensure `writeMemoryFile()` updates indexes by default (current CLI `add` disables index updates via `allowIndexUpdate: false` in `src/cli/commands/add.ts:292-299`).
3. Update CLI commands relying on index location:
    - `src/cli/commands/list.ts` and `src/cli/commands/prune.ts` should continue using adapter APIs, but adapter semantics change.
4. Fix `cortex init` (`src/cli/commands/init.ts`):
    - Create `~/.config/cortex/config.yaml` (empty or commented defaults).
    - Create `~/.config/cortex/stores.yaml` (empty or with commented example).
    - Create default global store at `~/.config/cortex/memory/` with:
        - `index.yaml` listing `global` + `projects`
        - `global/index.yaml`, `projects/index.yaml` (and directories)
5. Update help text output (`src/cli/commands/help.ts`) to match the canonical structure.
6. Normalize store creation flows:
    - `cortex store add` should not create random partial structures; either:
        - (Preferred) just register the path, or
        - create the canonical store root layout (same as `store init`).

### Phase 3: Tests and fixtures

1. Update integration test helpers (`tests/cli.integration.spec.ts`):
    - Store initialization should create `index.yaml` only at the store root (and any required category dirs for tests).
    - Memory files should be written to `${storeRoot}/${slugPath}.md`.
    - Index files should be `${storeRoot}/${categoryPath}/index.yaml`.
2. Update unit tests for storage adapter (`src/core/storage/filesystem.spec.ts`) to match the new layout.
3. Add targeted tests for `cortex init` that assert the exact layout requested.

### Phase 4: Migration/compat strategy (optional but recommended)

Given users may already have stores created with the split-tree layout, implement one of:

- A compatibility layer in the adapter (read old layout, write new layout), OR
- A one-time `cortex migrate-layout` command, OR
- A “strict v2 layout only” breaking change (documented clearly).

Recommendation: add a small migration command (non-destructive) because the repo already contains a migration mindset (`openspec/changes/add-memory-migration-script/*`).

## Acceptance Criteria

- `cortex init` produces exactly the requested directory layout under `~/.config/cortex/`.
- No code references `indexes/` or `memories/` as storage layout defaults.
- All tests pass under the new layout and include at least one assertion that `index.yaml` is stored in-folder.
