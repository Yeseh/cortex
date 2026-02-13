---
created_at: 2026-01-29T16:35:41.034Z
updated_at: 2026-01-29T16:35:41.034Z
tags: [decision, mcp, store, registry]
source: mcp
---
# Store List Tool Reads from Registry

## Decision (2026-01-29)
The `cortex_list_stores` MCP tool was changed from reading filesystem directories to reading from the `stores.yaml` registry file.

## Rationale
- Enables returning store descriptions alongside names and paths
- Registry is the source of truth for store configuration
- Allows stores to exist in registry before their directories are created

## Implementation Notes
- Tool reads from `${dataPath}/stores.yaml`
- Returns `{ stores: [{ name, path, description? }] }` format
- Missing registry returns empty list (no error)
- Stores are sorted alphabetically by name
- Description key is only present when defined (not null/undefined)

## Backward Compatibility
- Existing registries without descriptions continue to work
- Tests were updated to create registry files instead of directories