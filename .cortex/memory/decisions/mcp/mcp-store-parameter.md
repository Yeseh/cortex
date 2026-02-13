---
created_at: 2026-01-29T19:53:57.401Z
updated_at: 2026-01-29T19:53:57.401Z
tags:
  - mcp
  - api-design
  - store
source: mcp
---
All MCP memory tools require an explicit `store` parameter.

There is no implicit default store - agents must specify which store to operate on (e.g., "default", "cortex", or any registered store name).

This was implemented in commit fb84a65 to make store selection explicit and avoid ambiguity.