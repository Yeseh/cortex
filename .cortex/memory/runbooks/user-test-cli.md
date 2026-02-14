---
created_at: 2026-02-14T21:07:10.951Z
updated_at: 2026-02-14T21:07:10.951Z
tags:
  - testing
  - cli
  - runbook
  - qa
source: mcp
---
# User Testing Runbook: CLI

## Prerequisites
- Bun v1.3.6+ installed
- Project built or ability to run with `bun run`
- Terminal access

## Test Environment Setup

### 1. Build the CLI
```bash
cd packages/cli
bun install
# Note: Build may show type errors but tests pass - safe to proceed
bun test  # Should show 180 passing tests
```

### 2. CLI Access Methods
Choose one:

**Method A: Direct execution**
```bash
alias cortex="bun run packages/cli/src/run.ts"
```

**Method B: Global install** (after build succeeds)
```bash
bun link
cortex --version
```

**Method C: Package runner**
```bash
bunx @yeseh/cortex-cli --version
```

## Test Cases

### TC-CLI-001: Version and Help
**Objective**: Verify CLI is functional
```bash
cortex --version
cortex --help
cortex memory --help
cortex store --help
```
- [ ] Version displays correctly
- [ ] Help text shows all commands
- [ ] No errors or warnings
- [ ] Usage examples are clear

### TC-CLI-002: Initialize Global Configuration
**Objective**: Test cortex init command
```bash
cortex init
```
- [ ] Creates `~/.config/cortex/` directory
- [ ] Creates `~/.config/cortex/memory/` directory
- [ ] Creates `~/.config/cortex/config.yaml`
- [ ] Success message displayed
- [ ] Running again is idempotent (no errors)

### TC-CLI-003: Add Memory (Basic)
**Objective**: Create a memory with minimal options
```bash
cortex memory add test/cli/basic -c "Basic test memory content"
```
- [ ] Command succeeds
- [ ] File created at `~/.config/cortex/memory/test/cli/basic.md`
- [ ] Content matches input
- [ ] YAML frontmatter has created_at, updated_at
- [ ] Success message displayed

### TC-CLI-004: Add Memory (Full Options)
**Objective**: Test all memory creation options
```bash
cortex memory add test/cli/full \
  -c "Full options test" \
  -t tag1 -t tag2 -t tag3 \
  -e "2025-12-31T23:59:59.000Z" \
  --citation "https://example.com/source" \
  --citation "file:///path/to/doc.md"
```
- [ ] Memory created successfully
- [ ] tags: ["tag1", "tag2", "tag3"] in frontmatter
- [ ] expires_at set correctly
- [ ] citations array includes both sources
- [ ] All metadata present

### TC-CLI-005: Add Memory (Interactive)
**Objective**: Test editor-based content input
```bash
export EDITOR=nano  # or vim, etc.
cortex memory add test/cli/interactive
```
- [ ] Opens editor with template
- [ ] After saving and closing, memory created
- [ ] Multi-line content preserved
- [ ] Editor choice respected (EDITOR env var)

### TC-CLI-006: Show Memory (Default Format)
**Objective**: Display memory content
```bash
cortex memory show test/cli/basic
```
- [ ] Displays metadata section
- [ ] Displays content section
- [ ] YAML format by default
- [ ] Timestamps human-readable
- [ ] No YAML frontmatter delimiters shown

### TC-CLI-007: Show Memory (All Formats)
**Objective**: Test output format options
```bash
cortex memory show test/cli/full -o yaml
cortex memory show test/cli/full -o json
cortex memory show test/cli/full -o toon
```
- [ ] YAML format: readable, multiline content preserved
- [ ] JSON format: valid JSON, parseable
- [ ] TOON format: compact, single-line representation
- [ ] All formats include metadata and content

### TC-CLI-008: List Memories (Category)
**Objective**: List memories in a category
```bash
cortex memory list test/cli
```
- [ ] Shows memories: basic, full, interactive
- [ ] Displays paths, token estimates
- [ ] Shows expired status (false for basic/interactive)
- [ ] Shows expired status (based on date for full)
- [ ] Subcategories listed if any

### TC-CLI-009: List Memories (Root)
**Objective**: List top-level categories
```bash
cortex memory list
```
- [ ] Shows root-level categories
- [ ] Includes "test" category from previous tests
- [ ] No individual memories listed (only categories)
- [ ] Clean, organized output

### TC-CLI-010: List with Include Expired
**Objective**: Test include-expired flag
```bash
# First create an expired memory
cortex memory add test/cli/expired -c "Expired content" -e "2020-01-01"

# List without flag
cortex memory list test/cli

# List with flag
cortex memory list test/cli --include-expired
```
- [ ] Without flag: expired memory excluded
- [ ] With flag: expired memory included
- [ ] is_expired field shows true for expired memory

### TC-CLI-011: Update Memory (Content Only)
**Objective**: Update memory content
```bash
cortex memory update test/cli/basic -c "Updated content via CLI"
```
- [ ] Update succeeds
- [ ] Content changed
- [ ] updated_at timestamp changed
- [ ] created_at unchanged
- [ ] Other metadata unchanged

### TC-CLI-012: Update Memory (Metadata)
**Objective**: Update tags and other metadata
```bash
cortex memory update test/cli/basic -t newtag1 -t newtag2
```
- [ ] Tags replaced (not appended): ["newtag1", "newtag2"]
- [ ] Content unchanged
- [ ] updated_at changed

### TC-CLI-013: Update Memory (Interactive)
**Objective**: Edit memory in editor
```bash
export EDITOR=nano
cortex memory update test/cli/basic
```
- [ ] Opens editor with current content
- [ ] Changes saved after close
- [ ] Multi-line edits work
- [ ] YAML frontmatter not shown in editor

### TC-CLI-014: Update Memory (Clear Expiration)
**Objective**: Remove expiration from a memory
```bash
cortex memory update test/cli/full --no-expiration
```
- [ ] expires_at field removed from frontmatter
- [ ] Memory no longer marked as expired
- [ ] Other metadata unchanged

### TC-CLI-015: Move Memory (Rename)
**Objective**: Rename within same category
```bash
cortex memory move test/cli/basic test/cli/renamed
```
- [ ] Old path no longer exists
- [ ] New path contains the memory
- [ ] Content and metadata preserved
- [ ] Category indexes updated

### TC-CLI-016: Move Memory (Relocate)
**Objective**: Move to different category
```bash
cortex memory move test/cli/renamed test/moved/relocated
```
- [ ] Source category updated (memory removed)
- [ ] Destination category created if needed
- [ ] Destination category updated (memory added)
- [ ] File moved to new location

### TC-CLI-017: Remove Memory
**Objective**: Delete a memory
```bash
cortex memory remove test/cli/expired
```
- [ ] Memory deleted from filesystem
- [ ] No longer appears in list
- [ ] Category index updated
- [ ] Confirmation message shown

### TC-CLI-018: Remove Memory (Confirmation)
**Objective**: Test removal safety
```bash
# If CLI has confirmation prompt:
cortex memory remove test/cli/interactive
# Answer 'n' to cancel
cortex memory list test/cli
# Verify still exists
```
- [ ] Confirmation prompt shown (if implemented)
- [ ] Cancellation works
- [ ] Proceeding with 'y' deletes memory

### TC-CLI-019: Store List
**Objective**: List all registered stores
```bash
cortex store list
```
- [ ] Shows "default" store
- [ ] Shows path: `~/.config/cortex/memory` (or expanded)
- [ ] Additional stores listed if any
- [ ] Clean tabular or YAML output

### TC-CLI-020: Store Init (New Store)
**Objective**: Initialize a new store
```bash
mkdir /tmp/test-cortex-store
cortex store init /tmp/test-cortex-store -n test-store
```
- [ ] Store directory created
- [ ] index.yaml created in store root
- [ ] Store registered in config
- [ ] Appears in `cortex store list`

### TC-CLI-021: Store Init (Project-Local)
**Objective**: Create project-local .cortex store
```bash
cd /tmp/test-project
cortex store init .cortex -n myproject
```
- [ ] .cortex/memory/ directory created
- [ ] index.yaml created
- [ ] Can be used automatically when in project directory

### TC-CLI-022: Store Add (Register Existing)
**Objective**: Register a pre-existing store
```bash
# Assuming /tmp/existing-store has memory structure
cortex store add existing-store /tmp/existing-store
```
- [ ] Store registered in config
- [ ] Appears in store list
- [ ] Can be used with --store flag

### TC-CLI-023: Store Remove (Unregister)
**Objective**: Unregister a store
```bash
cortex store remove test-store
```
- [ ] Store removed from config
- [ ] No longer in store list
- [ ] Files on disk unchanged (not deleted)
- [ ] Warning shown if store had memories

### TC-CLI-024: Store Prune
**Objective**: Remove expired memories from store
```bash
# Create some expired memories first
cortex memory add prune-test/expired1 -c "Test" -e "2020-01-01"
cortex memory add prune-test/expired2 -c "Test" -e "2021-01-01"
cortex memory add prune-test/valid -c "Test"

cortex store prune
```
- [ ] Expired memories deleted
- [ ] Valid memories remain
- [ ] Summary of pruned memories shown
- [ ] Category indexes updated

### TC-CLI-025: Store Reindex
**Objective**: Rebuild store indexes
```bash
# Manually corrupt an index file or add memory file directly
echo "content: test" > ~/.config/cortex/memory/manual/test.md

cortex store reindex
cortex memory list manual
```
- [ ] All index.yaml files regenerated
- [ ] Manually added memory now appears in listing
- [ ] Success message shown
- [ ] All categories accessible

### TC-CLI-026: Store Resolution (Explicit)
**Objective**: Use --store flag
```bash
cortex memory add test/store-flag -c "Using explicit store" --store test-store
cortex memory list test --store test-store
```
- [ ] Memory created in specified store
- [ ] Not created in default store
- [ ] List shows memory in correct store

### TC-CLI-027: Store Resolution (Local)
**Objective**: Automatic local store detection
```bash
cd /tmp/test-project  # Has .cortex/memory
cortex memory add local-test -c "Project-local memory"
ls .cortex/memory/local-test.md
```
- [ ] Memory created in .cortex/memory (not global)
- [ ] No --store flag needed
- [ ] Resolution order: local before global

### TC-CLI-028: Store Resolution (Global)
**Objective**: Fallback to global default
```bash
cd /tmp/no-cortex-here
cortex memory add global-test -c "Goes to global default"
ls ~/.config/cortex/memory/global-test.md
```
- [ ] Memory created in global default store
- [ ] No local .cortex directory needed
- [ ] Fallback works automatically

### TC-CLI-029: Output Format (JSON Piping)
**Objective**: JSON output for scripting
```bash
cortex memory list test -o json | jq '.memories[0].path'
cortex store list -o json | jq '.[0].name'
```
- [ ] Valid JSON output
- [ ] Pipeable to jq
- [ ] All relevant fields present
- [ ] Nested structures correct

### TC-CLI-030: Output Format (TOON Compact)
**Objective**: Compact TOON format
```bash
cortex memory list test -o toon
```
- [ ] Single-line per memory
- [ ] Key information visible
- [ ] Readable but compact
- [ ] Good for quick scans

### TC-CLI-031: Citations
**Objective**: Test citation tracking
```bash
cortex memory add cited/example \
  -c "Content with sources" \
  --citation "https://example.com/article" \
  --citation "file:///local/doc.md"

cortex memory show cited/example -o yaml
```
- [ ] Citations stored in frontmatter
- [ ] Both citations present
- [ ] Citations array format
- [ ] Display shows citations

### TC-CLI-032: Error Handling (Invalid Path)
**Objective**: Test path validation
```bash
cortex memory add "../../../etc/passwd" -c "Malicious"
cortex memory add "test//double-slash" -c "Invalid"
cortex memory add "" -c "Empty path"
```
- [ ] Path traversal rejected
- [ ] Double slashes rejected or normalized
- [ ] Empty path rejected
- [ ] Error messages actionable

### TC-CLI-033: Error Handling (Nonexistent Memory)
**Objective**: Test error for missing memory
```bash
cortex memory show does/not/exist
cortex memory update does/not/exist -c "New"
cortex memory remove does/not/exist
```
- [ ] Show: error MEMORY_NOT_FOUND
- [ ] Update: error MEMORY_NOT_FOUND
- [ ] Remove: error MEMORY_NOT_FOUND
- [ ] Error messages helpful

### TC-CLI-034: Error Handling (Invalid Store)
**Objective**: Test store validation
```bash
cortex memory add test -c "Content" --store nonexistent
```
- [ ] Error: STORE_NOT_FOUND
- [ ] Suggests available stores
- [ ] Does not create memory

### TC-CLI-035: Error Handling (Invalid Date)
**Objective**: Test expiration validation
```bash
cortex memory add test/bad-date -c "Content" -e "not-a-date"
cortex memory add test/bad-date -c "Content" -e "2024-13-45"
```
- [ ] Invalid format rejected
- [ ] Invalid date rejected
- [ ] ISO 8601 required
- [ ] Error message explains format

### TC-CLI-036: Cross-Platform Paths (Windows)
**Objective**: Verify Windows path handling
```bash
# On Windows
cortex memory add test/windows/path -c "Windows test"
dir %USERPROFILE%\.config\cortex\memory\test\windows\path.md
```
- [ ] Forward slashes in category paths work
- [ ] Backslashes in filesystem paths work
- [ ] Home directory expansion works (~)
- [ ] No hardcoded /tmp or /home

### TC-CLI-037: Cross-Platform Paths (Unix)
**Objective**: Verify Unix path handling
```bash
# On macOS/Linux
cortex memory add test/unix/path -c "Unix test"
ls ~/.config/cortex/memory/test/unix/path.md
```
- [ ] Standard Unix paths work
- [ ] ~ expansion works
- [ ] /tmp and /home work

### TC-CLI-038: Large Content
**Objective**: Test with substantial content
```bash
# Create a file with 10,000 characters
cortex memory add test/large -c "$(head -c 10000 /dev/urandom | base64)"
cortex memory show test/large | wc -c
```
- [ ] Large content stored successfully
- [ ] Retrieved content matches
- [ ] No truncation
- [ ] Performance acceptable

### TC-CLI-039: Unicode Content
**Objective**: Test international characters
```bash
cortex memory add test/unicode -c "Hello 世界 🌍 Здравствуй مرحبا"
cortex memory show test/unicode
```
- [ ] Unicode stored correctly
- [ ] Unicode displayed correctly
- [ ] Emoji supported
- [ ] RTL languages preserved

### TC-CLI-040: Concurrent Operations
**Objective**: Test parallel CLI invocations
```bash
cortex memory add test/concurrent1 -c "First" &
cortex memory add test/concurrent2 -c "Second" &
cortex memory add test/concurrent3 -c "Third" &
wait
cortex memory list test
```
- [ ] All three memories created
- [ ] No corruption or locks
- [ ] Index consistency maintained
- [ ] All memories readable

## Integration Testing

### TC-CLI-INT-001: Full Workflow
**Objective**: Realistic usage scenario
```bash
# Setup project
mkdir -p /tmp/demo-project && cd /tmp/demo-project
cortex store init .cortex -n demo

# Add project memories
cortex memory add decisions/database -c "Use PostgreSQL for ACID compliance" -t architecture
cortex memory add decisions/api -c "REST over GraphQL for simplicity" -t architecture
cortex memory add todo/implement-auth -c "Add JWT authentication" -t feature -e "2025-03-01"
cortex memory add notes/meeting-2024-01-15 -c "Discussed performance concerns" -e "2025-01-22"

# Query and organize
cortex memory list decisions
cortex memory list todo
cortex memory show decisions/database

# Maintenance
cortex store prune  # Remove expired notes
cortex memory move todo/implement-auth features/auth
cortex memory update features/auth -c "Completed JWT implementation" --no-expiration

# Export for sharing
cortex memory show decisions/database -o json > database-decision.json
```
- [ ] All steps succeed
- [ ] Project-local store used automatically
- [ ] Memories organized logically
- [ ] Expiration and pruning work
- [ ] Export produces valid JSON

### TC-CLI-INT-002: Multi-Store Workflow
**Objective**: Work with multiple stores
```bash
# Personal global memories
cortex memory add personal/preferences -c "Prefer tabs over spaces" --store default

# Work project
cd ~/work/project-a
cortex store init .cortex -n project-a
cortex memory add decisions/tech-stack -c "Node.js + React"

# Another work project
cd ~/work/project-b
cortex store init .cortex -n project-b
cortex memory add decisions/tech-stack -c "Python + Vue"

# List all stores
cortex store list

# Explicit access
cortex memory show decisions/tech-stack --store project-a
cortex memory show decisions/tech-stack --store project-b
```
- [ ] Each store isolated
- [ ] Context-aware resolution works
- [ ] Explicit store access works
- [ ] No cross-contamination

## Performance Baseline
```bash
# Create 100 memories
for i in {1..100}; do
  cortex memory add perf/memory-$i -c "Content $i" -t test
done

# Measure list performance
time cortex memory list perf

# Measure show performance
time cortex memory show perf/memory-50

# Cleanup
cortex memory list perf -o json | jq -r '.memories[].path' | xargs -I {} cortex memory remove {}
```
- [ ] 100 memories created in <30 seconds
- [ ] List 100 memories in <1 second
- [ ] Show single memory in <100ms
- [ ] Removal performant

## Cleanup
```bash
# Remove test data
cortex memory remove test/cli/full
cortex memory remove test/moved/relocated
cortex memory remove test/unicode
cortex memory remove test/large
# ... etc. or:
rm -rf ~/.config/cortex/memory/test
rm -rf ~/.config/cortex/memory/prune-test
rm -rf ~/.config/cortex/memory/cited
cortex store reindex
```

## Sign-off
- [ ] All test cases pass
- [ ] No crashes or hangs
- [ ] Error messages helpful
- [ ] Cross-platform verified (if applicable)
- [ ] Performance acceptable
- [ ] Documentation matches behavior

**Tester**: _______________  
**Date**: _______________  
**Version**: _______________