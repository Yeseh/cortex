# MCP Operations Cheat Sheet

## Discovery
- `cortex_list_stores()`
- `cortex_list_memories(store: "...", category?: "...", include_expired?: boolean)`

## Memory Lifecycle
- Create: `cortex_add_memory(store, path, content, tags?, expires_at?)`
- Read: `cortex_get_memory(store, path, include_expired?)`
- Update: `cortex_update_memory(store, path, content?, tags?, expires_at?, clear_expiry?)`
- Move/Rename: `cortex_move_memory(store, from_path, to_path)`
- Delete: `cortex_remove_memory(store, path)`
- Prune expired: `cortex_prune_memories(store)`

## Category Lifecycle
- Create: `cortex_create_category(store, path)`
- Describe: `cortex_set_category_description(store, path, description)`
- Delete recursively: `cortex_delete_category(store, path)`

## Store Management
- Create store: `cortex_create_store(name)`

## Path Rules
- Correct: `store: "cortex", path: "standards/testing"`
- Incorrect: `path: "cortex/standards/testing"`

## Error-Avoidance Checklist
- Did you set `store` explicitly?
- Did you check for existing memory before adding?
- Is the path specific and stable?
- Should this memory expire?
- Does content avoid secrets/sensitive data?
