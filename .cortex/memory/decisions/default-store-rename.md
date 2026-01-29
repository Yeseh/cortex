---
created_at: 2026-01-29T17:40:59.268Z
updated_at: 2026-01-29T17:40:59.268Z
tags:
  - decision
  - configuration
  - breaking-change
source: mcp
expires_at: 2026-02-05T18:40:47.000Z
---
# Default Store Renamed from 'global' to 'default'

**Decision**: The default store name changed from `'global'` to `'default'` in server configuration.

**Rationale**: The name `'global'` caused confusion because:
- `global` is also a category name (for cross-project knowledge)
- Agents would pass `'global'` thinking it was the store name

**Configuration**: `CORTEX_DEFAULT_STORE` environment variable defaults to `'default'`

**Related**: update-mcp-store-required change proposal