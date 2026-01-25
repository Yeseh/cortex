## 1. Setup

- [x] 1.1 Create `scripts/` directory if not exists
- [x] 1.2 Create migration script file `scripts/migrate-opencode-memory.ts`

## 2. Core Implementation

- [x] 2.1 Implement source data reading
    - [x] 2.1.1 Execute opencode memory CLI with `--json` flag to list all blocks
    - [x] 2.1.2 Parse JSON output into typed structures
    - [x] 2.1.3 Handle both global and local scopes

- [x] 2.2 Implement slug generation
    - [x] 2.2.1 Create stopword list
    - [x] 2.2.2 Extract significant words from content
    - [x] 2.2.3 Convert to kebab-case slug
    - [x] 2.2.4 Track used slugs per category for collision detection
    - [x] 2.2.5 Append numeric suffix for collisions

- [x] 2.3 Implement category mapping
    - [x] 2.3.1 Map `persona` block → `global/persona/`
    - [x] 2.3.2 Map `human` block → `global/human/`
    - [x] 2.3.3 Map `project` block → `projects/<name>/project/`
    - [x] 2.3.4 Map `scratch` block → `projects/<name>/scratch/`

- [x] 2.4 Implement memory file writing
    - [x] 2.4.1 Convert timestamps from Unix to ISO 8601
    - [x] 2.4.2 Convert tags from comma-separated to array
    - [x] 2.4.3 Generate YAML frontmatter with `source: "opencode-migration"`
    - [x] 2.4.4 Write markdown file to target path
    - [x] 2.4.5 Create category directories as needed

- [x] 2.5 Implement reindexing
    - [x] 2.5.1 Call FilesystemStorageAdapter.reindexCategoryIndexes() after migration

## 3. CLI Interface

- [x] 3.1 Add command-line argument parsing
    - [x] 3.1.1 `--source-cli` path to opencode memory CLI (default: auto-detect)
    - [x] 3.1.2 `--target` path to Cortex store (default: `~/.config/cortex/memory`)
    - [x] 3.1.3 `--project` name for local memories (required if migrating local)
    - [x] 3.1.4 `--dry-run` flag to preview without writing
    - [x] 3.1.5 `--verbose` flag for detailed output

- [x] 3.2 Add progress reporting
    - [x] 3.2.1 Count total memories to migrate
    - [x] 3.2.2 Report progress during migration
    - [x] 3.2.3 Summary of migrated/skipped/failed at end

## 4. Error Handling

- [x] 4.1 Validate source CLI is accessible
- [x] 4.2 Handle empty source (no memories to migrate)
- [x] 4.3 Handle malformed JSON from source CLI
- [x] 4.4 Handle file write failures gracefully
- [x] 4.5 Provide clear error messages with remediation hints

## 5. Testing

- [x] 5.1 Test with sample global memories (persona, human blocks)
- [x] 5.2 Test slug generation with various content types
- [x] 5.3 Test collision handling
- [x] 5.4 Test dry-run mode
- [x] 5.5 Verify generated files match Cortex format expectations
