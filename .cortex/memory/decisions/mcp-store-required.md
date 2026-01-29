---
created_at: 2026-01-29T17:40:56.012Z
updated_at: 2026-01-29T17:40:56.012Z
tags:
  - decision
  - mcp
  - breaking-change
source: mcp
expires_at: 2026-02-05T18:40:47.000Z
---
# Store Parameter Required on All MCP Tools

**Decision**: The `store` parameter is now **required** on all MCP memory and category tools.

**Rationale**: Agents were getting confused about store naming, passing `'global'` as a literal store name instead of understanding it as a fallback. Making store explicit eliminates ambiguity.

**Impact**:
- All tool calls must include `store: "default"` or `store: "{project-name}"`
- No fallback behavior - missing store parameter will fail validation
- Memory skill documentation updated to reflect this requirement

**Related**: update-mcp-store-required change proposal