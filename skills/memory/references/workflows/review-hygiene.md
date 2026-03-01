# Reorganize / Review Memory Hygiene

**Use when:** categories become noisy, duplicated, flat, or hard to navigate.

**Example trigger:** `test`, `tests`, and `testing` all exist with overlapping content.

```txt
# Review structure
cortex_list_memories(store: "cortex")

# Consolidate paths
cortex_move_memory(store: "cortex", from_path: "tests/unit-policy", to_path: "standards/testing/unit-policy")

# Remove obsolete entries
cortex_remove_memory(store: "cortex", path: "test/old-policy")
```
