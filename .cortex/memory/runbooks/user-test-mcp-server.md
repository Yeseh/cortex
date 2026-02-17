---
{created_at: 2026-02-14T21:05:49.211Z,updated_at: 2026-02-17T19:13:38.066Z,tags: [testing,mcp-server,runbook,qa,summary],source: mcp}
---
# MCP Server Testing Runbook Summary

## Overview
Test runbook for the Cortex MCP Server with 17 test cases covering:
- Server initialization and MCP protocol
- Memory CRUD operations via tools
- Category and store management
- Citations support
- Error handling
- Claude Desktop integration

## Prerequisites
- Bun v1.3.6+ installed
- MCP-compatible client (Claude Desktop, Cline, or test harness)

## Quick Start
```bash
# Build and test
cd packages/server && bun install && bun test  # 266 tests

# Start server
bun run src/index.ts
```

## Available Tools
`cortex_add_memory`, `cortex_get_memory`, `cortex_update_memory`, `cortex_remove_memory`, `cortex_move_memory`, `cortex_list_memories`, `cortex_prune_memories`, `cortex_create_category`, `cortex_set_category_description`, `cortex_delete_category`, `cortex_list_stores`, `cortex_create_store`, `cortex_get_recent_memories`, `cortex_reindex_store`

## Test Categories
| Category | Test Cases | Description |
|----------|------------|-------------|
| TC-MCP-001 | Initialization | Server startup, capability discovery |
| TC-MCP-002-009 | Memory CRUD | Create, retrieve, list, update, move, remove |
| TC-MCP-010 | Categories | Create, describe, delete |
| TC-MCP-011 | Stores | List, create stores |
| TC-MCP-012-013 | Advanced | Recent memories, reindex |
| TC-MCP-014 | Citations | Create/retrieve with sources |
| TC-MCP-015 | Resources | URI-based access |
| TC-MCP-016-017 | Errors | Invalid store/path/date handling |

## Claude Desktop Config
```json
{
  "mcpServers": {
    "cortex": {
      "command": "bun",
      "args": ["run", "/path/to/cortex/packages/server/src/index.ts"]
    }
  }
}
```

## Performance Baseline
- Server starts: <2 seconds
- Tool calls: <100ms for simple ops
- List 100 memories: <500ms

## Full Test Details
See test suite at `packages/server/src/**/*.spec.ts`