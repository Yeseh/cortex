---
created_at: 2026-02-14T21:05:49.211Z
updated_at: 2026-02-14T21:16:27.765Z
tags:
  - testing
  - mcp-server
  - runbook
  - qa
source: mcp
---
# User Testing Runbook: MCP Server

## Prerequisites
- Bun v1.3.6+ installed
- Project built or ability to run with `bun run`
- MCP-compatible client (Claude Desktop, Cline, or test harness)

## Test Environment Setup

### 1. Build the Server
```bash
cd packages/server
bun install
# Note: Build may show type errors but tests pass - safe to proceed
bun test  # Should show 266 passing tests
```

### 2. Start the Server
```bash
# Method 1: Direct execution
bun run src/index.ts

# Method 2: Using compiled binary (if available)
./dist/cortex-mcp

# Method 3: Via package script
bun run --filter '@yeseh/cortex-server' start
```

## Test Cases

### TC-MCP-001: Server Initialization
**Objective**: Verify server starts and responds to MCP protocol
- [ ] Server starts without errors
- [ ] MCP handshake completes successfully
- [ ] Tools are listed in capability discovery
- [ ] Resources are listed in capability discovery

**Expected Tools**: cortex_add_memory, cortex_get_memory, cortex_update_memory, cortex_remove_memory, cortex_move_memory, cortex_list_memories, cortex_prune_memories, cortex_create_category, cortex_set_category_description, cortex_delete_category, cortex_list_stores, cortex_create_store, cortex_get_recent_memories, cortex_reindex_store

### TC-MCP-002: Create Memory
**Objective**: Test cortex_add_memory tool
```json
{
  "tool": "cortex_add_memory",
  "arguments": {
    "store": "default",
    "path": "test/runbook/memory-1",
    "content": "Test memory content for MCP server validation",
    "tags": ["test", "mcp", "runbook"]
  }
}
```
- [ ] Memory created successfully
- [ ] Response includes memory metadata
- [ ] File exists at `~/.config/cortex/memory/test/runbook/memory-1.md`
- [ ] File contains YAML frontmatter with tags
- [ ] created_at and updated_at timestamps present

### TC-MCP-003: Retrieve Memory
**Objective**: Test cortex_get_memory tool
```json
{
  "tool": "cortex_get_memory",
  "arguments": {
    "store": "default",
    "path": "test/runbook/memory-1"
  }
}
```
- [ ] Memory retrieved successfully
- [ ] Content matches what was created
- [ ] Tags are present: ["test", "mcp", "runbook"]
- [ ] Timestamps are valid ISO 8601

### TC-MCP-004: List Memories
**Objective**: Test cortex_list_memories tool
```json
{
  "tool": "cortex_list_memories",
  "arguments": {
    "store": "default",
    "category": "test/runbook"
  }
}
```
- [ ] Returns array of memories
- [ ] Includes memory-1 created in TC-MCP-002
- [ ] Each memory has path, token_estimate, is_expired fields
- [ ] Subcategories array present (may be empty)

### TC-MCP-005: Update Memory
**Objective**: Test cortex_update_memory tool
```json
{
  "tool": "cortex_update_memory",
  "arguments": {
    "store": "default",
    "path": "test/runbook/memory-1",
    "content": "Updated content via MCP server",
    "tags": ["test", "mcp", "updated"]
  }
}
```
- [ ] Update succeeds
- [ ] Content updated correctly
- [ ] Tags replaced (not merged): ["test", "mcp", "updated"]
- [ ] updated_at timestamp changed
- [ ] created_at timestamp unchanged

### TC-MCP-006: Move Memory
**Objective**: Test cortex_move_memory tool
```json
{
  "tool": "cortex_move_memory",
  "arguments": {
    "store": "default",
    "from_path": "test/runbook/memory-1",
    "to_path": "test/runbook-moved/memory-renamed"
  }
}
```
- [ ] Move succeeds
- [ ] Old path no longer exists
- [ ] New path contains the memory
- [ ] Content and metadata preserved
- [ ] Category indexes updated

### TC-MCP-007: Create with Expiration
**Objective**: Test expiration field
```json
{
  "tool": "cortex_add_memory",
  "arguments": {
    "store": "default",
    "path": "test/temp/expires-soon",
    "content": "This memory will expire",
    "expires_at": "2024-01-01T00:00:00.000Z"
  }
}
```
- [ ] Memory created with expires_at field
- [ ] expires_at in frontmatter matches input
- [ ] is_expired=true when listed (since date is past)

### TC-MCP-008: Prune Expired Memories
**Objective**: Test cortex_prune_memories tool
```json
{
  "tool": "cortex_prune_memories",
  "arguments": {
    "store": "default",
    "dry_run": false
  }
}
```
- [ ] Prune succeeds
- [ ] Expired memory from TC-MCP-007 removed
- [ ] Non-expired memories unchanged
- [ ] Response lists pruned memory paths

### TC-MCP-009: Remove Memory
**Objective**: Test cortex_remove_memory tool
```json
{
  "tool": "cortex_remove_memory",
  "arguments": {
    "store": "default",
    "path": "test/runbook-moved/memory-renamed"
  }
}
```
- [ ] Removal succeeds
- [ ] File deleted from filesystem
- [ ] Memory no longer appears in list
- [ ] Category index updated

### TC-MCP-010: Category Operations
**Objective**: Test category management tools

**Create category**:
```json
{
  "tool": "cortex_create_category",
  "arguments": {
    "store": "default",
    "path": "test/categories/level1/level2"
  }
}
```
- [ ] Category hierarchy created
- [ ] index.yaml files created at each level

**Set description**:
```json
{
  "tool": "cortex_set_category_description",
  "arguments": {
    "store": "default",
    "path": "test/categories/level1",
    "description": "Test category for runbook validation"
  }
}
```
- [ ] Description set successfully
- [ ] index.yaml contains description field

**Delete category**:
```json
{
  "tool": "cortex_delete_category",
  "arguments": {
    "store": "default",
    "path": "test/categories"
  }
}
```
- [ ] Category and all contents deleted recursively
- [ ] Filesystem directories removed

### TC-MCP-011: Store Operations
**Objective**: Test store management tools

**List stores**:
```json
{
  "tool": "cortex_list_stores",
  "arguments": {}
}
```
- [ ] Returns array of stores
- [ ] At minimum includes "default" store
- [ ] Each store has name and path

**Create store**:
```json
{
  "tool": "cortex_create_store",
  "arguments": {
    "name": "test-store"
  }
}
```
- [ ] Store created successfully
- [ ] Appears in list_stores output
- [ ] Can be used in subsequent operations

### TC-MCP-012: Get Recent Memories
**Objective**: Test cortex_get_recent_memories tool

**Setup**: Create 3 memories with delays between them
**Query**:
```json
{
  "tool": "cortex_get_recent_memories",
  "arguments": {
    "store": "default",
    "limit": 2
  }
}
```
- [ ] Returns most recent 2 memories
- [ ] Sorted by updated_at descending
- [ ] Full memory content included

### TC-MCP-013: Reindex Store
**Objective**: Test cortex_reindex_store tool
```json
{
  "tool": "cortex_reindex_store",
  "arguments": {
    "store": "default"
  }
}
```
- [ ] Reindex completes successfully
- [ ] All index.yaml files regenerated
- [ ] Memory listings still accurate after reindex

### TC-MCP-014: Citations
**Objective**: Test citation tracking in memories

**Create with citations**:
```json
{
  "tool": "cortex_add_memory",
  "arguments": {
    "store": "default",
    "path": "test/citations/example",
    "content": "Memory content with cited sources",
    "citations": [
      "https://example.com/article",
      "file:///path/to/document.pdf"
    ]
  }
}
```
- [ ] Memory created with citations
- [ ] Citations stored in frontmatter
- [ ] Citations array contains both entries

**Retrieve with citations**:
```json
{
  "tool": "cortex_get_memory",
  "arguments": {
    "store": "default",
    "path": "test/citations/example"
  }
}
```
- [ ] Retrieved memory includes citations array
- [ ] Both citations present and correct
- [ ] Citations separate from content

**Update citations**:
```json
{
  "tool": "cortex_update_memory",
  "arguments": {
    "store": "default",
    "path": "test/citations/example",
    "citations": [
      "https://example.com/new-source"
    ]
  }
}
```
- [ ] Citations replaced (not merged)
- [ ] Only new citation present
- [ ] Content unchanged if not specified

### TC-MCP-015: Resource URI Access
**Objective**: Test MCP resource protocol

**Memory resource**:
- URI: `cortex://default/test/runbook/memory-1`
- [ ] Resource resolves to memory content
- [ ] MIME type is text/markdown

**Category resource**:
- URI: `cortex://default/test/runbook`
- [ ] Resource lists memories in category
- [ ] MIME type is application/json

**Store list resource**:
- URI: `cortex://stores`
- [ ] Resource lists all stores
- [ ] MIME type is application/json

### TC-MCP-016: Error Handling
**Objective**: Test error responses

**Invalid store**:
```json
{
  "tool": "cortex_get_memory",
  "arguments": {
    "store": "nonexistent",
    "path": "any/path"
  }
}
```
- [ ] Returns error with code STORE_NOT_FOUND
- [ ] Error message is actionable

**Invalid path**:
```json
{
  "tool": "cortex_get_memory",
  "arguments": {
    "store": "default",
    "path": "does/not/exist"
  }
}
```
- [ ] Returns error with code MEMORY_NOT_FOUND
- [ ] Error message is actionable

**Invalid expiration date**:
```json
{
  "tool": "cortex_add_memory",
  "arguments": {
    "store": "default",
    "path": "test/bad-date",
    "content": "content",
    "expires_at": "not-a-date"
  }
}
```
- [ ] Returns validation error
- [ ] Error identifies the invalid field

### TC-MCP-017: Cross-Platform Path Handling
**Objective**: Verify path handling works on Windows/Unix
- [ ] Paths with forward slashes work correctly
- [ ] Category hierarchies created properly
- [ ] Store paths resolve with homedir expansion
- [ ] No hardcoded path separators cause failures

## Integration Testing with Claude Desktop

### Setup
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:
```json
{
  "mcpServers": {
    "cortex": {
      "command": "bun",
      "args": ["run", "/path/to/cortex/packages/server/src/index.ts"],
      "env": {
        "CORTEX_STORE": "default"
      }
    }
  }
}
```

### TC-MCP-INT-001: Natural Language Memory Management
**Prompt**: "Create a memory in cortex at path project/ideas/feature-x with content 'Add dark mode support'"
- [ ] Claude uses cortex_add_memory tool
- [ ] Memory created successfully
- [ ] Claude confirms creation

**Prompt**: "List all memories in project/ideas"
- [ ] Claude uses cortex_list_memories tool
- [ ] Returns feature-x memory
- [ ] Claude formats output readably

**Prompt**: "Update the feature-x idea to include mobile support"
- [ ] Claude uses cortex_update_memory tool
- [ ] Content updated
- [ ] Claude confirms update

## Performance Baseline
- [ ] Server starts in <2 seconds
- [ ] Tool calls respond in <100ms for simple operations
- [ ] Listing 100 memories takes <500ms
- [ ] No memory leaks during 100+ operations

## Cleanup
```bash
# Remove test data
rm -rf ~/.config/cortex/memory/test
# Or via MCP:
# cortex_delete_category with path "test"
```

## Sign-off
- [ ] All test cases pass
- [ ] No errors in server logs
- [ ] Integration with Claude Desktop works
- [ ] Performance acceptable
- [ ] Error messages are helpful

**Tester**: _______________  
**Date**: _______________  
**Version**: _______________